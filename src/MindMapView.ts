import { ItemView, WorkspaceLeaf, TFile, Scope } from "obsidian";
import MindElixir, { MindElixirInstance, Options } from "mind-elixir";
import { mindElixirToPlaintext } from "mind-elixir/plaintextConverter";
import { parseMarkdown, parsePlaintext, replaceObsidianLinks } from "./parser";
import { MindMapSettings } from "./settings";
import { getMindElixirLocale, handleMindmapClick } from "./utils";
import { downloadImage } from "@mind-elixir/export-mindmap";

export const VIEW_TYPE_MINDMAP = "mindmap-view";

interface MindMapViewState {
	filePath?: string;
}

export class MindMapView extends ItemView {
	mind: MindElixirInstance | null = null;
	file: TFile | null = null;
	settings: MindMapSettings;
	private debounceTimer: number | null = null;
	/** Whether the currently loaded file is Mind Elixir plaintext format */
	private isPlaintext: boolean = false;
	/** Flag to prevent re-render loop when we write back to the file */
	private isSavingFromMindmap: boolean = false;
	private arrowTimer: number | null = null;

	constructor(leaf: WorkspaceLeaf, settings: MindMapSettings) {
		super(leaf);
		this.settings = settings;
	}

	getViewType() {
		return VIEW_TYPE_MINDMAP;
	}

	getDisplayText() {
		return this.file ? this.file.basename + " Mind Map" : "Mind Map";
	}

	getState() {
		// Save the file path so it can be restored when splitting
		return {
			filePath: this.file?.path,
		};
	}

	async setState(state: MindMapViewState) {
		// Restore the file when the view is reopened or split
		if (state.filePath) {
			const file = this.app.vault.getAbstractFileByPath(state.filePath);
			if (file instanceof TFile) {
				this.file = file;
				// If view is already open, render immediately
				if (this.mind) {
					await this.render();
				}
			}
		}
	}

	async onOpen() {
		// 注册只在当前 View 生效的 F2 以防止触发 Obsidian 的重命名文件
		this.scope = new Scope(this.app.scope);
		this.scope.register([], "F2", (evt) => {
			evt.preventDefault();
			if (this.mind && this.mind.editable) {
				const md = this.mind;
				if (md.currentSummary) {
					md.editSummary(md.currentSummary);
				} else if (md.currentArrow) {
					md.editArrowLabel(md.currentArrow);
				} else {
					void md.beginEdit();
				}
			}
			return false; // 阻止冒泡到全局
		});

		// Add export image button in view header
		this.addAction("download", "Export as image", () => {
			if (this.mind) {
				void downloadImage(this.mind, "png");
			}
		});

		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();

		const mapDiv = container.createDiv({ cls: "mindmap-container" });
		mapDiv.setAttribute("data-ignore-swipe", "true");
		// Add click listener for internal links and nodes
		mapDiv.addEventListener("click", (e) => {
			handleMindmapClick(this.app, e, this.file?.path || "");
		});

		const isDark = document.body.classList.contains("theme-dark");
		// Initialize MindElixir
		// editable will be set to true later in render() if file is plaintext format
		const options: Options = {
			el: mapDiv,
			direction: MindElixir.RIGHT,
			editable: false,
			contextMenu: { locale: getMindElixirLocale() },
			toolBar: true,
			keypress: true,
			selectionContainer: "body",
			theme: isDark ? MindElixir.DARK_THEME : MindElixir.THEME,
			markdown: (str) => {
				return replaceObsidianLinks(str);
			},
		};

		this.mind = new MindElixir(options);

		// Register file modification listener with debounce
		this.registerEvent(
			this.app.vault.on("modify", (file) => {
				if (file === this.file) {
					// Skip re-render if we triggered the save ourselves
					if (this.isSavingFromMindmap) return;
					this.debouncedUpdate();
				}
			}),
		);

		// Register mind-elixir operation events to write back to plaintext file
		const mindmapOperationHandler = () => {
			void this.savePlaintextFromMindmap();
		};
		this.mind.bus.addListener("operation", mindmapOperationHandler);

		// Register arrow movement events to write back to plaintext file with throttling
		this.mind.bus.addListener("updateArrowDelta", () => {
			if (this.arrowTimer) return;
			this.arrowTimer = window.setTimeout(() => {
				void this.savePlaintextFromMindmap();
				this.arrowTimer = null;
			}, 2000);
		});

		// Register theme change listener
		this.registerEvent(
			this.app.workspace.on("css-change", () => {
				const currentIsDark =
					document.body.classList.contains("theme-dark");
				const theme = currentIsDark
					? MindElixir.DARK_THEME
					: MindElixir.THEME;
				if (this.mind) {
					this.mind.changeTheme(theme);
				}
			}),
		);

		// If we already have a file, render it
		if (this.file) {
			await this.render();
		}
	}

	async onClose() {
		// Clear any pending debounce timer
		if (this.debounceTimer) {
			window.clearTimeout(this.debounceTimer);
			this.debounceTimer = null;
		}
		// Clear any pending arrow timer
		if (this.arrowTimer) {
			window.clearTimeout(this.arrowTimer);
			this.arrowTimer = null;
		}
		// Cleanup
		this.mind?.destroy();
	}

	private debouncedUpdate() {
		// Clear existing timer
		if (this.debounceTimer) {
			window.clearTimeout(this.debounceTimer);
		}

		// Set new timer to update after 300ms of inactivity
		this.debounceTimer = window.setTimeout(() => {
			void this.render(true);
			this.debounceTimer = null;
		}, 1000);
	}

	async render(isRefresh: boolean = false) {
		if (!this.mind || !this.file) return;

		const data = await this.app.vault.read(this.file);
		let mindData;
		// Heuristic: If content has Markdown headers, use Markdown parser.
		// Otherwise (or if it looks like Mind Elixir Plaintext), use Plaintext parser which supports advanced features.
		if (data.trim().startsWith("- ")) {
			this.isPlaintext = true;
			mindData = parsePlaintext(data, this.file.basename);
		} else {
			this.isPlaintext = false;
			mindData = parseMarkdown(
				data,
				this.file.basename,
				this.settings.h1AsRoot,
			);
		}

		// Enable or disable editing based on format
		if (this.mind.editable !== this.isPlaintext) {
			this.mind.editable = this.isPlaintext;
		}

		if (isRefresh) {
			this.mind.refresh(mindData);
		} else {
			this.mind.init(mindData);
		}
	}

	/**
	 * Converts the current mind map data back to plaintext and saves it to the file.
	 * Only runs when the file is in Mind Elixir plaintext format.
	 */
	private async savePlaintextFromMindmap() {
		if (!this.isPlaintext || !this.mind || !this.file) return;

		try {
			const mindData = this.mind.getData();
			const plaintext = mindElixirToPlaintext(mindData);

			// Set flag so our own file-modify event doesn't trigger re-render
			this.isSavingFromMindmap = true;
			await this.app.vault.modify(this.file, plaintext);
		} catch (e) {
			console.error("MindMapView: failed to save plaintext", e);
		} finally {
			// Use a short delay before clearing the flag to ensure the
			// vault modify event has been processed
			window.setTimeout(() => {
				this.isSavingFromMindmap = false;
			}, 300);
		}
	}
}
