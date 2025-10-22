import { useEffect, useRef, useState } from 'react';
import { WebRTCReceiver } from '../services/webrtcReceiver.js';
import { SocketReceiver } from '../services/socketReceiver.js';
import { ButterchurnRenderer } from '../services/butterchurnRenderer.js';
import ConnectionStatus from './ConnectionStatus.jsx';

function PopupCanvas() {
  const canvasRef = useRef(null);
  const receiverRef = useRef(null);
  const butterchurnRendererRef = useRef(null);
  const [connectionState, setConnectionState] = useState('disconnected');
  const [currentPreset, setCurrentPreset] = useState(null);
  const [isBrowserMode, setIsBrowserMode] = useState(false);

  useEffect(() => {
    // Detect if running in browser or Electron
    const isElectron = !!window.electronAPI;
    const browserMode = !isElectron;
    setIsBrowserMode(browserMode);

    console.log('PopupCanvas mounted - Mode:', browserMode ? 'Browser (Socket.IO)' : 'Electron (WebRTC)');
    console.log('Butterchurn available:', !!window.butterchurn);
    console.log('Butterchurn presets available:', !!window.butterchurnPresets);

    const canvas = canvasRef.current;
    if (!canvas) {
      console.error('Canvas ref not available');
      return;
    }

    // Set canvas size to window size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      if (butterchurnRendererRef.current) {
        butterchurnRendererRef.current.handleResize(canvas.width, canvas.height);
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Initialize appropriate receiver based on mode
    const receiver = browserMode ? new SocketReceiver() : new WebRTCReceiver();
    receiverRef.current = receiver;

    receiver.initialize(
      (audioStream) => {
        console.log('📡 Received audio stream (not used)');
      },
      (dataChannel) => {
        console.log('📊 Received DataChannel, initializing Butterchurn...');
        const renderer = new ButterchurnRenderer(canvas, dataChannel, browserMode ? receiver : null);
        butterchurnRendererRef.current = renderer;
        renderer.initialize();
        setConnectionState('connected');
      }
    );

    // Update connection state periodically
    const stateInterval = setInterval(() => {
      const state = receiver.getConnectionState();
      setConnectionState(state);
    }, 1000);

    // Listen for preset changes
    let cleanupPreset = () => {};
    if (!browserMode && window.electronAPI) {
      // Electron mode: listen via IPC
      cleanupPreset = window.electronAPI.onPresetChanged(({ preset }) => {
        console.log('Preset changed via IPC:', preset);
        setCurrentPreset(preset);

        if (butterchurnRendererRef.current) {
          butterchurnRendererRef.current.loadPreset(preset);
        }
      });
    } else if (browserMode && receiverRef.current) {
      // Browser mode: listen via control DataChannel
      receiverRef.current.setControlMessageCallback((message) => {
        console.log('Received control message:', message);
        if (message.type === 'preset-change' && message.preset) {
          console.log('Preset changed via DataChannel:', message.preset);
          setCurrentPreset(message.preset);

          if (butterchurnRendererRef.current) {
            butterchurnRendererRef.current.loadPreset(message.preset);
          }
        }
      });
    }

    // Cleanup
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      clearInterval(stateInterval);
      cleanupPreset();

      if (butterchurnRendererRef.current) {
        butterchurnRendererRef.current.cleanup();
      }

      if (receiverRef.current) {
        receiverRef.current.cleanup();
      }
    };
  }, []);

  const handleCanvasClick = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Request fullscreen
    if (!document.fullscreenElement) {
      canvas.requestFullscreen().catch(err => {
        console.error('Failed to enter fullscreen:', err);
      });
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <div className="relative w-screen h-screen bg-black">
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full cursor-pointer"
        onClick={handleCanvasClick}
        title="Click to toggle fullscreen"
      />

      <ConnectionStatus
        connectionState={connectionState}
        currentPreset={currentPreset}
      />
    </div>
  );
}

export default PopupCanvas;
