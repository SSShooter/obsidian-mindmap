/**
 * Post-migration parity: the migrated plugin parser vs the ORIGINAL parser.
 *
 * Both versions are taken from git (HEAD still holds the pre-migration
 * parser.ts) and run on identical input, comparing the resulting MindElixir data
 * node by node.
 *
 * Two environment obstacles, both handled here rather than by editing sources:
 *
 *   1. `utils.ts` imports `obsidian` at module scope, so a stub package is
 *      planted in the sandbox. The stub provides no `window.app`, which makes
 *      the wikilink/vault paths degrade to pass-through — identical for both
 *      versions, and the case that must match.
 *   2. The sources import TYPES with a value import (`import { MindElixirData }`).
 *      esbuild/tsc erase those; running the TS directly does not, so the runtime
 *      would demand exports that only exist in the .d.ts. Every file is routed
 *      through esbuild (already a devDependency) so the same erasure the real
 *      build performs happens here too.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import esbuild from "esbuild";

const REPO = path.resolve(new URL("..", import.meta.url).pathname);
const ORIG_PARSER = execFileSync("git", ["show", "HEAD:src/parser.ts"], {
	cwd: REPO,
	encoding: "utf8",
});
const ORIG_UTILS = execFileSync("git", ["show", "HEAD:src/utils.ts"], {
	cwd: REPO,
	encoding: "utf8",
});

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ob-parity-"));
const write = (rel, content) => {
	const p = path.join(tmp, rel);
	fs.mkdirSync(path.dirname(p), { recursive: true });
	fs.writeFileSync(p, content);
	return p;
};

// --- sandbox wiring --------------------------------------------------------
const obsidianStub = `
export const moment = { locale: () => "en" };
export class App {}
export class Plugin {}
export class PluginSettingTab {}
export class Setting {}
export class Modal {}
export class Notice {}
export class ItemView {}
export class MarkdownView {}
export class TFile {}
export class TFolder {}
export class Vault {}
export class MetadataCache {}
export const apiVersion = "1.12.0";
`;
write(
	"node_modules/obsidian/package.json",
	JSON.stringify({ name: "obsidian", version: "0.0.0", type: "module", main: "./i.mjs", exports: { ".": "./i.mjs" } }),
);
write("node_modules/obsidian/i.mjs", obsidianStub);

const realPkg = path.join(REPO, "node_modules/@mind-elixir/import-markdown");
write(
	"node_modules/@mind-elixir/import-markdown/package.json",
	JSON.stringify({ name: "@mind-elixir/import-markdown", version: "0.0.1", type: "module", main: "./i.mjs", exports: { ".": "./i.mjs" } }),
);
write(
	"node_modules/@mind-elixir/import-markdown/i.mjs",
	`export * from ${JSON.stringify(pathToFileURL(path.join(realPkg, "dist/index.js")).href)};\n`,
);

write("package.json", JSON.stringify({ name: "ob-parity", type: "module", private: true }));

// --- specifier rewriting ---------------------------------------------------
// `import.meta.resolve` is the ESM authority (require.resolve applies CJS rules
// and misses mind-elixir's "exports" subpaths, e.g. "./plaintextConverter").
const RESOLVE_BASE = pathToFileURL(REPO + path.sep);
const rewrite = code =>
	code.replace(/from\s*(["'])([^"'.][^"']*)\1/g, (m, q, spec) => {
		let r;
		try {
			r = import.meta.resolve(spec, RESOLVE_BASE);
		} catch {
			return m;
		}
		return `from ${q}${r}${q}`;
	});

const build = async (name, source, { utilsName }) => {
	const code = rewrite(
		source.replace(/from\s*(["'])\.\/utils\1/g, `from "./${utilsName}.mjs"`),
	);
	const { outputFiles } = await esbuild.build({
		stdin: {
			contents: code,
			resolveDir: tmp,
			sourcefile: `${name}.ts`,
			loader: "ts",
		},
		bundle: false,
		write: false,
		format: "esm",
		target: "es2022",
	});
	// Rewrite to the emitted JS sibling so the two files import each other.
	const out = outputFiles[0].text.replace(
		new RegExp(`\\./${utilsName}\\.mjs`, "g"),
		`./${utilsName}.mjs`,
	);
	const p = write(`${name}.mjs`, out);
	return p;
};

const origUtilsMjs = await build("original-utils", ORIG_UTILS, { utilsName: "original-utils" });
const migUtilsMjs = await build("migrated-utils", fs.readFileSync(path.join(REPO, "src/utils.ts"), "utf8"), {
	utilsName: "migrated-utils",
});
const origParserMjs = await build("original-parser", ORIG_PARSER, { utilsName: "original-utils" });
const migParserMjs = await build(
	"migrated-parser",
	fs.readFileSync(path.join(REPO, "src/parser.ts"), "utf8"),
	{ utilsName: "migrated-utils" },
);
void origUtilsMjs;
void migUtilsMjs;

const { parseMarkdown: original } = await import(pathToFileURL(origParserMjs).href);
const { parseMarkdown: migrated } = await import(pathToFileURL(migParserMjs).href);

// --- comparison ------------------------------------------------------------
/**
 * Fold random ids and object key order.
 *
 * Random ids become positional anchors; offset-derived ids (deterministic per
 * document) are kept because they mark source positions. Keys are sorted so
 * that `{topic,id}` and `{id,topic}` compare equal — the two implementations
 * build their objects in different orders, which is a construction detail, not
 * a behaviour difference.
 */
