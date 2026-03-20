import "@logseq/libs";
import { settingsSchema } from "./settings";
import { setupMindmapUI } from "./mindmap-ui";

async function main() {
  console.log("Mind Elixir plugin loaded");
  logseq.useSettingsSchema(settingsSchema);

  // Set up the UI html for the iframe
  setupMindmapUI();

  // Register slash command to open current page as mindmap
  logseq.Editor.registerSlashCommand(
    "Open as mind map",
    async () => {
      const page = await logseq.Editor.getCurrentPage();
      if (!page) {
        logseq.UI.showMsg("Please open a page first to view as mind map.", "warning");
        return;
      }
      
      // Send message to iframe to open mind map
      logseq.showMainUI();
      // Wait a tick for UI to show
      setTimeout(() => {
        window.postMessage({
          type: "open-mindmap",
          pageName: page.originalName,
          pageUuid: page.uuid
        }, "*");
      }, 100);
    }
  );

  // Add toolbar button as well
  logseq.App.registerUIItem("toolbar", {
    key: "open-mindmap",
    template: `
      <a class="button" data-on-click="openMindMap" title="Open as mind map">
        <i class="ti ti-map"></i>
      </a>
    `,
  });

  logseq.provideModel({
    async openMindMap() {
      const page = await logseq.Editor.getCurrentPage();
      if (!page) {
        logseq.UI.showMsg("Please open a page first to view as mind map.", "warning");
        return;
      }
      logseq.showMainUI();
      setTimeout(() => {
        window.postMessage({
          type: "open-mindmap",
          pageName: page.originalName,
          pageUuid: page.uuid
        }, "*");
      }, 100);
    }
  });

  // Handle escape key to close UI
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      logseq.hideMainUI();
    }
  }, false);

  // Click outside to close (Optional, handled in UI)
}

logseq.ready(main).catch(console.error);
