import { MindElixirData, NodeObj } from "mind-elixir";
import { plaintextToMindElixir } from "mind-elixir/plaintextConverter";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import type { Root, Heading, List, Paragraph, Blockquote, Parent } from "mdast";

interface TreeItem {
	children: TreeItem[];
	object: Parent & { depth?: number };
	parent: TreeItem | null;
	type: string;
}

function generateId(): string {
	return Math.random().toString(36).substr(2, 9);
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
				(child) =>
					child.type === "heading" &&
					(child.object as Heading).depth === 1,
			);
			if (h1Index !== -1) {
				const h1 = tree.children[h1Index]!;
				rootTopic = extractText(h1.object);
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

		if (child.type === "heading") {
			const heading = child as Heading;
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
			if ("children" in child) {
				const data: TreeItem = {
					type: child.type,
					object: child,
					parent: current,
					children: [],
				};
				current.children.push(data);
			}
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

		// Process each child of the list item
		for (const child of listItem.children) {
			if (child.type === "paragraph") {
				// Extract text from paragraph
				const paragraph = child as Paragraph;
				result.topic = extractText(paragraph);
			} else if (child.type === "list") {
				// Nested list
				result.children = processList(child as List);
			}
		}

		return result;
	});
}

/**
 * Extract plain text from a node
 */
function extractText(node: any): string {
	let text = "";

	if (node.type === "text") {
		return node.value;
	}

	if (node.children) {
		for (const child of node.children) {
			text += extractText(child);
		}
	}

	if (node.type === "inlineCode") {
		return `\`${node.value}\``;
	}

	if (node.type === "code") {
		return node.value;
	}

	return text;
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
			console.log(item);
			node.topic = extractText(item.object);
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
		const data = plaintextToMindElixir(content);
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
