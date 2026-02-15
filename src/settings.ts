import { App, PluginSettingTab, Setting } from "obsidian";
import MyPlugin from "./main";

export interface MindMapSettings {
	h1AsRoot: boolean;
}

export const DEFAULT_SETTINGS: MindMapSettings = {
	h1AsRoot: false,
};

export class MindMapSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Use first H1 as root")
			.setDesc(
				"When enabled, uses the first H1 heading as the root node instead of the filename. Content before the first H1 will be ignored.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.h1AsRoot)
					.onChange(async (value) => {
						this.plugin.settings.h1AsRoot = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
