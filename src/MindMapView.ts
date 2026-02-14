import { ItemView, WorkspaceLeaf, TFile } from "obsidian";
import MindElixir, { MindElixirInstance } from "mind-elixir";
import { parseMarkdown, parsePlaintext } from "./parser";

export const VIEW_TYPE_MINDMAP = "mindmap-view";

export class MindMapView extends ItemView {
	mind: MindElixirInstance | null = null;
	file: TFile | null = null;
	data: string = "";

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType() {
		return VIEW_TYPE_MINDMAP;
	}

	getDisplayText() {
		return this.file ? this.file.basename : "Mind Map";
	}

	async onOpen() {
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
		});

		// If we already have a file, render it
		if (this.file) {
			await this.render();
		}
	}

	async onClose() {
		// Cleanup
	}

	async setFile(file: TFile) {
		this.file = file;
		this.data = await this.app.vault.read(file);
		await this.render();
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
			mindData = parseMarkdown(data, this.file.basename);
		}

		this.mind.init(mindData);

		// Refresh seems to be needed if init was already called, but init handles re-init usually?
		// Mind Elixir init(data) usually resets.
	}
}