const norm = (node, map = new Map()) => {
	if (Array.isArray(node)) return node.map(n => norm(n, map));
	if (!node || typeof node !== "object") return node;
	const out = {};
	for (const k of Object.keys(node).sort()) {
		const v = node[k];
		if (k === "id") {
			const s = String(v);
			if (/^\d+$/.test(s)) {
				out[k] = s;
				continue;
			}
			if (!map.has(s)) map.set(s, `#g${map.size + 1}#`);
			out[k] = map.get(s);
			continue;
		}
		out[k] = norm(v, map);
	}
	return out;
};
const fp = d => JSON.stringify(norm(d));

const DOCS = {
	"plain paragraph": "just a paragraph\n",
	"heading tree": "# T\n\n## A\n\ntext a\n\n### A1\n\ndeep\n\n## B\n\ntext b\n",
	"paragraph then list": "intro para\n\n- one\n- two\n\n## After\n\ntail\n",
	"list under heading": "## Section\n\n- one\n- two\n\ntail paragraph\n",
	"nested list": "- one\n  - one.a\n  - one.b\n- two\n",
	"inline markdown": "## Formatting\n\n**bold** and `code` and [link](https://example.com)\n",
	"gfm table": "## T\n\n| a | b |\n| - | - |\n| 1 | 2 |\n",
	wikilink: "## L\n\nsee [[Some Note]] and [[Target|Alias]]\n",
	"wikilink image": "## I\n\n![[pic.png]]\n",
	"image with size alt": "## Img\n\n![shot|300x200|Alt text](a.png)\n",
	math: "## M\n\ninline $x^2$ and display $$y = mx$$\n",
	"html passthrough": "## H\n\n<div>raw <b>html</b></div>\n",
	frontmatter: "---\ntitle: From Frontmatter\ntags: [a]\n---\n\n## Body\n\ntext\n",
	"thematic break": "## A\n\ntext a\n\n---\n\n## B\n\ntext b\n",
	empty: "",
	"code block": "## Code\n\n```js\nconst a = 1\n```\n",
	blockquote: "## Q\n\n> quoted text\n",
	"deep nest": "## A\n\n### B\n\n#### C\n\n##### D\n\ndeep text\n",
	"list then heading": "- x\n- y\n\n## After\n\ntext\n",
};

const CASES = [];
for (const [name, md] of Object.entries(DOCS)) {
	CASES.push({ label: name, md, h1AsRoot: false });
	CASES.push({ label: `${name} (h1AsRoot)`, md, h1AsRoot: true });
}

