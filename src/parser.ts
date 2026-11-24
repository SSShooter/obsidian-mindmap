import { MindElixirData } from "mind-elixir";
import { plaintextToMindElixir } from "mind-elixir/plaintextConverter";
import { parseMarkdown as parseMarkdownDoc } from "@mind-elixir/import-markdown";
import { processMarkdownContent, replaceObsidianLinks } from "./utils";

export { replaceObsidianLinks };

/**
 * Parse markdown content into MindElixir data.
 *
 * The markdown -> MindElixir conversion itself lives in
 * `@mind-elixir/import-markdown`, shared with the VSCode extension
 * (`mark-elixir`). Everything Obsidian-specific — wikilinks, KaTeX, vault
 * attachment resolution, image sizing from alt text — arrives through the
 * package's `transformHtml` hook, which runs after remark-rehype produces a
 * node's HTML and before it becomes `dangerouslySetInnerHTML`.
 *
 * That hook is the single seam: the package has no knowledge of Obsidian, and
 * this module has no knowledge of remark.
 */
export function parseMarkdown(
	content: string,
	filename: string,
	h1AsRoot: boolean = false,
	sourcePath?: string,
): MindElixirData {
	try {
		return parseMarkdownDoc(content, {
			filename,
			h1AsRoot,
			// Obsidian notes are parsed with the frontmatter block removed and
			// its content discarded; the note's basename is the root topic.
			frontmatter: "strip",
			transformHtml: (html) => processMarkdownContent(html, sourcePath),
		});
	} catch (e) {
		console.error("Markdown parse error", e);
		// Fallback to empty structure
		return {
			nodeData: {
				id: Math.random().toString(36).substring(2, 11),
				topic: filename,
				children: [],
			},
		};
	}
}

export function parsePlaintext(
	content: string,
	filename: string,
): MindElixirData {
	try {
		// Use the library's converter
		const data = plaintextToMindElixir(content, filename);
		return data;
	} catch (e) {
		console.error("Plaintext parse error", e);
	}

	// Fallback to basic if empty or failed
	return {
		nodeData: {
			id: Math.random().toString(36).substring(2, 11),
			topic: filename,
			children: [],
		},
	};
}
