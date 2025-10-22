const { contextBridge, ipcRenderer } = require('electron');

// Define IPC channels inline to avoid ES6 import issues
const IPC_CHANNELS = {
  // Microphone
  MIC_GET_DEVICES: 'microphone:get-devices',
  MIC_TOGGLE: 'microphone:toggle',
  MIC_SET_DEVICE: 'microphone:set-device',
  MIC_STATUS: 'microphone:status',

  // Window Management
  WINDOW_CREATE: 'window:create',
  WINDOW_CLOSE: 'window:close',
  WINDOW_CLOSE_ALL: 'window:close-all',
  WINDOW_LIST: 'window:list',
  WINDOW_READY: 'window:ready',
  WINDOW_CREATED: 'window:created',
  WINDOW_CLOSED: 'window:closed',

  // Presets
  PRESET_GET_ALL: 'preset:get-all',
  PRESET_SET: 'preset:set',
  PRESET_SET_ALL: 'preset:set-all',
  PRESET_CHANGED: 'preset:changed',
  PRESET_LOADED: 'preset:loaded',

  // WebRTC Signaling
  WEBRTC_CREATE: 'webrtc:create-connection',
  WEBRTC_OFFER: 'webrtc:offer',
  WEBRTC_ANSWER: 'webrtc:answer',
  WEBRTC_ICE_CANDIDATE: 'webrtc:ice-candidate',

  // Server
  SERVER_START: 'server:start',
  SERVER_STOP: 'server:stop',
  SERVER_STATUS: 'server:status',
  SERVER_GET_NETWORK_INFO: 'server:get-network-info',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_GET_ALL: 'settings:get-all',
  SETTINGS_TOGGLE_PRESET: 'settings:toggle-preset',

  // Browser Clients (Socket.IO WebRTC signaling)
  BROWSER_CLIENT_READY: 'browser-client:ready',
  BROWSER_CLIENT_OFFER: 'browser-client:offer',
  BROWSER_CLIENT_ICE: 'browser-client:ice',
  BROWSER_CLIENT_ANSWER: 'browser-client:answer-from-browser',
  BROWSER_CLIENT_ICE_FROM_BROWSER: 'browser-client:ice-from-browser',
};

/**
 * Preload script - Exposes safe APIs to renderer
 */

// Expose IPC API to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Window Management
  createWindow: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_CREATE),
  closeWindow: (windowId) => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_CLOSE, windowId),
  closeAllWindows: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_CLOSE_ALL),
  getWindows: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_LIST),

  // Preset Management
  setPreset: (windowId, preset) =>
    ipcRenderer.invoke(IPC_CHANNELS.PRESET_SET, { windowId, preset }),
  setAllPresets: (preset) => ipcRenderer.invoke(IPC_CHANNELS.PRESET_SET_ALL, { preset }),
  notifyPresetLoaded: (preset) => ipcRenderer.send(IPC_CHANNELS.PRESET_LOADED, { preset }),

  // Server Management
  getServerStatus: () => ipcRenderer.invoke(IPC_CHANNELS.SERVER_STATUS),
  startServer: () => ipcRenderer.invoke(IPC_CHANNELS.SERVER_START),
  stopServer: () => ipcRenderer.invoke(IPC_CHANNELS.SERVER_STOP),
  getNetworkInfo: () => ipcRenderer.invoke(IPC_CHANNELS.SERVER_GET_NETWORK_INFO),

  // Settings Management
  settingsGet: (key) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET, key),
  settingsSet: (key, value) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, { key, value }),
  settingsGetAll: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET_ALL),
  settingsTogglePreset: (presetName) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_TOGGLE_PRESET, presetName),

  // WebRTC Signaling
  sendOffer: (windowId, offer) =>
    ipcRenderer.send(IPC_CHANNELS.WEBRTC_OFFER, { windowId, offer }),
  sendAnswer: (windowId, answer) =>
    ipcRenderer.send(IPC_CHANNELS.WEBRTC_ANSWER, { windowId, answer }),
  sendIceCandidate: (windowId, candidate, direction) =>
    ipcRenderer.send(IPC_CHANNELS.WEBRTC_ICE_CANDIDATE, { windowId, candidate, direction }),

  // Event listeners - return cleanup functions
  onWindowCreated: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.WINDOW_CREATED, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.WINDOW_CREATED, listener);
  },
  onWindowClosed: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.WINDOW_CLOSED, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.WINDOW_CLOSED, listener);
  },
  onPresetChanged: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.PRESET_CHANGED, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.PRESET_CHANGED, listener);
  },
  onPresetLoaded: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.PRESET_LOADED, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.PRESET_LOADED, listener);
  },
  onWebRTCOffer: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.WEBRTC_OFFER, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.WEBRTC_OFFER, listener);
  },
  onWebRTCAnswer: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.WEBRTC_ANSWER, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.WEBRTC_ANSWER, listener);
  },
  onWebRTCIceCandidate: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.WEBRTC_ICE_CANDIDATE, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.WEBRTC_ICE_CANDIDATE, listener);
  },

  // Browser Client WebRTC
  sendOfferToBrowserClient: (clientId, offer) =>
    ipcRenderer.send(IPC_CHANNELS.BROWSER_CLIENT_OFFER, { clientId, offer }),
  sendIceToBrowserClient: (clientId, candidate) =>
    ipcRenderer.send(IPC_CHANNELS.BROWSER_CLIENT_ICE, { clientId, candidate }),
  onBrowserClientReady: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.BROWSER_CLIENT_READY, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.BROWSER_CLIENT_READY, listener);
  },
  onBrowserAnswer: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.BROWSER_CLIENT_ANSWER, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.BROWSER_CLIENT_ANSWER, listener);
  },
  onBrowserIce: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.BROWSER_CLIENT_ICE_FROM_BROWSER, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.BROWSER_CLIENT_ICE_FROM_BROWSER, listener);
  },

  // Remove listeners
  removeListener: (channel, callback) => ipcRenderer.removeListener(channel, callback),
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
});
