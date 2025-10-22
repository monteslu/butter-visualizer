import { AUDIO_CONFIG } from '../../shared/constants.js';

/**
 * MicrophoneManager - Manages microphone input and audio stream
 */
export class MicrophoneManager {
  constructor() {
    this.stream = null;
    this.audioContext = null;
    this.analyser = null;
    this.isEnabled = false;
    this.selectedDeviceId = 'default';
  }

  /**
   * Get available audio input devices
   */
  async getDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter((device) => device.kind === 'audioinput');
    } catch (error) {
      console.error('Failed to enumerate devices:', error);
      return [];
    }
  }

  /**
   * Start microphone capture
   */
  async start(deviceId = 'default') {
    try {
      this.selectedDeviceId = deviceId;

      const constraints = {
        audio: {
          deviceId: deviceId === 'default' ? undefined : { exact: deviceId },
          ...AUDIO_CONFIG,
        },
        video: false,
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);

      console.log('🎤 Microphone stream created:', {
        id: this.stream.id,
        active: this.stream.active,
        tracks: this.stream.getAudioTracks().length,
      });

      this.stream.getAudioTracks().forEach((track, i) => {
        console.log(`🎤 Track ${i}:`, {
          id: track.id,
          label: track.label,
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState,
        });
      });

      // Create audio context if needed
      if (!this.audioContext) {
        this.audioContext = new AudioContext({ sampleRate: AUDIO_CONFIG.sampleRate });
      }

      // Ensure AudioContext is running
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
        console.log('🎵 AudioContext resumed from suspended state');
      }
      console.log('🎵 AudioContext state:', this.audioContext.state);

      // Create analyser for audio visualization feedback
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.3; // Lower = more reactive (0.3 is good for visualizations)

      // Create gain node to boost signal (microphone might be quiet)
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 5.0; // Default 5x boost for visualizations

      const source = this.audioContext.createMediaStreamSource(this.stream);
      source.connect(this.gainNode);
      this.gainNode.connect(this.analyser);

      console.log('🎵 Connected audio graph: source → gain → analyser (no output)');

      // Test the analyser immediately
      setTimeout(() => {
        const testFreq = new Uint8Array(this.analyser.frequencyBinCount);
        const testTime = new Uint8Array(this.analyser.fftSize);
        this.analyser.getByteFrequencyData(testFreq);
        this.analyser.getByteTimeDomainData(testTime);
        const freqAvg = testFreq.reduce((a, b) => a + b, 0) / testFreq.length;
        const timeAvg = testTime.reduce((a, b) => a + b, 0) / testTime.length;
        console.log('🧪 Analyser test:', { freqAvg: freqAvg.toFixed(2), timeAvg: timeAvg.toFixed(2) });
      }, 500);

      this.isEnabled = true;

      console.log('✅ Microphone enabled successfully');
      return this.stream;
    } catch (error) {
      console.error('Failed to start microphone:', error);
      throw error;
    }
  }

  /**
   * Stop microphone capture
   */
  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.isEnabled = false;
  }

  /**
   * Get current audio stream
   */
  getStream() {
    return this.stream;
  }

  /**
   * Get audio level (0-1)
   */
  getAudioLevel() {
    if (!this.analyser) return 0;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);

    // Calculate average level
    const sum = dataArray.reduce((a, b) => a + b, 0);
    const average = sum / dataArray.length;

    return average / 255; // Normalize to 0-1
  }

  /**
   * Set gain value
   */
  setGain(value) {
    if (this.gainNode) {
      this.gainNode.gain.value = value;
      console.log('🔊 Gain set to:', value.toFixed(1) + 'x');
    }
  }

  /**
   * Toggle microphone on/off
   */
  async toggle() {
    if (this.isEnabled) {
      this.stop();
      return false;
    } else {
      await this.start(this.selectedDeviceId);
      return true;
    }
  }

  /**
   * Change microphone device
   */
  async changeDevice(deviceId) {
    const wasEnabled = this.isEnabled;

    if (wasEnabled) {
      this.stop();
    }

    this.selectedDeviceId = deviceId;

    if (wasEnabled) {
      await this.start(deviceId);
    }
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      enabled: this.isEnabled,
      deviceId: this.selectedDeviceId,
      hasStream: !!this.stream,
    };
  }
}
