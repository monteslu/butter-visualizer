import { useState, useEffect } from 'react';
import { MicrophoneManager } from './services/microphoneManager.js';
import { WebRTCController } from './services/webrtcController.js';
import { VisualizationController } from './services/visualizationController.js';
import Dashboard from './components/Dashboard.jsx';

// Initialize services
const microphoneManager = new MicrophoneManager();

// Callback for when WebRTC connection closes
const handleConnectionClosed = (windowId) => {
  console.log(`WebRTC connection closed for window ${windowId}, notifying main process`);
  // Trigger window closed event via IPC
  window.electronAPI.notifyWindowClosed(windowId);
};

const webrtcController = new WebRTCController(microphoneManager, handleConnectionClosed);
const visualizationController = new VisualizationController(webrtcController);

function App() {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    // Initialize visualization controller
    visualizationController.initialize().then(() => {
      setInitialized(true);
    });

    // Setup WebRTC answer handler - store cleanup function
    const cleanupAnswer = window.electronAPI.onWebRTCAnswer(({ windowId, answer }) => {
      webrtcController.handleAnswer(windowId, answer);
    });

    // Setup WebRTC ICE candidate handler - store cleanup function
    const cleanupIce = window.electronAPI.onWebRTCIceCandidate(({ windowId, candidate }) => {
      webrtcController.handleIceCandidate(windowId, candidate);
    });

    // Setup browser client answer handler (via Socket.IO relay)
    const cleanupBrowserAnswer = window.electronAPI.onBrowserAnswer(({ clientId, answer }) => {
      console.log('Browser client answer:', clientId);
      webrtcController.handleAnswer(clientId, answer);
    });

    // Setup browser client ICE candidate handler (via Socket.IO relay)
    const cleanupBrowserIce = window.electronAPI.onBrowserIce(({ clientId, candidate }) => {
      console.log('Browser client ICE candidate:', clientId);
      webrtcController.handleIceCandidate(clientId, candidate);
    });

    return () => {
      cleanupAnswer();
      cleanupIce();
      cleanupBrowserAnswer();
      cleanupBrowserIce();
      microphoneManager.stop();
      webrtcController.closeAllConnections();
    };
  }, []);

  if (!initialized) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-center">
          <div className="text-2xl mb-4">Loading Butter Visualizer...</div>
          <div className="text-gray-400">Initializing presets...</div>
        </div>
      </div>
    );
  }

  return (
    <Dashboard
      microphoneManager={microphoneManager}
      webrtcController={webrtcController}
      visualizationController={visualizationController}
    />
  );
}

export default App;
