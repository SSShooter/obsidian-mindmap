import { MindElixirData } from "mind-elixir";
import { plaintextToMindElixir } from "mind-elixir/plaintextConverter";

export function parseMarkdown(
	content: string,
	filename: string,
): MindElixirData {
	const lines = content.split(/\r?\n/);
	const rootId = generateId();
	// Root node is the filename
	const root: any = { id: rootId, topic: filename, children: [] };
	const stack: { level: number; node: any }[] = [{ level: 0, node: root }];

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue;

		let level = -1;
		let topic = "";

		// Header parsing
		if (line.match(/^#+\s/)) {
			const match = line.match(/^(#+)\s+(.*)/);
			if (match && match[1]) {
				level = match[1].length;
				topic = match[2] || "";
			}
		}
		// List parsing
		else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
			const indent = line.search(/\S/);
			level = Math.floor(indent / 2) + 1;
			topic = trimmed.substring(2);
		}

		if (level === -1 || !topic) continue;

		const newNode = {
			id: generateId(),
			topic: topic,
			children: [],
		};

		// Find correct parent
		while (stack.length > 1) {
			const top = stack[stack.length - 1];
			if (top && top.level >= level) {
				stack.pop();
			} else {
				break;
			}
		}

		const parent = stack[stack.length - 1]?.node;
		if (parent) {
			parent.children.push(newNode);
			stack.push({ level, node: newNode });
		}
	}

	return { nodeData: root };
}

export function parsePlaintext(
	content: string,
	filename: string,
): MindElixirData {
	try {
		// Use the library's converter
		const data = plaintextToMindElixir(content);
		// data.nodeData is the root.
		// If we want to use filename as root, we should wrap it or rename it?
		// Skill says: "Root node starts with - ".
		// User request: "Root node use filename".
		// If I rename the root topic to filename, I lose the original root topic if provided.
		// But in Plaintext format, the first line IS the root.
		// If the user inputs:
		// - My Map
		//   - Child
		// And filename is "Doc1".
		// Should Root be "Doc1" or "My Map"?
		// Request: "根节点使用文件名" (Root node use filename).
		// So I should override the topic of the root node to be the filename.
		if (data && data.nodeData) {
			data.nodeData.topic = filename;
			return data;
		}
	} catch (e) {
		console.error("Plaintext parse error", e);
	}

	// Fallback to basic if empty or failed, but still return root with filename
	return {
		nodeData: {
			id: generateId(),
			topic: filename,
			children: [],
		},
	};
}

function generateId(): string {
	return Math.random().toString(36).substr(2, 9);
}
