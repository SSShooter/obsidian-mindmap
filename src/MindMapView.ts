import { ItemView, WorkspaceLeaf, TFile } from "obsidian";
import MindElixir, { MindElixirInstance } from "mind-elixir";
import { parseMarkdown, parsePlaintext } from "./parser";
import { MindMapSettings } from "./settings";

export const VIEW_TYPE_MINDMAP = "mindmap-view";

interface MindMapViewState {
	filePath?: string;
}

export class MindMapView extends ItemView {
	mind: MindElixirInstance | null = null;
	file: TFile | null = null;
	settings: MindMapSettings;
	private debounceTimer: number | null = null;

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
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();

		const mapDiv = container.createDiv({ cls: "mindmap-container" });

		// Initialize MindElixir
		this.mind = new MindElixir({
			el: mapDiv,
			direction: MindElixir.RIGHT,
			editable: false,
			contextMenu: true,
			toolBar: true,
			keypress: true,
			selectionContainer: "body",
		});

		// Register file modification listener with debounce
		this.registerEvent(
			this.app.vault.on("modify", (file) => {
				if (file === this.file) {
					this.debouncedUpdate();
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
		if (data.startsWith("- ")) {
			mindData = parsePlaintext(data, this.file.basename);
		} else {
			mindData = parseMarkdown(
				data,
				this.file.basename,
				this.settings.h1AsRoot,
			);
		}
		if (isRefresh) {
			this.mind.refresh(mindData);
		} else {
			this.mind.init(mindData);
		}
	}
}
