import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock electronAPI
global.window = global.window || {};
global.window.electronAPI = {
  createWindow: vi.fn(),
  closeWindow: vi.fn(),
  closeAllWindows: vi.fn(),
  getWindows: vi.fn(),
  setPreset: vi.fn(),
  setAllPresets: vi.fn(),
  getServerStatus: vi.fn(),
  startServer: vi.fn(),
  stopServer: vi.fn(),
  sendOffer: vi.fn(),
  sendAnswer: vi.fn(),
  sendIceCandidate: vi.fn(),
  onWindowCreated: vi.fn(),
  onWindowClosed: vi.fn(),
  onPresetChanged: vi.fn(),
  onWebRTCOffer: vi.fn(),
  onWebRTCAnswer: vi.fn(),
  onWebRTCIceCandidate: vi.fn(),
  removeListener: vi.fn(),
  removeAllListeners: vi.fn(),
};
