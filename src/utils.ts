import { App, moment } from "obsidian";
import * as mindElixirI18n from "mind-elixir/i18n";

export function getMindElixirLocale(): mindElixirI18n.LangPack {
	const obLocale = moment.locale();
	if (obLocale === "zh-cn") return mindElixirI18n.zh_CN;
	if (obLocale === "zh-tw") return mindElixirI18n.zh_TW;
	
	const key = obLocale.replace(/-/g, "_");
	if (Object.prototype.hasOwnProperty.call(mindElixirI18n, key)) {
		const langPack = (mindElixirI18n as Record<string, mindElixirI18n.LangPack>)[key];
		if (langPack) return langPack;
	}
	
	return mindElixirI18n.en;
}


export function handleMindmapClick(
	app: App,
	e: MouseEvent,
	sourcePath: string,
) {
	const target = e.target as HTMLElement;

	// If an internal link was clicked
	const internalLink = target.closest(".internal-link") as HTMLElement;
	if (internalLink && internalLink.dataset.href) {
		void app.workspace.openLinkText(
			internalLink.dataset.href,
			sourcePath,
			true,
		);
		e.preventDefault();
		e.stopPropagation();
		return;
	}
}