/**
 * Differences that are intentional improvements in the shared package, each
 * traced to a concrete defect in the original Obsidian implementation. Matched
 * by substring against the collected diff lines.
 */
const ALLOWED = [
	{
		match: "root.nodeData.topic: undefined vs",
		reason:
			"BUG FIX. The original read `heading.value`, which mdast headings do not have (text lives in children), so with h1AsRoot the root topic came out `undefined`. The package extracts the text properly.",
	},
	{
		match: "children[0].id: missing in original",
		reason:
			"COMPLETENESS. For a top-level `list` node the original hit an early `continue` and never assigned an `id`; the package assigns one. mind-elixir needs `id` on every node.",
	},
	{
		match: "children[0].children[0].id: missing in original",
		reason:
			"COMPLETENESS. Same early-`continue` path: list nodes produced under a heading also lacked `id` in the original.",
	},
];

/** A case is explained when every one of its diff lines is covered by a rule. */
const coverOf = d => {
	const rules = ALLOWED.filter(a => d.d.some(line => line.includes(a.match)));
	const covered = d.d.filter(line => rules.some(a => line.includes(a.match)));
	return { rules, allCovered: covered.length === d.d.length };
};

let same = 0;
const unexplained = [];
const explained = [];
console.log("# post-migration parity: migrated parser vs git HEAD parser\n");

/** Collect the first few structural mismatches, by JSON path. */
const findDiffs = (a, b, p = "", acc = []) => {
	if (acc.length >= 6) return acc;
	if (Array.isArray(a) || Array.isArray(b)) {
		if (!Array.isArray(a) || !Array.isArray(b)) {
			acc.push(`${p}: ${Array.isArray(a) ? "array" : "not array"} vs ${Array.isArray(b) ? "array" : "not array"}`);
			return acc;
		}
		if (a.length !== b.length) {
			acc.push(`${p}: length ${a.length} vs ${b.length}`);
			return acc;
		}
		a.forEach((v, i) => findDiffs(v, b[i], `${p}[${i}]`, acc));
		return acc;
	}
	if (a && b && typeof a === "object" && typeof b === "object") {
		const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
		for (const k of keys) {
			if (!(k in a)) {
				acc.push(`${p}.${k}: missing in original`);
				continue;
			}
			if (!(k in b)) {
				acc.push(`${p}.${k}: missing in migrated`);
				continue;
			}
			findDiffs(a[k], b[k], `${p}.${k}`, acc);
			if (acc.length >= 6) return acc;
		}
		return acc;
	}
	if (a !== b) acc.push(`${p}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
	return acc;
};

for (const c of CASES) {
	const ao = norm(original(c.md, "note.md", c.h1AsRoot, "vault/note.md"));
	const bo = norm(migrated(c.md, "note.md", c.h1AsRoot, "vault/note.md"));
	const a = JSON.stringify(ao);
	const b = JSON.stringify(bo);
	if (a === b) same++;
	else {
		const d = { ...c, ao, bo, d: findDiffs(ao, bo, "root") };
		const { rules, allCovered } = coverOf(d);
		if (allCovered) explained.push({ d, allowed: rules });
		else unexplained.push(d);
	}
}

console.log(`${same}/${CASES.length} identical, ${explained.length} explained difference(s), ${unexplained.length} unexplained\n`);
for (const { d, allowed } of explained) {
	console.log(`DIFF ${d.label}`);
	for (const line of d.d) console.log(`   ${line}`);
	for (const a of allowed) console.log(`   => ${a.reason}`);
	console.log("");
}
for (const d of unexplained) {
	console.log(`UNEXPLAINED ${d.label}`);
	for (const line of d.d) console.log(`   ${line}`);
	console.log("");
}
console.log(
	unexplained.length === 0
		? "PARITY: migration changed nothing beyond the signed-off improvements"
		: `PARITY: ${unexplained.length} unexplained difference(s)`,
);
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(unexplained.length === 0 ? 0 : 1);
