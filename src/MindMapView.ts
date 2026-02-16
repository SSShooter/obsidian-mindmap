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
		console.log("getState", this.file?.path);
		// Save the file path so it can be restored when splitting
		return {
			filePath: this.file?.path,
		};
	}

	async setState(state: MindMapViewState) {
		console.log("setState", state);
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
		console.log("onOpen", this.file?.path);
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();

		const mapDiv = container.createDiv({ cls: "mindmap-container" });
		mapDiv.style.height = "100%";
		mapDiv.style.width = "100%";

		// Initialize MindElixir
		this.mind = new MindElixir({
			el: mapDiv,
			direction: MindElixir.RIGHT,
			draggable: true,
			contextMenu: true,
			toolBar: true,
			keypress: true,
			selectionContainer: "body",
		});

		// If we already have a file, render it
		if (this.file) {
			await this.render();
		}
	}

	async onClose() {
		console.log("onClose", this.file?.path);
		// Cleanup
		this.mind?.destroy();
	}

	async render() {
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

		this.mind.init(mindData);

		// Refresh seems to be needed if init was already called, but init handles re-init usually?
		// Mind Elixir init(data) usually resets.
	}
}
