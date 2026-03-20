import { BlockEntity } from "@logseq/libs/dist/LSPlugin.user";

// --- Plaintext Generation from Blocks ---

export async function getPagePlaintext(blocks: BlockEntity[], pageTitle: string, h1AsRoot: boolean): Promise<string> {
    let lines: string[] = [];

    // Always output a root node first.
    // In our simplified logic, we just use the page title if no special root handling is needed.
    // If h1AsRoot is true, we could look for the first heading, but for Logseq outline,
    // usually the page title is the implicit root. 
    lines.push(`- ${pageTitle}`);

    if (blocks && blocks.length > 0) {
        processBlocksList(blocks, lines, 1);
    } else {
        // Fallback or empty page
        lines.push(`  - Empty`);
    }

    return lines.join('\n');
}

function processBlocksList(blocks: BlockEntity[], lines: string[], indentLevel: number) {
    const indent = "  ".repeat(indentLevel);
    
    for (const block of blocks) {
        if (!block || !block.content) continue;
        
        let content = block.content.trim();
        // Remove markdown headings if any, e.g. "### text" -> "text"
        content = content.replace(/^#+\s*/, '');
        
        // Use Logseq block ID as node ID to allow write back sync
        const blockId = block.uuid;
        
        // Output plaintext line
        lines.push(`${indent}- ${content} [^${blockId}]`);
        
        // Process children
        if (block.children && block.children.length > 0) {
            // Children can be full BlockEntities or just arrays of arrays (in some Logseq versions)
            // But getPageBlocksTree usually returns full entities
            const children = block.children as BlockEntity[];
            processBlocksList(children, lines, indentLevel + 1);
        }
    }
}

// --- Sync Plaintext Changes Back to Blocks ---
// mind-elixir/plaintextConverter converts tree to plaintext. 
// We parse our generated plaintext back to see what changed and apply it.

interface ParsedPlaintextNode {
    text: string;
    uuid: string | null;
    children: ParsedPlaintextNode[];
}

function parsePlaintextToTree(plaintext: string): ParsedPlaintextNode[] {
    const lines = plaintext.split('\n');
    const rootNodes: ParsedPlaintextNode[] = [];
    const stack: { level: number, node: ParsedPlaintextNode }[] = [];

    for (const line of lines) {
        if (line.trim() === '') continue;
        
        const matchSpaces = line.match(/^(\s*)/);
        const indentStr = matchSpaces ? matchSpaces[1] : '';
        const spacesCount = (indentStr || '').replace(/\t/g, '  ').length;
        const indentLevel = Math.floor(spacesCount / 2);
        
        const matchContent = line.trim().match(/^-\s*(.*?)(?:\s+\[\^([^\]]+)\])?$/);
        
        if (!matchContent) continue;
        
        const text = matchContent[1] ? matchContent[1].trim() : '';
        const uuid = matchContent[2] || null;
        
        const node: ParsedPlaintextNode = { text, uuid, children: [] };
        
        if (indentLevel === 0) {
            rootNodes.push(node);
            stack.length = 0;
            stack.push({ level: 0, node });
        } else {
            while (stack.length > 0) {
                const top = stack[stack.length - 1];
                if (top && top.level >= indentLevel) {
                    stack.pop();
                } else {
                    break;
                }
            }
            if (stack.length > 0) {
                const parent = stack[stack.length - 1];
                if (parent && parent.node && parent.node.children) {
                    parent.node.children.push(node);
                }
            }
            stack.push({ level: indentLevel, node });
        }
    }
    
    return rootNodes;
}

export async function plaintextToBlockUpdates(newPlaintext: string, pageUuid: string, h1AsRoot: boolean) {
    const rootNodes = parsePlaintextToTree(newPlaintext);
    if (!rootNodes || rootNodes.length === 0) return;
    
    const pageRoot = rootNodes[0];
    if (!pageRoot) return;
    
    // Pass parent uuid to be able to insert new blocks
    async function updateBlocksRecursively(nodes: ParsedPlaintextNode[], parentUuid: string) {
        // We track the last sibling to insert new blocks properly, but Logseq insertBlock with {sibling:false} adds as a child at the end.
        for (const node of nodes) {
            let currentUuid = node.uuid;
            
            if (currentUuid) {
                const existingBlock = await logseq.Editor.getBlock(currentUuid);
                // Update text if different
                if (existingBlock && existingBlock.content !== node.text) {
                    await logseq.Editor.updateBlock(currentUuid, node.text);
                }
            } else {
                // Newly created node in Mind Elixir! Add it to Logseq
                const newBlock = await logseq.Editor.insertBlock(parentUuid, node.text, { sibling: false });
                if (newBlock) {
                    currentUuid = newBlock.uuid;
                }
            }
            
            if (node.children && node.children.length > 0 && currentUuid) {
                await updateBlocksRecursively(node.children, currentUuid);
            }
        }
    }
    
    // For root level nodes, their parent is the page itself
    await updateBlocksRecursively(pageRoot.children, pageUuid);
}

