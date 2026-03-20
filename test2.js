function parsePlaintextToTree(plaintext) {
    const lines = plaintext.split('\n');
    const rootNodes = [];
    const stack = [];

    for (const line of lines) {
        if (line.trim() === '') continue;
        
        // matchSpaces can be null/undefined if it doesn't match
        const matchSpaces = line.match(/^(\s*)/);
        const indentLevel = (matchSpaces && matchSpaces[1]) ? matchSpaces[1].length / 2 : 0;
        
        // Regex to extract content and optional UUID mapping [^uuid]
        // Example: "- Topic text [^uuid123]"
        const matchContent = line.trim().match(/^-\s*(.*?)(?:\s+\[\^([^\]]+)\])?$/);
        
        if (!matchContent) continue;
        
        const text = matchContent[1] ? matchContent[1].trim() : '';
        const uuid = matchContent[2] || null;
        
        const node = { text, uuid, children: [] };
        
        if (indentLevel === 0) {
            // Root node (we usually skip writing back the root as it's the page title)
            rootNodes.push(node);
            stack.length = 0; // Clear stack
            stack.push({ level: 0, node });
        } else {
            // Find parent
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

const plaintext = `- Page Title\n  - First node [^uuid-1234]\n    - Child node [^uuid-5678]`;
console.log(JSON.stringify(parsePlaintextToTree(plaintext), null, 2));
