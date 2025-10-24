import { BrowserWindow } from 'electron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * WindowManager - Manages popup visualization windows
 */
export class WindowManager {
  constructor() {
    this.popupWindows = new Map(); // windowId -> BrowserWindow
    this.nextWindowId = 1;
    this.onWindowClosedCallback = null;
  }

  /**
   * Set callback for when a window is closed
   */
  setOnWindowClosed(callback) {
    this.onWindowClosedCallback = callback;
  }

  /**
   * Create a new popup visualization window
   */
  createPopupWindow() {
    const windowId = this.nextWindowId++;

    const popup = new BrowserWindow({
      width: 1280,
      height: 720,
      backgroundColor: '#000000',
      autoHideMenuBar: true,
      webPreferences: {
        preload: join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    // Load popup HTML - always through Express server
    popup.loadURL('http://localhost:4069/popup');

    // Store window reference
    this.popupWindows.set(windowId, popup);

    // Cleanup on close
    popup.on('closed', () => {
      this.popupWindows.delete(windowId);

      // Notify callback if set
      if (this.onWindowClosedCallback) {
        this.onWindowClosedCallback(windowId);
      }
    });

    return { windowId, window: popup };
  }

  /**
   * Close a specific popup window
   */
  closeWindow(windowId) {
    const window = this.popupWindows.get(windowId);
    if (window && !window.isDestroyed()) {
      window.close();
    }
    this.popupWindows.delete(windowId);
  }

  /**
   * Close all popup windows
   */
  closeAllWindows() {
    this.popupWindows.forEach((window) => {
      if (!window.isDestroyed()) {
        window.close();
      }
    });
    this.popupWindows.clear();
  }

  /**
   * Get a window by ID
   */
  getWindow(windowId) {
    return this.popupWindows.get(windowId);
  }

  /**
   * Get window ID by webContents sender (for IPC routing)
   */
  getWindowIdBySender(sender) {
    for (const [windowId, window] of this.popupWindows.entries()) {
      if (!window.isDestroyed() && window.webContents === sender) {
        return windowId;
      }
    }
    return null;
  }

  /**
   * Get all window IDs
   */
  getAllWindowIds() {
    return Array.from(this.popupWindows.keys());
  }

  /**
   * Send message to a specific window
   */
  sendToWindow(windowId, channel, data) {
    const window = this.popupWindows.get(windowId);
    if (window && !window.isDestroyed()) {
      window.webContents.send(channel, data);
    }
  }

  /**
   * Send message to all windows
   */
  sendToAllWindows(channel, data) {
    this.popupWindows.forEach((window) => {
      if (!window.isDestroyed()) {
        window.webContents.send(channel, data);
      }
    });
  }
}
