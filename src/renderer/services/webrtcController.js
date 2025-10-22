import { WEBRTC_CONFIG } from '../../shared/constants.js';

/**
 * WebRTCController - Manages WebRTC connections to popup windows
 */
export class WebRTCController {
  constructor(microphoneManager) {
    this.microphoneManager = microphoneManager;
    this.connections = new Map(); // windowId -> RTCPeerConnection
  }

  /**
   * Create a peer connection for a window
   */
  async createConnection(windowId) {
    try {
      // Create peer connection (independent of microphone state)
      const pc = new RTCPeerConnection(WEBRTC_CONFIG);

      // Create TWO DataChannels:
      // 1. Audio data channel - raw binary audio (unordered, unreliable for real-time)
      const audioChannel = pc.createDataChannel('audioData', {
        ordered: false,
        maxRetransmits: 0, // Drop old packets for real-time
      });

      // 2. Control channel - JSON messages for presets, etc (ordered, reliable)
      const controlChannel = pc.createDataChannel('control', {
        ordered: true,
      });

      audioChannel.onopen = () => {
        console.log('Audio DataChannel opened for window:', windowId);

        // Start sending audio data (will send silence if no mic)
        const startAudioSending = () => {
          const analyser = this.microphoneManager.analyser;
          const audioContext = this.microphoneManager.audioContext;

          if (!analyser || !audioContext) {
            console.log('No microphone yet, will send silence');
            // Send at 60fps if no mic available
            return 1000 / 60;
          }

          // Calculate send interval based on actual audio sample rate
          const fftSize = analyser.fftSize;
          const sampleRate = audioContext.sampleRate;
          return (fftSize / sampleRate) * 1000;
        };

        // Send audio analysis data at the optimal rate
        const sendAnalysisData = () => {
          if (audioChannel.readyState === 'open') {
            const analyser = this.microphoneManager.analyser;

            if (analyser) {
              // Send real audio data
              const timeData = new Uint8Array(analyser.fftSize);
              analyser.getByteTimeDomainData(timeData);

              try {
                audioChannel.send(timeData.buffer);
              } catch (e) {
                console.warn('Audio DataChannel send failed:', e);
              }
            } else {
              // Send silence (center value 128)
              const silenceData = new Uint8Array(2048).fill(128);
              try {
                audioChannel.send(silenceData.buffer);
              } catch (e) {
                console.warn('Audio DataChannel send failed:', e);
              }
            }
          }
        };

        // Start sending at appropriate rate
        const intervalMs = startAudioSending();
        const intervalId = setInterval(sendAnalysisData, intervalMs);

        // Store interval for cleanup
        pc.audioChannelInterval = intervalId;
      };

      audioChannel.onerror = (error) => {
        // Ignore "Close called" errors - these are expected during normal shutdown
        if (!error?.error?.message?.includes('Close called')) {
          console.error('Audio DataChannel error:', error);
        }
      };

      // Control channel handlers
      controlChannel.onopen = () => {
        // Store reference for sending control messages
        pc.controlChannel = controlChannel;
      };

      controlChannel.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          // Handle control messages if needed (e.g., acknowledgments)
        } catch (e) {
          console.error('Failed to parse control message:', e);
        }
      };

      controlChannel.onerror = (error) => {
        // Ignore "Close called" errors - these are expected during shutdown
        if (!error?.error?.message?.includes('Close called')) {
          console.error('Control DataChannel error:', error);
        }
      };

      // No need to add audio tracks - we're using DataChannels for audio data

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const candidateData = {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
          };

          // Detect if this is a browser client (UUID) or popup window (number)
          const isBrowserClient = typeof windowId === 'string' && windowId.includes('-');

          if (isBrowserClient) {
            window.electronAPI.sendIceToBrowserClient(windowId, candidateData);
          } else {
            window.electronAPI.sendIceCandidate(windowId, candidateData, 'to-popup');
          }
        }
      };

      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          this.connections.delete(windowId);
        }
      };

      // Create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Store connection
      this.connections.set(windowId, pc);

      // Detect if this is a browser client (UUID) or popup window (number)
      const isBrowserClient = typeof windowId === 'string' && windowId.includes('-');

      if (isBrowserClient) {
        window.electronAPI.sendOfferToBrowserClient(windowId, offer);
      } else {
        window.electronAPI.sendOffer(windowId, offer);
      }

      return pc;
    } catch (error) {
      console.error('Failed to create connection:', error);
      throw error;
    }
  }

  /**
   * Handle answer from popup
   */
  async handleAnswer(windowId, answer) {
    const pc = this.connections.get(windowId);
    if (pc) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (error) {
        console.error('Failed to set remote description:', error);
      }
    }
  }

  /**
   * Handle ICE candidate from popup
   */
  async handleIceCandidate(windowId, candidate) {
    const pc = this.connections.get(windowId);
    if (!pc) return;

    // Ignore empty candidates
    if (!candidate || (!candidate.candidate && !candidate.sdpMid)) return;

    // If remote description not set yet, wait a bit
    if (!pc.remoteDescription) {
      setTimeout(() => this.handleIceCandidate(windowId, candidate), 100);
      return;
    }

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('Failed to add ICE candidate:', error);
    }
  }

  /**
   * Close a connection
   */
  closeConnection(windowId) {
    const pc = this.connections.get(windowId);
    if (pc) {
      pc.close();
      this.connections.delete(windowId);
    }
  }

  /**
   * Close all connections
   */
  closeAllConnections() {
    this.connections.forEach((pc) => pc.close());
    this.connections.clear();
  }

  /**
   * Update microphone stream for all connections
   */
  updateMicrophoneStream() {
    // No-op: Audio data sending automatically adapts when microphone becomes available
    // The sendAnalysisData function checks for analyser on every send and will
    // switch from sending silence to sending real audio data automatically
    console.log('Microphone stream updated - connections will start sending audio data');
  }

  /**
   * Get connection status
   */
  getConnectionStatus(windowId) {
    const pc = this.connections.get(windowId);
    return pc ? pc.connectionState : 'disconnected';
  }

  /**
   * Send control message via control DataChannel
   */
  sendControlMessage(windowId, message) {
    const pc = this.connections.get(windowId);
    if (!pc || !pc.controlChannel || pc.controlChannel.readyState !== 'open') {
      return false;
    }

    try {
      pc.controlChannel.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('Failed to send control message:', error);
      return false;
    }
  }
}
