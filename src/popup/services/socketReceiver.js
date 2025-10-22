import { io } from 'socket.io-client';

const WEBRTC_CONFIG = {
  iceServers: [], // Local connection only (could add STUN for remote)
};

/**
 * SocketReceiver - Uses Socket.IO for WebRTC signaling, then DataChannels for audio
 */
export class SocketReceiver {
  constructor() {
    this.socket = null;
    this.clientId = null;
    this.peerConnection = null;
    this.audioDataChannel = null; // Binary audio data channel
    this.controlChannel = null; // JSON control messages channel
    this.onDataChannelCallback = null;
    this.onControlMessageCallback = null;
    this.connectionState = 'disconnected';
  }

  /**
   * Initialize Socket.IO connection for WebRTC signaling
   */
  async initialize(onStream, onDataChannel) {
    console.log('SocketReceiver initializing (Socket.IO signaling + WebRTC DataChannel)...');
    this.onDataChannelCallback = onDataChannel;

    // Generate random client ID (with fallback for older browsers)
    this.clientId = this.generateUUID();
    console.log('Generated client ID:', this.clientId);

    // Connect to Socket.IO on same origin (relative to where the page was loaded from)
    console.log('Connecting to Socket.IO on same origin:', window.location.origin);

    // Connect to Socket.IO server for signaling only
    this.socket = io({
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
    });

    // Create peer connection
    this.peerConnection = new RTCPeerConnection(WEBRTC_CONFIG);
    console.log('PeerConnection created (browser client)');

    // Handle incoming DataChannels (audio + control)
    this.peerConnection.ondatachannel = (event) => {
      const channel = event.channel;
      console.log('📊 DataChannel received:', channel.label);

      if (channel.label === 'audioData') {
        // Audio data channel - binary audio
        this.audioDataChannel = channel;

        this.audioDataChannel.onopen = () => {
          console.log('📊 Audio DataChannel opened!');
          this.connectionState = 'connected';
          if (this.onDataChannelCallback) {
            this.onDataChannelCallback(this.audioDataChannel);
          }
        };

        this.audioDataChannel.onclose = () => {
          console.log('📊 Audio DataChannel closed');
          this.connectionState = 'disconnected';
        };

        this.audioDataChannel.onerror = (error) => {
          // Ignore "Close called" errors - these are expected during normal shutdown
          if (error?.error?.message?.includes('Close called')) {
            console.log('📊 Audio DataChannel closed normally');
          } else {
            console.error('📊 Audio DataChannel error:', error);
            this.connectionState = 'failed';
          }
        };
      } else if (channel.label === 'control') {
        // Control channel - JSON messages
        this.controlChannel = channel;

        this.controlChannel.onopen = () => {
          console.log('🎛️ Control DataChannel opened!');
        };

        this.controlChannel.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            console.log('🎛️ Control message received:', message);
            if (this.onControlMessageCallback) {
              this.onControlMessageCallback(message);
            }
          } catch (e) {
            console.error('Failed to parse control message:', e);
          }
        };

        this.controlChannel.onclose = () => {
          console.log('🎛️ Control DataChannel closed');
        };

        this.controlChannel.onerror = (error) => {
          // Ignore "Close called" errors - these are expected during normal shutdown
          if (error?.error?.message?.includes('Close called')) {
            console.log('🎛️ Control DataChannel closed normally');
          } else {
            console.error('🎛️ Control DataChannel error:', error);
          }
        };
      } else {
        console.warn('⚠️ Unknown DataChannel label:', channel.label);
      }
    };

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('🧊 Browser ICE candidate');
        this.socket.emit('webrtc:ice-candidate', {
          clientId: this.clientId,
          candidate: {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
          },
        });
      }
    };

    // Handle connection state
    this.peerConnection.onconnectionstatechange = () => {
      console.log('🔗 Connection state:', this.peerConnection.connectionState);
      this.connectionState = this.peerConnection.connectionState;
    };

    // Socket.IO event handlers
    this.socket.on('connect', () => {
      console.log('📡 Socket.IO connected for signaling');
      this.connectionState = 'connecting';

      // Announce ourselves as a visualization client
      this.socket.emit('visualization:ready', { clientId: this.clientId });
      console.log('Sent visualization:ready with clientId:', this.clientId);
    });

    // Receive WebRTC offer from dashboard
    this.socket.on('webrtc:offer', async ({ offer }) => {
      console.log('Received WebRTC offer via Socket.IO');
      await this.handleOffer(offer);
    });

    // Receive ICE candidates from dashboard
    this.socket.on('webrtc:ice-candidate', async ({ candidate }) => {
      console.log('Received ICE candidate via Socket.IO');
      await this.handleIceCandidate(candidate);
    });

    this.socket.on('disconnect', () => {
      console.log('📡 Socket.IO disconnected');
      if (this.peerConnection) {
        this.peerConnection.close();
      }
      this.connectionState = 'disconnected';
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket.IO connection error:', error);
      this.connectionState = 'failed';
    });

    console.log('SocketReceiver initialized, waiting for WebRTC offer...');
  }

  /**
   * Handle WebRTC offer from dashboard
   */
  async handleOffer(offer) {
    try {
      console.log('🔧 Setting remote description...');
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      console.log('✅ Remote description set');

      console.log('📋 Creating answer...');
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      console.log('✅ Answer created');

      // Send answer back via Socket.IO
      this.socket.emit('webrtc:answer', {
        clientId: this.clientId,
        answer,
      });
      console.log('Sent answer via Socket.IO');
    } catch (error) {
      console.error('Failed to handle offer:', error);
      this.connectionState = 'failed';
    }
  }

  /**
   * Handle ICE candidate from dashboard
   */
  async handleIceCandidate(candidate) {
    if (!this.peerConnection) {
      console.warn('⚠️ No peer connection, ignoring ICE candidate');
      return;
    }

    if (!candidate || (!candidate.candidate && !candidate.sdpMid)) {
      console.log('🧊 Ignoring empty/null ICE candidate');
      return;
    }

    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('✅ Added ICE candidate from dashboard');
    } catch (error) {
      console.error('❌ Failed to add ICE candidate:', error);
    }
  }

  /**
   * Get connection state
   */
  getConnectionState() {
    return this.connectionState;
  }

  /**
   * Set control message callback
   */
  setControlMessageCallback(callback) {
    this.onControlMessageCallback = callback;
  }

  /**
   * Send control message to dashboard
   */
  sendControlMessage(message) {
    if (!this.controlChannel) {
      console.warn('⚠️ No control channel available');
      return false;
    }

    if (this.controlChannel.readyState !== 'open') {
      console.warn('⚠️ Control channel not open');
      return false;
    }

    try {
      this.controlChannel.send(JSON.stringify(message));
      console.log('🎛️ Sent control message:', message);
      return true;
    } catch (error) {
      console.error('❌ Failed to send control message:', error);
      return false;
    }
  }

  /**
   * Notify dashboard that a preset was loaded (via Socket.IO)
   */
  notifyPresetLoaded(preset) {
    if (!this.socket || !this.clientId) {
      console.warn('⚠️ Socket.IO not connected');
      return false;
    }

    try {
      this.socket.emit('preset:loaded', {
        clientId: this.clientId,
        preset,
      });
      console.log('📢 Notified dashboard of preset via Socket.IO:', preset);
      return true;
    } catch (error) {
      console.error('❌ Failed to notify preset loaded:', error);
      return false;
    }
  }

  /**
   * Generate UUID with fallback for browsers without crypto.randomUUID
   */
  generateUUID() {
    // Try native crypto.randomUUID first
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }

    // Fallback: generate UUID v4 manually
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Cleanup
   */
  cleanup() {
    console.log('🧹 Cleaning up SocketReceiver...');

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.clientId = null;
    this.audioDataChannel = null;
    this.controlChannel = null;
  }
}
