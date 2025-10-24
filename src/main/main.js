import { app, BrowserWindow } from 'electron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { WindowManager } from './windowManager.js';
import { ExpressServer } from './expressServer.js';
import { setupIpcHandlers } from './ipcHandlers.js';
import SettingsManager from './settingsManager.js';
import { SERVER_PORT } from '../shared/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * ButterVisualizer - Main Application
 */
class ButterVisualizerApp {
  constructor() {
    this.mainWindow = null;
    this.windowManager = new WindowManager();
    this.expressServer = new ExpressServer(SERVER_PORT);
    this.settingsManager = new SettingsManager();
  }

  async initialize() {
    // Load settings
    await this.settingsManager.load();

    // Setup window close callback
    this.windowManager.setOnWindowClosed((windowId) => {
      console.log('Window closed:', windowId);

      // Notify main window
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('window:closed', { windowId });
      }

      // Broadcast to server
      this.expressServer.broadcastWindowClosed(windowId);
    });

    // Setup express server event handlers
    this.expressServer.on('window:create-requested', () => {
      return this.windowManager.createPopupWindow();
    });

    this.expressServer.on('window:close-requested', (windowId) => {
      this.windowManager.closeWindow(windowId);
    });

    this.expressServer.on('preset:set-requested', ({ windowId, preset }) => {
      this.windowManager.sendToWindow(windowId, 'preset:changed', { preset });
    });

    this.expressServer.on('preset:set-all-requested', (preset) => {
      this.windowManager.sendToAllWindows('preset:changed', { preset });
    });

    this.expressServer.on('browser-client:ready', (clientId) => {
      // Notify dashboard that a browser client is ready for WebRTC
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('browser-client:ready', { clientId });
      }
    });

    this.expressServer.on('browser-client:answer', ({ clientId, answer }) => {
      // Relay WebRTC answer from browser client to dashboard
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('browser-client:answer-from-browser', { clientId, answer });
      }
    });

    this.expressServer.on('browser-client:ice', ({ clientId, candidate }) => {
      // Relay ICE candidate from browser client to dashboard
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('browser-client:ice-from-browser', { clientId, candidate });
      }
    });

    this.expressServer.on('browser-client:preset-loaded', ({ clientId, preset }) => {
      // Relay preset loaded from browser client to dashboard
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('preset:loaded', { windowId: clientId, preset });
      }
    });

    this.expressServer.on('browser-client:closed', (clientId) => {
      // Notify dashboard that a browser client has disconnected
      console.log(`Browser client ${clientId} closed, notifying renderer`);
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('window:closed', { windowId: clientId });
      }
    });

    this.expressServer.on('get-status', () => {
      return {
        windowCount: this.windowManager.getAllWindowIds().length,
        windows: this.windowManager.getAllWindowIds(),
        server: this.expressServer.getStatus(),
      };
    });

    // Start express server
    try {
      await this.expressServer.start();
    } catch (error) {
      console.error('Failed to start server:', error);
    }

    // Create main window
    this.createMainWindow();

    // Setup IPC handlers after window is created
    setupIpcHandlers(this.windowManager, this.expressServer, this.settingsManager, this.mainWindow);
  }

  createMainWindow() {
    this.mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      backgroundColor: '#1f2937',
      webPreferences: {
        preload: join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    // Load renderer - always through Express server
    const url = `http://localhost:${SERVER_PORT}/renderer/`;
    console.log('Loading main window from:', url);

    this.mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('Main window failed to load:', errorCode, errorDescription);
    });

    this.mainWindow.loadURL(url);

    // Handle window close
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });
  }

  async cleanup() {
    // Save settings immediately
    await this.settingsManager.saveNow();

    // Close all popup windows
    this.windowManager.closeAllWindows();

    // Stop express server
    await this.expressServer.stop();
  }
}

// Application instance
let butterApp;

// App ready
app.whenReady().then(async () => {
  butterApp = new ButterVisualizerApp();
  await butterApp.initialize();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      butterApp.createMainWindow();
    }
  });
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Before quit cleanup
app.on('before-quit', async () => {
  if (butterApp) {
    await butterApp.cleanup();
  }
});
