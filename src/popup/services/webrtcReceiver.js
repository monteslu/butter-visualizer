import { WEBRTC_CONFIG } from '../../shared/constants.js';

/**
 * WebRTCReceiver - Receives audio stream via WebRTC in popup window
 */
export class WebRTCReceiver {
  constructor() {
    this.peerConnection = null;
    this.audioStream = null;
    this.audioDataChannel = null; // Binary audio data channel
    this.controlChannel = null; // JSON control messages channel
    this.onStreamCallback = null;
    this.onDataChannelCallback = null;
    this.onControlMessageCallback = null;
    this.pendingICECandidates = []; // Queue for ICE candidates before remote description is set
    this.cleanupFunctions = []; // Store listener cleanup functions
  }

  /**
   * Initialize WebRTC connection
   */
  async initialize(onStream, onDataChannel) {
    this.onStreamCallback = onStream;
    this.onDataChannelCallback = onDataChannel;

    // Create peer connection
    this.peerConnection = new RTCPeerConnection(WEBRTC_CONFIG);

    // Handle incoming DataChannels (audio + control)
    this.peerConnection.ondatachannel = (event) => {
      const channel = event.channel;

      if (channel.label === 'audioData') {
        // Audio data channel - binary audio
        this.audioDataChannel = channel;

        this.audioDataChannel.onopen = () => {
          if (this.onDataChannelCallback) {
            this.onDataChannelCallback(this.audioDataChannel);
          }
        };

        this.audioDataChannel.onclose = () => {
          // Channel closed
        };

        this.audioDataChannel.onerror = (error) => {
          if (!error?.error?.message?.includes('Close called')) {
            console.error('Audio DataChannel error:', error);
          }
        };

        // If already open, call callback immediately
        if (channel.readyState === 'open') {
          if (this.onDataChannelCallback) {
            this.onDataChannelCallback(this.audioDataChannel);
          }
        }
      } else if (channel.label === 'control') {
        // Control channel - JSON messages
        this.controlChannel = channel;

        this.controlChannel.onopen = () => {
          // Control channel ready
        };

        this.controlChannel.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (this.onControlMessageCallback) {
              this.onControlMessageCallback(message);
            }
          } catch (e) {
            console.error('Failed to parse control message:', e);
          }
        };

        this.controlChannel.onclose = () => {
          // Control channel closed
        };

        this.controlChannel.onerror = (error) => {
          if (!error?.error?.message?.includes('Close called')) {
            console.error('Control DataChannel error:', error);
          }
        };
      }
    };

    // Handle incoming stream
    this.peerConnection.ontrack = (event) => {
      const [stream] = event.streams;
      this.audioStream = stream;

      stream.getAudioTracks().forEach((track) => {
        if (!track.enabled) {
          track.enabled = true;
        }
      });

      if (this.onStreamCallback) {
        this.onStreamCallback(stream);
      }
    };

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        window.electronAPI.sendIceCandidate(
          null,
          {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
          },
          'to-dashboard'
        );
      }
    };

    // Handle connection state
    this.peerConnection.onconnectionstatechange = () => {
      if (this.peerConnection.connectionState === 'failed') {
        console.error('WebRTC connection failed!');
      }
    };

    // Listen for offer from dashboard
    const cleanupOffer = window.electronAPI.onWebRTCOffer(async ({ offer }) => {
      await this.handleOffer(offer);
    });
    this.cleanupFunctions.push(cleanupOffer);

    // Listen for ICE candidates from dashboard
    const cleanupIce = window.electronAPI.onWebRTCIceCandidate(async ({ candidate }) => {
      await this.handleIceCandidate(candidate);
    });
    this.cleanupFunctions.push(cleanupIce);
  }

  /**
   * Handle offer from dashboard
   */
  async handleOffer(offer) {
    try {
      console.log('🔧 Setting remote description...');
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      console.log('✅ Remote description set on receiver');

      // Flush pending ICE candidates now that remote description is set
      if (this.pendingICECandidates.length > 0) {
        console.log(`🧊 Flushing ${this.pendingICECandidates.length} pending ICE candidates`);
        for (const candidate of this.pendingICECandidates) {
          try {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            console.log('✅ Added queued ICE candidate');
          } catch (error) {
            console.error('❌ Failed to add queued ICE candidate:', error);
          }
        }
        this.pendingICECandidates = [];
      }

      console.log('📋 Creating answer...');
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      console.log('✅ Answer created and local description set');

      // Send answer back to dashboard
      window.electronAPI.sendAnswer(null, answer);
    } catch (error) {
      console.error('Failed to handle offer:', error);
    }
  }

  /**
   * Handle ICE candidate from dashboard
   */
  async handleIceCandidate(candidate) {
    if (!this.peerConnection) {
      console.warn('⚠️ Peer connection not initialized, ignoring ICE candidate');
      return;
    }

    // Ignore empty candidates
    if (!candidate || (!candidate.candidate && !candidate.sdpMid)) {
      console.log('🧊 Ignoring empty/null ICE candidate');
      return;
    }

    // If remote description not set yet, queue the candidate
    if (!this.peerConnection.remoteDescription) {
      console.log('🧊 Queueing ICE candidate (remote description not set yet)');
      this.pendingICECandidates.push(candidate);
      return;
    }

    // Remote description is set, add immediately
    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('✅ Added ICE candidate to receiver');
    } catch (error) {
      console.error('❌ Failed to add ICE candidate:', error, candidate);
    }
  }

  /**
   * Get connection state
   */
  getConnectionState() {
    return this.peerConnection ? this.peerConnection.connectionState : 'disconnected';
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
   * Cleanup
   */
  cleanup() {
    console.log('🧹 Cleaning up WebRTCReceiver...');

    // Remove all event listeners
    this.cleanupFunctions.forEach((cleanup) => cleanup());
    this.cleanupFunctions = [];

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.audioStream = null;
    this.pendingICECandidates = [];
  }
}
