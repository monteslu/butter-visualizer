import { ipcMain } from 'electron';
import { networkInterfaces } from 'os';
import { IPC_CHANNELS } from '../shared/ipcChannels.js';

/**
 * Setup IPC handlers for main process communication
 */
export function setupIpcHandlers(windowManager, expressServer, settingsManager, mainWindow) {
  // Window Management
  ipcMain.handle(IPC_CHANNELS.WINDOW_CREATE, async () => {
    const { windowId } = windowManager.createPopupWindow();

    // Notify main window
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.WINDOW_CREATED, { windowId });
    }

    // Broadcast to server
    expressServer.broadcastWindowCreated(windowId);

    return { windowId };
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_CLOSE, async (event, windowId) => {
    windowManager.closeWindow(windowId);

    // Notify main window
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.WINDOW_CLOSED, { windowId });
    }

    // Broadcast to server
    expressServer.broadcastWindowClosed(windowId);

    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_CLOSE_ALL, async () => {
    windowManager.closeAllWindows();
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_LIST, async () => {
    return { windowIds: windowManager.getAllWindowIds() };
  });

  // Preset Management
  ipcMain.handle(IPC_CHANNELS.PRESET_SET, async (event, { windowId, preset }) => {
    windowManager.sendToWindow(windowId, IPC_CHANNELS.PRESET_CHANGED, { preset });
    expressServer.broadcastPresetChanged(windowId, preset);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.PRESET_SET_ALL, async (event, { preset }) => {
    windowManager.sendToAllWindows(IPC_CHANNELS.PRESET_CHANGED, { preset });
    return { success: true };
  });

  // Popup notifies dashboard of preset it loaded
  ipcMain.on(IPC_CHANNELS.PRESET_LOADED, (event, { preset }) => {
    // Determine which window sent this
    const windowId = windowManager.getWindowIdBySender(event.sender);
    console.log(`Popup window ${windowId} loaded preset: ${preset}`);

    // Notify main window
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.PRESET_LOADED, { windowId, preset });
    }
  });

  // WebRTC Signaling
  ipcMain.on(IPC_CHANNELS.WEBRTC_OFFER, (event, { windowId, offer }) => {
    const popup = windowManager.getWindow(windowId);
    if (popup && !popup.isDestroyed()) {
      popup.webContents.send(IPC_CHANNELS.WEBRTC_OFFER, { offer });
    }
  });

  ipcMain.on(IPC_CHANNELS.WEBRTC_ANSWER, (event, { windowId, answer }) => {
    // If windowId is null, determine it from the sender
    let actualWindowId = windowId;
    if (actualWindowId === null || actualWindowId === undefined) {
      actualWindowId = windowManager.getWindowIdBySender(event.sender);
      console.log('Determined windowId from sender:', actualWindowId);
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.WEBRTC_ANSWER, {
        windowId: actualWindowId,
        answer,
      });
    }
  });

  ipcMain.on(IPC_CHANNELS.WEBRTC_ICE_CANDIDATE, (event, { windowId, candidate, direction }) => {
    if (direction === 'to-popup') {
      const popup = windowManager.getWindow(windowId);
      if (popup && !popup.isDestroyed()) {
        popup.webContents.send(IPC_CHANNELS.WEBRTC_ICE_CANDIDATE, { candidate });
      }
    } else if (direction === 'to-dashboard') {
      // If windowId is null, determine it from the sender
      let actualWindowId = windowId;
      if (actualWindowId === null || actualWindowId === undefined) {
        actualWindowId = windowManager.getWindowIdBySender(event.sender);
      }

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC_CHANNELS.WEBRTC_ICE_CANDIDATE, {
          windowId: actualWindowId,
          candidate,
        });
      }
    }
  });

  // Server Management
  ipcMain.handle(IPC_CHANNELS.SERVER_STATUS, async () => {
    return expressServer.getStatus();
  });

  ipcMain.handle(IPC_CHANNELS.SERVER_GET_NETWORK_INFO, async () => {
    const interfaces = networkInterfaces();
    const addresses = [];

    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        // Skip internal and non-IPv4 addresses
        if (iface.family === 'IPv4' && !iface.internal) {
          addresses.push({
            name,
            address: iface.address,
          });
        }
      }
    }

    return {
      port: expressServer.port,
      addresses,
    };
  });

  ipcMain.handle(IPC_CHANNELS.SERVER_START, async () => {
    try {
      await expressServer.start();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SERVER_STOP, async () => {
    try {
      await expressServer.stop();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Settings Management
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async (event, key) => {
    return settingsManager.get(key);
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, async (event, { key, value }) => {
    settingsManager.set(key, value);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET_ALL, async () => {
    return settingsManager.settings;
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_TOGGLE_PRESET, async (event, presetName) => {
    const disabledPresets = settingsManager.togglePresetEnabled(presetName);
    return { disabledPresets };
  });

  // Browser Client WebRTC Signaling (via Socket.IO)
  ipcMain.on(IPC_CHANNELS.BROWSER_CLIENT_OFFER, (event, { clientId, offer }) => {
    console.log('IPC: Sending offer to browser client:', clientId);
    expressServer.sendOfferToBrowserClient(clientId, offer);
  });

  ipcMain.on(IPC_CHANNELS.BROWSER_CLIENT_ICE, (event, { clientId, candidate }) => {
    console.log('IPC: Sending ICE candidate to browser client:', clientId);
    expressServer.sendIceCandidateToBrowserClient(clientId, candidate);
  });
}
