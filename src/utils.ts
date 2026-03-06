import { App } from "obsidian";

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
