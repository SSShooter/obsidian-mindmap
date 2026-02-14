import { Plugin, WorkspaceLeaf, TFile } from "obsidian";
import { MindMapView, VIEW_TYPE_MINDMAP } from "./MindMapView";
import "mind-elixir/style.css";

export default class MindMapPlugin extends Plugin {
	async onload() {
		this.registerView(VIEW_TYPE_MINDMAP, (leaf) => new MindMapView(leaf));

		this.addCommand({
			id: "open-mindmap",
			name: "Open as Mind Map",
			checkCallback: (checking: boolean) => {
				const file = this.app.workspace.getActiveFile();
				if (file) {
					if (!checking) {
						this.activateView(file);
					}
					return true;
				}
				return false;
			},
		});

		// Optional: Ribbon icon
		this.addRibbonIcon("map", "Open as Mind Map", () => {
			const file = this.app.workspace.getActiveFile();
			if (file) {
				this.activateView(file);
			}
		});
	}

	async onunload() {
		// Cleanup if needed
	}

	async activateView(file: TFile) {
		// Create a new leaf for the mindmap
		const leaf = this.app.workspace.getLeaf(true);

		await leaf.setViewState({
			type: VIEW_TYPE_MINDMAP,
			active: true,
		});

		// Get the view instance and set the file
		if (leaf.view instanceof MindMapView) {
			await leaf.view.setFile(file);
		}

		// Reveal the leaf
		this.app.workspace.revealLeaf(leaf);
	}
}
