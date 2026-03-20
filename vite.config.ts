import { defineConfig } from "vite";
import fs from "fs";
import path from "path";

// Plugin to copy and update package.json for dist/ folder
function copyPackagePlugin() {
	return {
		name: "copy-package",
		writeBundle() {
			const root = process.cwd();
			const dist = path.resolve(root, "dist");
			
			if (fs.existsSync(path.resolve(root, "package.json"))) {
				const pkg = JSON.parse(fs.readFileSync(path.resolve(root, "package.json"), "utf8"));
				if (pkg.main && pkg.main.startsWith("dist/")) {
					pkg.main = pkg.main.replace("dist/", "");
				}
				fs.writeFileSync(path.resolve(dist, "package.json"), JSON.stringify(pkg, null, 2));
			}
			
			const copyIfExists = (file: string) => {
				if (fs.existsSync(path.resolve(root, file))) {
					fs.copyFileSync(path.resolve(root, file), path.resolve(dist, file));
				}
			};
			copyIfExists("README.md");
			copyIfExists("README_zh.md");
			copyIfExists("LICENSE");
		}
	};
}

export default defineConfig({
	plugins: [copyPackagePlugin()],
	build: {
		target: "esnext",
		minify: "esbuild",
		outDir: "dist",
	},
	base: "./", // Important for Logseq iframe loading
});
