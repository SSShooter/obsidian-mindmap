import { Plugin, WorkspaceLeaf, TFile } from "obsidian";
import { MindMapView, VIEW_TYPE_MINDMAP } from "./MindMapView";
import {
	MindMapSettings,
	DEFAULT_SETTINGS,
	MindMapSettingTab,
} from "./settings";
import MindElixir from "mind-elixir";
import { parsePlaintext } from "./parser";
import "mind-elixir/style.css";

export default class MindMapPlugin extends Plugin {
	settings: MindMapSettings;

	async onload() {
		await this.loadSettings();

		this.registerView(
			VIEW_TYPE_MINDMAP,
			(leaf) => new MindMapView(leaf, this.settings),
		);

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

		this.addSettingTab(new MindMapSettingTab(this.app, this));

		// Register markdown code block processor for mindelixir blocks
		this.registerMarkdownCodeBlockProcessor(
			"mindelixir",
			(source, el, ctx) => {
				// Parse plaintext content using mind-elixir's converter
				const mindData = parsePlaintext(source, "Mind Map");

				// Create container for mind map
				const container = el.createDiv({
					cls: "mindelixir-codeblock-container",
				});
				container.style.width = "100%";
				container.style.height = "600px";
				container.style.border =
					"1px solid var(--background-modifier-border)";
				container.style.borderRadius = "4px";
				container.style.overflow = "hidden";
				// Initialize Mind Elixir instance
				try {
					setTimeout(() => {
						const mind = new MindElixir({
							el: container,
							direction: MindElixir.RIGHT,
							editable: false,
							contextMenu: false,
							toolBar: false,
							keypress: false,
						});

						mind.init(mindData);
					}, 100);
				} catch (error) {
					console.error(
						"Error rendering mindelixir code block:",
						error,
					);
					container.createEl("p", {
						text: "Error rendering mind map. Check console for details.",
						cls: "mindelixir-error",
					});
				}
			},
		);
	}

	async onunload() {
		// Cleanup if needed
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData(),
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async activateView(file: TFile) {
		// Create a new leaf for the mindmap in split right mode
		const leaf = this.app.workspace.getLeaf("split", "vertical");

		await leaf.setViewState({
			type: VIEW_TYPE_MINDMAP,
			active: true,
			state: { filePath: file.path },
		});

		// Ensure settings are up to date in the view
		if (leaf.view instanceof MindMapView) {
			leaf.view.settings = this.settings;
		}

		// Reveal the leaf
		this.app.workspace.revealLeaf(leaf);
	}
}
