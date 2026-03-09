# Obsidian Mind Map

An intuitive mind map plugin for Obsidian that transforms your markdown documents into interactive mind maps using [Mind Elixir](https://github.com/ssshooter/mind-elixir-core).

## Features

### Mind Map View

![Mind Map View](./screenshots/ob-mindmap-open-mindmap.jpg)

- **Open as Mind Map**: Transform any markdown file into an interactive mind map view
- **Smart Parsing**: Automatically parses markdown headers and lists into hierarchical mind map nodes
- **Split View**: Opens mind maps in a split pane while preserving your original document
- **Auto-Refresh**: Mind map updates automatically when the source file changes
- **Customizable Root**: Choose between using the filename or the first H1 heading as the root node

### Code Block Rendering

![Code Block Rendering](./screenshots/ob-mindelixir-codeblock.gif)

- **Inline Mind Maps**: Embed mind maps directly in your notes using `mindelixir` code blocks
- **Plain Text Format**: Use simple indented text format for quick mind map creation
- **Non-Intrusive**: Mind maps render seamlessly within your markdown content

### Mobile Support

![Mobile Support](./screenshots/ob-mindmap-mobile.jpg)

- **Works on Mobile**: Fully functional on Obsidian's mobile app, allowing you to view and interact with mind maps on the go

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

For the specific format specification, please refer to the [Mind Elixir Plain Text Format Reference](https://github.com/SSShooter/mind-elixir-core/blob/master/skills/plaintext-format/SKILL.md).

## Settings

- **Use first H1 as root**: When enabled, uses the first H1 heading as the root node instead of the filename. Content before the first H1 will be ignored.

## Manually installing the plugin

- Copy over `main.js`, `styles.css`, `manifest.json` to your vault `VaultFolder/.obsidian/plugins/your-plugin-id/`.

## TODO

- Support node copy and paste
- Support reverse edit in `mindelixir` code block
- Record links delta if modified
