import MindElixir, { MindElixirInstance, Options } from "mind-elixir";
import { getMindElixirLocale } from "./utils";
import { plaintextToBlockUpdates, getPagePlaintext } from "./logseq-parser";
import { plaintextToMindElixir, mindElixirToPlaintext } from "mind-elixir/plaintextConverter";
import "mind-elixir/style.css";
import "./styles.css";

let mind: MindElixirInstance | null = null;
let currentPageUuid: string | null = null;
let isSavingFromMindmap = false;
let lastSaveTime = 0;
let isRenderingMindmap = false;

export function setupMindmapUI() {
  const appContainer = document.getElementById("app");
  if (!appContainer) return;

  appContainer.innerHTML = `
    <div class="mindmap-overlay" id="mindmap-overlay">
      <div class="mindmap-panel">
        <div class="mindmap-header">
          <h3 id="mindmap-title">Mind Map</h3>
          <div class="mindmap-actions">
            <button id="mindmap-close-btn" class="button">Close</button>
          </div>
        </div>
        <div id="mindmap-container" class="mindmap-container"></div>
      </div>
    </div>
  `;

  document.getElementById("mindmap-close-btn")?.addEventListener("click", () => {
    closeMindmap();
  });

  // Listen for messages from main thread
  window.addEventListener("message", async (e) => {
    if (e.data.type === "open-mindmap") {
      await openMindmap(e.data.pageUuid, e.data.pageName);
    }
  });

  // Listen for theme changes from Logseq
  logseq.App.onThemeModeChanged(({ mode }) => {
    const isDark = mode === "dark";
    if (isDark) {
      document.body.classList.add("theme-dark");
    } else {
      document.body.classList.remove("theme-dark");
    }
    if (mind) {
      mind.changeTheme(isDark ? MindElixir.DARK_THEME : MindElixir.THEME);
    }
  });
  
  // Initialize theme
  logseq.App.getUserConfigs().then(configs => {
    if (configs.preferredThemeMode === "dark") {
      document.body.classList.add("theme-dark");
    }
  });

  // Watch for page content changes to update mindmap if open
  logseq.DB.onChanged(async (e) => {
    if (!currentPageUuid) return;
    
    // Ignore events that are likely echoes of our own save
    if (isSavingFromMindmap || Date.now() - lastSaveTime < 2000) {
      return;
    }
    
    // Check if the changed block belongs to our current page
    const belongsToCurrentPage = e.blocks?.some(b => 
      (b.page && typeof b.page === 'object' && 'id' in b.page && e.txData && e.txData[0] && b.page.id === (e.txData[0][1] as any)) || 
      b.uuid === currentPageUuid
    );
    
    // It's hard to precisely filter block events by page without fetching, 
    // so we debounce a refresh when any change happens while UI is open.
    // For simplicity, we'll refresh if the UI is open.
    if (document.getElementById("mindmap-overlay")?.classList.contains("active")) {
      debouncedRefresh();
    }
  });
}

function closeMindmap() {
  document.getElementById("mindmap-overlay")?.classList.remove("active");
  logseq.hideMainUI();
}

let refreshTimer: any = null;
function debouncedRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(async () => {
    if (currentPageUuid) {
      await renderMindmap(currentPageUuid, false);
    }
  }, 1000);
}

async function openMindmap(pageUuid: string, pageName: string) {
  currentPageUuid = pageUuid;
  
  const titleEl = document.getElementById("mindmap-title");
  if (titleEl) titleEl.textContent = `${pageName} - Mind Map`;
  
  document.getElementById("mindmap-overlay")?.classList.add("active");
  
  await renderMindmap(pageUuid, true);
}

let saveTimer: any = null;
function debouncedSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void saveBackToLogseq();
  }, 1500); // Wait for the user to stop typing before saving
}

async function renderMindmap(pageUuid: string, init: boolean = true) {
  const container = document.getElementById("mindmap-container");
  if (!container) return;

  isRenderingMindmap = true;
  try {
    const pageBlocks = await logseq.Editor.getPageBlocksTree(pageUuid);
    const page = await logseq.Editor.getPage(pageUuid);
    const pageTitle = page?.originalName || "Mind Map";
    
    const h1AsRoot = logseq.settings?.h1AsRoot ?? false;
    
    // Get plaintext string from blocks
    const plaintext = await getPagePlaintext(pageBlocks, pageTitle, h1AsRoot as boolean);
    
    // Convert plaintext to Mind Elixir internal data
    const mindData = plaintextToMindElixir(plaintext);

    if (init || !mind) {
      const isDark = document.body.classList.contains("theme-dark");
      
      const locale = await getMindElixirLocale();
      
      // Cleanup previous instance if exists
      if (mind) {
        container.innerHTML = '';
      }

      const options: Options = {
        el: container,
        direction: MindElixir.RIGHT,
        editable: true,
        contextMenu: { locale },
        toolBar: true,
        keypress: true,
        selectionContainer: "body",
        theme: isDark ? MindElixir.DARK_THEME : MindElixir.THEME,
      };

      mind = new MindElixir(options);
      
      // Listen for mindmap edits to write back to Logseq
      mind.bus.addListener("operation", () => {
        if (isRenderingMindmap) return;
        debouncedSave();
      });

      mind.init(mindData);
    } else {
      mind.refresh(mindData);
    }
  } catch (e) {
    console.error("Failed to render mind map", e);
    logseq.UI.showMsg("Failed to render mind map", "error");
  } finally {
    setTimeout(() => {
      isRenderingMindmap = false;
    }, 200);
  }
}

async function saveBackToLogseq() {
  if (!mind || !currentPageUuid) return;
  
  try {
    isSavingFromMindmap = true;
    lastSaveTime = Date.now();
    
    const mindData = mind.getData();
    const newPlaintext = mindElixirToPlaintext(mindData);
    
    const h1AsRoot = logseq.settings?.h1AsRoot ?? false;
    
    await plaintextToBlockUpdates(newPlaintext, currentPageUuid, h1AsRoot as boolean);
    
  } catch (e) {
    console.error("Failed to save mindmap to Logseq", e);
    logseq.UI.showMsg("Failed to sync mind map to page", "error");
  } finally {
    isSavingFromMindmap = false;
    lastSaveTime = Date.now();
  }
}
