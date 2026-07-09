import { App, moment } from "obsidian";
import katex from "katex";
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

export function getApp(): App | undefined {
	if (typeof window !== "undefined" && "app" in window) {
		return (window as unknown as { app: App }).app;
	}
	return undefined;
}

export function parseImageSizeAndAlt(displayOrAlt: string): {
	width: string;
	height: string;
	alt: string;
} {
	const parts = displayOrAlt.split("|").map(p => p.trim());
	let width = "";
	let height = "";
	let alt = "";

	if (parts.length > 0) {
		const lastPart = parts[parts.length - 1];
		if (lastPart) {
			if (/^\d+$/.test(lastPart)) {
				width = lastPart;
				alt = parts.slice(0, -1).join("|");
			} else if (/^\d+x\d+$/.test(lastPart)) {
				const [w, h] = lastPart.split("x");
				if (w && h) {
					width = w;
					height = h;
				}
				alt = parts.slice(0, -1).join("|");
			} else {
				alt = parts.join("|");
			}
		}
	}
	return { width, height, alt };
}

export function replaceObsidianImageEmbeds(
	htmlStr: string,
	sourcePath?: string,
): string {
	return htmlStr.replace(/!\[\[(.*?)\]\]/g, (match: string, p1: string) => {
		const parts = p1.split("|");
		const linkpath = parts[0]?.trim();
		const app = getApp();
		if (app && sourcePath && linkpath) {
			const file = app.metadataCache.getFirstLinkpathDest(linkpath, sourcePath);
			if (file) {
				const src = app.vault.getResourcePath(file);
				let widthAttr = "";
				let heightAttr = "";
				let altAttr = "";
				if (parts.length > 1) {
					const displayString = parts.slice(1).join("|");
					const { width, height, alt } = parseImageSizeAndAlt(displayString);
					if (width) widthAttr = ` width="${width}"`;
					if (height) heightAttr = ` height="${height}"`;
					if (alt) altAttr = ` alt="${alt}"`;
				}
				return `<img src="${src}"${widthAttr}${heightAttr}${altAttr}>`;
			}
		}
		return match;
	});
}

export function replaceObsidianLinks(htmlStr: string): string {
	return htmlStr.replace(/\[\[(.*?)\]\]/g, (_match: string, p1: string) => {
		const display = p1?.includes("|") ? p1.split("|")[1] : p1;
		const href = p1?.split("|")[0];
		return `<a class="internal-link" data-href="${href}">${display}</a>`;
	});
}

export function resolveHtmlImages(
	htmlStr: string,
	sourcePath?: string,
): string {
	const app = getApp();
	if (!app || !sourcePath) return htmlStr;
	return htmlStr.replace(/<img\s+([^>]*?)src=["']([^"']+)["']([^>]*?)>/g, (imgTag: string, beforeSrc: string, src: string, afterSrc: string) => {
		if (/^(https?:\/\/|data:|app:\/\/)/i.test(src)) {
			return imgTag;
		}
		const decodedSrc = decodeURIComponent(src);
		const file = app.metadataCache.getFirstLinkpathDest(decodedSrc, sourcePath);
		if (file) {
			const resourcePath = app.vault.getResourcePath(file);
			return `<img ${beforeSrc}src="${resourcePath}"${afterSrc}>`;
		}
		return imgTag;
	});
}

export function resolveImageSizes(htmlStr: string): string {
	return htmlStr.replace(/<img\s+([^>]*?)>/g, (imgTag: string, attributes: string) => {
		const altMatch = attributes.match(/alt=["']([^"']*)["']/);
		if (altMatch) {
			const fullAlt = altMatch[1];
			if (fullAlt) {
				const { width, height, alt } = parseImageSizeAndAlt(fullAlt);
				if (width || height) {
					let newAttrs = attributes.replace(/alt=["']([^"']*)["']/, `alt="${alt}"`);
					if (width && !/width=/i.test(newAttrs)) {
						newAttrs += ` width="${width}"`;
					}
					if (height && !/height=/i.test(newAttrs)) {
						newAttrs += ` height="${height}"`;
					}
					return `<img ${newAttrs.trim()}>`;
				}
			}
		}
		return imgTag;
	});
}

export function renderMath(text: string): string {
	let parsedText = text;
	// Handle display math ($$...$$)
	parsedText = parsedText.replace(/\$\$([^$]+)\$\$/g, (_, math: string) => {
		return katex.renderToString(math.trim(), { displayMode: true, output: 'html', throwOnError: false });
	});

	// Handle inline math ($...$)
	parsedText = parsedText.replace(/\$([^$]+)\$/g, (_, math: string) => {
		return katex.renderToString(math.trim(), { displayMode: false, output: 'html', throwOnError: false });
	});
	return parsedText;
}

export function processMarkdownContent(
	text: string,
	sourcePath?: string,
): string {
	let processed = text;

	// Convert standard Markdown image syntax `![alt](path)` to `<img>` tags
	processed = processed.replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1">');

	// Convert standard Markdown link syntax `[display](href)` to `<a>` tags
	processed = processed.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');

	// Process Obsidian wikilink image embeds `![[image.png]]`
	processed = replaceObsidianImageEmbeds(processed, sourcePath);

	// Process Obsidian wikilinks `[[link]]`
	processed = replaceObsidianLinks(processed);

	// Resolve relative/vault image paths in any `<img>` tags
	processed = resolveHtmlImages(processed, sourcePath);

	// Resolve image sizes from their alt attributes
	processed = resolveImageSizes(processed);

	// Process LaTeX Math
	processed = renderMath(processed);

	return processed;
}
