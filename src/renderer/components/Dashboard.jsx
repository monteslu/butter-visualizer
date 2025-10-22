import { useState, useEffect } from 'react';
import MicrophoneControls from './MicrophoneControls.jsx';
import WindowManager from './WindowManager.jsx';
import PresetBrowser from './PresetBrowser.jsx';
import ServerPanel from './ServerPanel.jsx';
import NetworkInfo from './NetworkInfo.jsx';

function Dashboard({ microphoneManager, webrtcController, visualizationController }) {
  const [windows, setWindows] = useState([]);
  const [micEnabled, setMicEnabled] = useState(false);

  useEffect(() => {
    // Listen for window created events (Electron popups)
    const cleanupCreated = window.electronAPI.onWindowCreated(({ windowId }) => {
      console.log('Window created event received:', windowId);

      // Add window to list (without preset yet - popup will tell us what it loaded)
      setWindows((prev) => [...prev, { id: windowId, preset: null }]);

      // Create WebRTC connection after a short delay to ensure popup is ready
      setTimeout(() => {
        console.log('Creating WebRTC connection for window:', windowId);
        webrtcController.createConnection(windowId);
      }, 1000);
    });

    // Listen for browser client ready (browser windows)
    const cleanupBrowserReady = window.electronAPI.onBrowserClientReady(({ clientId }) => {
      console.log('Browser client ready:', clientId);

      // Add browser window to list (without preset yet)
      setWindows((prev) => [...prev, { id: clientId, preset: null }]);

      // Create WebRTC connection for this browser client
      webrtcController.createConnection(clientId);
    });

    // Listen for preset loaded from popup (both Electron and browser)
    const cleanupPresetLoaded = window.electronAPI.onPresetLoaded(({ windowId, preset }) => {
      console.log(`Popup window ${windowId} loaded preset:`, preset);
      setWindows((prev) =>
        prev.map((w) => (w.id === windowId ? { ...w, preset: preset } : w))
      );
    });

    // Listen for window closed events (both Electron and browser)
    const cleanupClosed = window.electronAPI.onWindowClosed(({ windowId }) => {
      setWindows((prev) => prev.filter((w) => w.id !== windowId));
      webrtcController.closeConnection(windowId);
      visualizationController.removeWindow(windowId);
    });

    return () => {
      cleanupCreated();
      cleanupBrowserReady();
      cleanupPresetLoaded();
      cleanupClosed();
    };
  }, [webrtcController, visualizationController]);

  const handleMicToggle = async () => {
    try {
      const enabled = await microphoneManager.toggle();
      setMicEnabled(enabled);

      if (enabled) {
        // Update WebRTC connections with new stream
        webrtcController.updateMicrophoneStream();
      }
    } catch (error) {
      console.error('Failed to toggle microphone:', error);
    }
  };

  const handleCreateWindow = async () => {
    try {
      await window.electronAPI.createWindow();
    } catch (error) {
      console.error('Failed to create window:', error);
    }
  };

  const handleCloseWindow = async (windowId) => {
    try {
      await window.electronAPI.closeWindow(windowId);
    } catch (error) {
      console.error('Failed to close window:', error);
    }
  };

  const handlePresetChange = async (windowId, preset) => {
    try {
      await visualizationController.setWindowPreset(windowId, preset);
      setWindows((prev) =>
        prev.map((w) => (w.id === windowId ? { ...w, preset: preset } : w))
      );
    } catch (error) {
      console.error('Failed to change preset:', error);
    }
  };

  const handlePresetChangeAll = async (preset) => {
    try {
      await visualizationController.setAllWindowsPreset(preset);
      setWindows((prev) => prev.map((w) => ({ ...w, preset: preset })));
    } catch (error) {
      console.error('Failed to change all presets:', error);
    }
  };

  return (
    <div className="h-screen flex overflow-hidden bg-gray-900">
        {/* Left Sidebar */}
        <div className="w-96 border-r border-gray-700 flex flex-col bg-gray-800">
          <div className="p-3">
            <MicrophoneControls
              micEnabled={micEnabled}
              onToggle={handleMicToggle}
              microphoneManager={microphoneManager}
            />
          </div>

          <div className="flex-1 overflow-y-auto px-3">
            <WindowManager
              windows={windows}
              onCreateWindow={handleCreateWindow}
              onCloseWindow={handleCloseWindow}
              onPresetChange={handlePresetChange}
              visualizationController={visualizationController}
            />
          </div>

          <div className="p-3 border-t border-gray-700">
            <NetworkInfo />
          </div>
        </div>

        {/* Main Area - Preset Browser */}
        <div className="flex-1 overflow-hidden">
          <PresetBrowser
            visualizationController={visualizationController}
            onPresetSelect={handlePresetChangeAll}
            onPresetSelectWindow={handlePresetChange}
            windows={windows}
          />
        </div>
    </div>
  );
}

export default Dashboard;
