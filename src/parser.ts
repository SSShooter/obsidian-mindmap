import { MindElixirData, NodeObj } from "mind-elixir";
import { plaintextToMindElixir } from "mind-elixir/plaintextConverter";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import type { Root, List, Parent } from "mdast";

const htmlProcessor = unified().use(remarkRehype).use(rehypeStringify);

export function replaceObsidianLinks(htmlStr: string): string {
	return htmlStr.replace(/\[\[(.*?)\]\]/g, (match: string, p1: string) => {
		const display = p1?.includes("|") ? p1.split("|")[1] : p1;
		const href = p1?.split("|")[0];
		return `<a class="internal-link" data-href="${href}">${display}</a>`;
	});
}

interface TreeItem {
	children: TreeItem[];
	object: Parent & { depth?: number };
	parent: TreeItem | null;
	type: string;
}

function generateId(): string {
	return Math.random().toString(36).substring(2, 11);
}

/**
 * Parse markdown content using remark AST
 */
export function parseMarkdown(
	content: string,
	filename: string,
	h1AsRoot: boolean = false,
): MindElixirData {
	try {
		// Parse markdown to AST
		const ast = unified().use(remarkParse).use(remarkGfm).parse(content);
		// Build tree structure from AST
		const tree = markdownAstToTree(ast);

		let nodes: NodeObj[];
		let rootTopic = filename;

		if (h1AsRoot) {
			const h1Index = tree.children.findIndex(
				(child) => child.type === "heading" && child.object.depth === 1,
			);
			if (h1Index !== -1) {
				const h1 = tree.children[h1Index]!;
				// rootTopic = extractText(h1.object);
				rootTopic = (h1.object as unknown as NodeWithContent).value!;
				nodes = treeToMindElixir(h1.children);
			} else {
				nodes = treeToMindElixir(tree.children);
			}
		} else {
			nodes = treeToMindElixir(tree.children);
		}

		// Return with filename (or H1) as root
		return {
			nodeData: {
				id: generateId(),
				topic: rootTopic,
				children: nodes,
			},
		};
	} catch (e) {
		console.error("Markdown parse error", e);
		// Fallback to empty structure
		return {
			nodeData: {
				id: generateId(),
				topic: filename,
				children: [],
			},
		};
	}
}

/**
 * Convert markdown AST to tree structure
 * This handles the hierarchy based on headings
 */
function markdownAstToTree(ast: Root): TreeItem {
	const children = ast.children;
	const treeItem: TreeItem = {
		type: "root",
		children: [],
		object: ast,
		parent: null,
	};

	let current = treeItem;
	for (let i = 0; i < children.length; i++) {
		const child = children[i];
		if (!child) continue;
		if (child.type === "thematicBreak") {
			continue;
		}
		if (child.type === "heading") {
			const heading = child;
			const data: TreeItem = {
				type: heading.type,
				object: heading,
				parent: current,
				children: [],
			};

			// Adjust hierarchy based on heading depth
			if (heading.depth > (current.object.depth || 0)) {
				current.children.push(data);
				current = data;
			} else {
				// Go up the tree to find the right parent
				while (
					heading.depth <= (current.object.depth || 0) &&
					current.parent
				) {
					current = current.parent;
				}
				current.children.push(data);
				current = data;
			}
		} else {
			// For non-heading content (paragraphs, lists, code, etc.)
			const data: TreeItem = {
				type: child.type,
				object: child as Parent,
				parent: current,
				children: [],
			};
			current.children.push(data);
		}
	}

	return treeItem;
}

/**
 * Process a list into MindElixir node structure
 */
function processList(list: List): NodeObj[] {
	return list.children.map((listItem) => {
		const result: NodeObj = {
			topic: "",
			id: generateId(),
			children: [],
		};

		// children[0] is always the content node (paragraph, etc.)
		const contentNode = listItem.children[0];
		// children[1] is the nested list, if any
		const nestedList = listItem.children[1];

		if (contentNode) {
			try {
				const hastNode = htmlProcessor.runSync(
					contentNode as unknown as Root,
				);
				const htmlStr = htmlProcessor.stringify(hastNode);
				if (typeof htmlStr === "string") {
					result.dangerouslySetInnerHTML =
						replaceObsidianLinks(htmlStr);
				}
			} catch (e) {
				console.error("HTML conversion error", e);
			}
		}

		if (nestedList && nestedList.type === "list") {
			result.children = processList(nestedList);
		}

		return result;
	});
}

interface NodeWithContent {
	type: string;
	value?: string;
	children?: NodeWithContent[];
}

/**
 * Convert tree structure to MindElixir format
 * This implements the key feature: merging lists into preceding content
 */
function treeToMindElixir(items: TreeItem[]): NodeObj[] {
	const nodes: NodeObj[] = [];
	if (items.length === 1 && items[0]!.type === "list") {
		return processList(items[0]!.object as List);
	}
	for (let i = 0; i < items.length; i++) {
		const item = items[i]!;
		const node = {} as NodeObj;
		nodes.push(node);
		if (item.type === "list") {
			node.children = processList(item.object as List);
			node.topic = "List";
			continue;
		} else {
			if (item.type === "html") {
				node.dangerouslySetInnerHTML = (
					item.object as NodeWithContent
				).value;
			} else {
				try {
					const hastNode = htmlProcessor.runSync(
						item.object as unknown as Root,
					);
					const htmlStr = htmlProcessor.stringify(hastNode);
					if (typeof htmlStr === "string") {
						node.dangerouslySetInnerHTML =
							replaceObsidianLinks(htmlStr);
					}
				} catch (e) {
					console.error("HTML conversion error", e);
				}
			}
		}

		// Generate ID
		node.id =
			item.object.position?.start?.offset?.toString() || generateId();

		// KEY FEATURE: Merge following lists into preceding content
		const next = items[i + 1];
		// If the next sibling is a list, merge it as children of current item
		if (next && next.type === "list") {
			node.children = processList(next.object as List);
			// Remove the list from siblings (it's now a child)
			items.splice(i + 1, 1);
		} else {
			// Recursively process children
			node.children = treeToMindElixir(item.children);
		}
	}
	return nodes;
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
			id: generateId(),
			topic: filename,
			children: [],
		},
	};
}
