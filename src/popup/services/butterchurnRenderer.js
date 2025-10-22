import { BUTTERCHURN_CONFIG } from '../../shared/constants.js';

/**
 * ButterchurnRenderer - Renders butterchurn visualizations on canvas
 */
export class ButterchurnRenderer {
  constructor(canvas, dataChannel, socketReceiver = null) {
    this.canvas = canvas;
    this.visualizer = null;
    this.audioContext = null;
    this.sourceNode = null;
    this.analyser = null;
    this.animationId = null;
    this.currentPreset = null;
    this.dataChannel = dataChannel;
    this.socketReceiver = socketReceiver; // For browser mode notifications

    // Storage for received audio data (time domain only)
    this.latestTimeData = null;
  }

  /**
   * Initialize butterchurn with DataChannel for audio data
   */
  async initialize() {
    try {
      console.log('🎵 Initializing butterchurn with DataChannel audio...');

      // Detect butterchurn API (might be exposed differently)
      let butterchurnAPI = null;
      if (typeof window.butterchurn.createVisualizer === 'function') {
        butterchurnAPI = window.butterchurn;
        console.log('Using window.butterchurn.createVisualizer');
      } else if (
        window.butterchurn.default &&
        typeof window.butterchurn.default.createVisualizer === 'function'
      ) {
        butterchurnAPI = window.butterchurn.default;
        console.log('Using window.butterchurn.default.createVisualizer');
      } else if (typeof window.butterchurn === 'function') {
        butterchurnAPI = window.butterchurn;
        console.log('Using window.butterchurn as constructor');
      }

      if (!butterchurnAPI || typeof butterchurnAPI.createVisualizer !== 'function') {
        console.error(
          'Butterchurn createVisualizer not found. Available methods:',
          butterchurnAPI ? Object.keys(butterchurnAPI) : 'none',
          'window.butterchurn:',
          window.butterchurn
        );
        throw new Error('Butterchurn API not compatible');
      }

      // Create offline audio context (no hardware access needed - we're patching the analysers)
      // Parameters: channels, length, sampleRate (minimal overhead)
      this.audioContext = new OfflineAudioContext(2, 44100, 44100);
      console.log('🎵 OfflineAudioContext created (no hardware access):', this.audioContext.state);

      // Don't initialize with data - wait for real DataChannel data
      this.latestTimeData = null;

      console.log('🎵 Waiting for binary time domain data from DataChannel');

      // Listen for audio data from DataChannel (binary ArrayBuffer)
      // Data arrives at optimal rate (no overlap): fftSize samples / sampleRate = ~23.4fps for 2048@48kHz
      let messageCount = 0;
      this.dataChannel.onmessage = (event) => {
        try {
          // Receive binary time domain data
          const timeData = new Uint8Array(event.data);
          this.latestTimeData = timeData;

          messageCount++;
          if (messageCount === 1 || messageCount % 25 === 0) {
            const timeAvg = timeData.reduce((a, b) => a + b, 0) / timeData.length;
            const timeMin = Math.min(...timeData);
            const timeMax = Math.max(...timeData);
            const timeRange = timeMax - timeMin;
            console.log(`📊 DataChannel message #${messageCount} (binary, optimized rate)`);
            console.log(`   TIME avg: ${timeAvg.toFixed(2)}, range: ${timeRange}, size: ${timeData.length} bytes`);
          }
        } catch (e) {
          console.error('Failed to process binary audio data:', e);
        }
      };


      // Initialize butterchurn visualizer
      this.visualizer = butterchurnAPI.createVisualizer(
        this.audioContext,
        this.canvas,
        {
          width: this.canvas.width,
          height: this.canvas.height,
          ...BUTTERCHURN_CONFIG,
        }
      );

      // DON'T connect audio - we're patching butterchurn's internal analysers instead
      // this.visualizer.connectAudio(this.analyser);

      // Patch butterchurn's INTERNAL analysers to use our DataChannel data
      console.log('🔧 Patching butterchurn internal analysers...');
      console.log('Visualizer audio object:', this.visualizer.audio);

      const audioProcessor = this.visualizer.audio;
      if (audioProcessor) {
        // Patch the three internal analysers - only time domain needed (Butterchurn does its own FFT)
        const patchAnalyser = (analyser, name) => {
          // Patch time domain data
          const originalTime = analyser.getByteTimeDomainData.bind(analyser);

          analyser.getByteTimeDomainData = (array) => {
            if (this.latestTimeData) {
              // Copy only the minimum of the two array sizes to avoid out of bounds
              const copyLength = Math.min(array.length, this.latestTimeData.length);
              array.set(this.latestTimeData.subarray(0, copyLength));
            } else {
              // No data yet, use original (which will return silence)
              originalTime(array);
            }
          };

          console.log(`✅ Patched ${name}.getByteTimeDomainData (expects ${analyser.fftSize} samples)`);
        };

        patchAnalyser(audioProcessor.analyser, 'analyser (mono)');
        patchAnalyser(audioProcessor.analyserL, 'analyserL');
        patchAnalyser(audioProcessor.analyserR, 'analyserR');

        console.log('✅ All butterchurn analysers patched (binary time domain data only)!');
      } else {
        console.error('❌ Could not find butterchurn audio processor!');
      }

      // Load a random preset to start
      const presets = window.butterchurnPresets.getPresets();
      const presetNames = Object.keys(presets);
      const randomPreset = presetNames[Math.floor(Math.random() * presetNames.length)];

      console.log('Loading random preset:', randomPreset);
      this.loadPreset(randomPreset);

      // Notify dashboard what preset we loaded
      if (window.electronAPI) {
        // Electron mode: use IPC
        window.electronAPI.notifyPresetLoaded(randomPreset);
        console.log('Notified dashboard of preset via IPC:', randomPreset);
      } else if (this.socketReceiver) {
        // Browser mode: send via Socket.IO
        this.socketReceiver.notifyPresetLoaded(randomPreset);
      }

      // Start rendering
      this.startRendering();

      // Check internal buffer right after filling to see if visualization should be working
      console.log('✅ Butterchurn setup complete. Audio data should be flowing to visualizer.');

      console.log('✅ Butterchurn initialized successfully with DataChannel audio');
    } catch (error) {
      console.error('❌ Failed to initialize butterchurn:', error);
    }
  }

  /**
   * Load a preset by name
   */
  loadPreset(presetName) {
    if (!this.visualizer) return;

    try {
      const presets = window.butterchurnPresets.getPresets();
      if (presets[presetName]) {
        this.visualizer.loadPreset(presets[presetName], 2.0); // 2 second transition
        this.currentPreset = presetName;
        console.log('Loaded preset:', presetName);
      } else {
        console.warn('Preset not found:', presetName);
      }
    } catch (error) {
      console.error('Failed to load preset:', error);
    }
  }

  /**
   * Start rendering loop
   */
  startRendering() {
    const render = () => {
      if (this.visualizer) {
        this.visualizer.render();
      }
      this.animationId = requestAnimationFrame(render);
    };
    render();
  }

  /**
   * Stop rendering
   */
  stopRendering() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * Handle canvas resize
   */
  handleResize(width, height) {
    if (this.canvas) {
      this.canvas.width = width;
      this.canvas.height = height;
    }

    if (this.visualizer) {
      this.visualizer.setRendererSize(width, height);
    }
  }

  /**
   * Cleanup
   */
  cleanup() {
    this.stopRendering();

    if (this.audioContext) {
      this.audioContext.close();
    }

    this.visualizer = null;
    this.audioContext = null;
    this.dataChannel = null;
    this.latestTimeData = null;
  }
}
