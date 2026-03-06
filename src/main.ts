import { Plugin, TFile } from "obsidian";
import { MindMapView, VIEW_TYPE_MINDMAP } from "./MindMapView";
import {
	MindMapSettings,
	DEFAULT_SETTINGS,
	MindMapSettingTab,
} from "./settings";
import MindElixir, { MindElixirInstance, Options } from "mind-elixir";
import { parsePlaintext } from "./parser";
import "mind-elixir/style.css";
import "./styles.css";
import { handleMindmapClick } from "./utils";

interface MindElixirContainer extends HTMLDivElement {
	mindElixirInstance?: MindElixirInstance;
}

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
			name: "Open",
			checkCallback: (checking: boolean) => {
				const file = this.app.workspace.getActiveFile();
				if (file) {
					if (!checking) {
						void this.activateView(file);
					}
					return true;
				}
				return false;
			},
		});

		// Optional: Ribbon icon
		this.addRibbonIcon("map", "Open as mind map", () => {
			const file = this.app.workspace.getActiveFile();
			if (file) {
				void this.activateView(file);
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
				container.setAttribute("data-ignore-swipe", "true");

				// Add click listener for internal links and nodes
				container.addEventListener("click", (e) => {
					handleMindmapClick(this.app, e, ctx.sourcePath);
				});

				// Initialize Mind Elixir instance
				try {
					setTimeout(() => {
						const isDark =
							document.body.classList.contains("theme-dark");
						const options: Options = {
							el: container,
							direction: MindElixir.RIGHT,
							editable: false,
							contextMenu: false,
							toolBar: false,
							keypress: false,
							theme: isDark
								? MindElixir.DARK_THEME
								: MindElixir.THEME,
						};
						const mind = new MindElixir(options);

						mind.init(mindData);
						(container as MindElixirContainer).mindElixirInstance =
							mind;
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

		// Listen to theme changes
		this.registerEvent(
			this.app.workspace.on("css-change", () => {
				const isDark = document.body.classList.contains("theme-dark");
				const theme = isDark ? MindElixir.DARK_THEME : MindElixir.THEME;

				document
					.querySelectorAll(".mindelixir-codeblock-container")
					.forEach((el) => {
						const mind = (el as MindElixirContainer)
							.mindElixirInstance;
						if (mind) {
							mind.changeTheme(theme);
						}
					});
			}),
		);
	}

	onunload() {
		// Cleanup if needed
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<MindMapSettings>,
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
		await this.app.workspace.revealLeaf(leaf);
	}
}
