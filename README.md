# Obsidian Mind Map

An intuitive mind map plugin for Obsidian that transforms your markdown documents into interactive mind maps using [Mind Elixir](https://github.com/ssshooter/mind-elixir-core).

## Features

### Mind Map View

- **Open as Mind Map**: Transform any markdown file into an interactive mind map view
- **Smart Parsing**: Automatically parses markdown headers and lists into hierarchical mind map nodes
- **Split View**: Opens mind maps in a split pane while preserving your original document
- **Auto-Refresh**: Mind map updates automatically when the source file changes
- **Customizable Root**: Choose between using the filename or the first H1 heading as the root node

### Code Block Rendering

- **Inline Mind Maps**: Embed mind maps directly in your notes using `mindelixir` code blocks
- **Plain Text Format**: Use simple indented text format for quick mind map creation
- **Non-Intrusive**: Mind maps render seamlessly within your markdown content

## Usage

### Method 1: Mind Map View

1. Open any markdown file in Obsidian
2. Click the mind map icon in the ribbon, or
3. Use the command palette: `Mind Map: Open as Mind Map`
4. Your markdown content will open as an interactive mind map in a split pane

### Method 2: Code Blocks

Create inline mind maps using the `mindelixir` code block:

````markdown
```mindelixir
Root Topic
  Subtopic 1
    Detail 1
    Detail 2
  Subtopic 2
    Detail 3
```
````

## Settings

- **Use first H1 as root**: When enabled, uses the first H1 heading as the root node instead of the filename. Content before the first H1 will be ignored.

## First time developing plugins?

Quick starting guide for new plugin devs:

- Check if [someone already developed a plugin for what you want](https://obsidian.md/plugins)! There might be an existing plugin similar enough that you can partner up with.
- Make a copy of this repo as a template with the "Use this template" button (login to GitHub if you don't see it).
- Clone your repo to a local development folder. For convenience, you can place this folder in your `.obsidian/plugins/your-plugin-name` folder.
- Install NodeJS, then run `npm i` in the command line under your repo folder.
- Run `npm run dev` to compile your plugin from `main.ts` to `main.js`.
- Make changes to `main.ts` (or create new `.ts` files). Those changes should be automatically compiled into `main.js`.
- Reload Obsidian to load the new version of your plugin.
- Enable plugin in settings window.
- For updates to the Obsidian API run `npm update` in the command line under your repo folder.

## Releasing new releases

- Update your `manifest.json` with your new version number, such as `1.0.1`, and the minimum Obsidian version required for your latest release.
- Update your `versions.json` file with `"new-plugin-version": "minimum-obsidian-version"` so older versions of Obsidian can download an older version of your plugin that's compatible.
- Create new GitHub release using your new version number as the "Tag version". Use the exact version number, don't include a prefix `v`. See here for an example: https://github.com/obsidianmd/obsidian-sample-plugin/releases
- Upload the files `manifest.json`, `main.js`, `styles.css` as binary attachments. Note: The manifest.json file must be in two places, first the root path of your repository and also in the release.
- Publish the release.

> You can simplify the version bump process by running `npm version patch`, `npm version minor` or `npm version major` after updating `minAppVersion` manually in `manifest.json`.
> The command will bump version in `manifest.json` and `package.json`, and add the entry for the new version to `versions.json`

## Adding your plugin to the community plugin list

- Check the [plugin guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines).
- Publish an initial version.
- Make sure you have a `README.md` file in the root of your repo.
- Make a pull request at https://github.com/obsidianmd/obsidian-releases to add your plugin.

## How to use

- Clone this repo.
- Make sure your NodeJS is at least v16 (`node --version`).
- `npm i` or `yarn` to install dependencies.
- `npm run dev` to start compilation in watch mode.

## Manually installing the plugin

- Copy over `main.js`, `styles.css`, `manifest.json` to your vault `VaultFolder/.obsidian/plugins/your-plugin-id/`.

## Improve code quality with eslint

- [ESLint](https://eslint.org/) is a tool that analyzes your code to quickly find problems. You can run ESLint against your plugin to find common bugs and ways to improve your code.
- This project already has eslint preconfigured, you can invoke a check by running`npm run lint`
- Together with a custom eslint [plugin](https://github.com/obsidianmd/eslint-plugin) for Obsidan specific code guidelines.
- A GitHub action is preconfigured to automatically lint every commit on all branches.

## Funding URL

You can include funding URLs where people who use your plugin can financially support it.

The simple way is to set the `fundingUrl` field to your link in your `manifest.json` file:

```json
{
	"fundingUrl": "https://buymeacoffee.com"
}
```

If you have multiple URLs, you can also do:

```json
{
	"fundingUrl": {
		"Buy Me a Coffee": "https://buymeacoffee.com",
		"GitHub Sponsor": "https://github.com/sponsors",
		"Patreon": "https://www.patreon.com/"
	}
}
```

## API Documentation

See https://docs.obsidian.md
