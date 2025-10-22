/**
 * Application constants
 */

export const DEFAULT_SERVER_PORT = 4069;

export const PRESET_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'geiss', label: 'Geiss' },
  { id: 'martin', label: 'Martin' },
  { id: 'flexi', label: 'Flexi' },
  { id: 'shifter', label: 'Shifter' },
  { id: 'other', label: 'Other' },
];

export const AUDIO_CONFIG = {
  sampleRate: 48000,
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
};

export const WEBRTC_CONFIG = {
  iceServers: [], // Local connection only
};

export const BUTTERCHURN_CONFIG = {
  pixelRatio: window.devicePixelRatio || 1,
  textureRatio: 1,
};
