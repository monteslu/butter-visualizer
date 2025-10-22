/**
 * IPC Channel definitions for Electron communication
 */

export const IPC_CHANNELS = {
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
