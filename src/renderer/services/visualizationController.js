/**
 * VisualizationController - Manages butterchurn presets and window coordination
 */
export class VisualizationController {
  constructor(webrtcController = null) {
    this.webrtcController = webrtcController;
    this.presets = [];
    this.presetNames = [];
    this.currentPresets = new Map(); // windowId -> presetName
    this.disabledPresets = [];
    this.initialized = false;
  }

  /**
   * Initialize with butterchurn presets
   */
  async initialize() {
    try {
      // Load butterchurn presets from global
      if (window.butterchurnPresets) {
        const presetsObj = window.butterchurnPresets.getPresets();
        this.presetNames = Object.keys(presetsObj);
        this.presets = this.getPresetList();
        this.initialized = true;

        // Load disabled presets from settings
        const disabled = await window.electronAPI.settingsGet('disabledPresets');
        if (disabled) {
          this.disabledPresets = disabled;
        }
      } else {
        console.error('Butterchurn presets not loaded');
      }
    } catch (error) {
      console.error('Failed to initialize presets:', error);
    }
  }

  /**
   * Get all presets with metadata
   */
  getPresetList() {
    return this.presetNames.map((name) => {
      const parts = name.split(' - ');
      const author = parts[0] || '';
      const displayName = parts.slice(1).join(' - ') || author;

      // Determine category based on author
      let category = 'other';
      const authorLower = author.toLowerCase();
      if (authorLower.includes('geiss')) category = 'geiss';
      else if (authorLower.includes('martin')) category = 'martin';
      else if (authorLower.includes('flexi')) category = 'flexi';
      else if (authorLower.includes('shifter')) category = 'shifter';

      return {
        name,
        displayName,
        author,
        category,
        thumbnailPath: this.sanitizeFilename(name),
      };
    });
  }

  /**
   * Get presets filtered by category
   */
  getPresetsByCategory(category) {
    if (category === 'all') {
      return this.presets;
    }
    return this.presets.filter((preset) => preset.category === category);
  }

  /**
   * Search presets
   */
  searchPresets(searchTerm) {
    if (!searchTerm.trim()) {
      return this.presets;
    }

    const term = searchTerm.toLowerCase();
    return this.presets.filter(
      (preset) =>
        preset.name.toLowerCase().includes(term) ||
        preset.displayName.toLowerCase().includes(term) ||
        preset.author.toLowerCase().includes(term)
    );
  }

  /**
   * Sanitize preset name to filename
   */
  sanitizeFilename(name) {
    return name.replace(/[^a-zA-Z0-9-_\s]/g, '_') + '.png';
  }

  /**
   * Set preset for a specific window
   */
  async setWindowPreset(windowId, presetName) {
    try {
      this.currentPresets.set(windowId, presetName);

      // Send via IPC (for Electron popups)
      await window.electronAPI.setPreset(windowId, presetName);

      // Also send via WebRTC control channel (for browser clients)
      if (this.webrtcController) {
        this.webrtcController.sendControlMessage(windowId, {
          type: 'preset-change',
          preset: presetName,
        });
      }
    } catch (error) {
      console.error('Failed to set preset:', error);
    }
  }

  /**
   * Set preset for all windows
   */
  async setAllWindowsPreset(presetName) {
    try {
      await window.electronAPI.setAllPresets(presetName);
      // Update tracking for all windows
      this.currentPresets.forEach((_, windowId) => {
        this.currentPresets.set(windowId, presetName);
      });
    } catch (error) {
      console.error('Failed to set all presets:', error);
    }
  }

  /**
   * Get random preset (skipping disabled presets)
   */
  getRandomPreset() {
    const enabledPresets = this.presets.filter(
      (preset) => !this.disabledPresets.includes(preset.name)
    );

    if (enabledPresets.length === 0) {
      console.warn('No enabled presets available, using all presets');
      return this.presets[Math.floor(Math.random() * this.presets.length)];
    }

    const randomIndex = Math.floor(Math.random() * enabledPresets.length);
    return enabledPresets[randomIndex];
  }

  /**
   * Get next preset for a window (skipping disabled presets)
   */
  getNextPreset(windowId) {
    const currentPreset = this.getCurrentPreset(windowId);
    const enabledPresets = this.presets.filter(
      (preset) => !this.disabledPresets.includes(preset.name)
    );

    if (enabledPresets.length === 0) {
      return this.presets[0];
    }

    const currentIndex = enabledPresets.findIndex((p) => p.name === currentPreset);
    const nextIndex = (currentIndex + 1) % enabledPresets.length;
    return enabledPresets[nextIndex];
  }

  /**
   * Get previous preset for a window (skipping disabled presets)
   */
  getPreviousPreset(windowId) {
    const currentPreset = this.getCurrentPreset(windowId);
    const enabledPresets = this.presets.filter(
      (preset) => !this.disabledPresets.includes(preset.name)
    );

    if (enabledPresets.length === 0) {
      return this.presets[0];
    }

    const currentIndex = enabledPresets.findIndex((p) => p.name === currentPreset);
    const prevIndex = (currentIndex - 1 + enabledPresets.length) % enabledPresets.length;
    return enabledPresets[prevIndex];
  }

  /**
   * Toggle preset enabled/disabled state
   */
  async togglePresetEnabled(presetName) {
    const result = await window.electronAPI.settingsTogglePreset(presetName);
    this.disabledPresets = result.disabledPresets;
    return !this.disabledPresets.includes(presetName);
  }

  /**
   * Check if preset is disabled
   */
  isPresetDisabled(presetName) {
    return this.disabledPresets.includes(presetName);
  }

  /**
   * Get current preset for window
   */
  getCurrentPreset(windowId) {
    return this.currentPresets.get(windowId);
  }

  /**
   * Track window preset
   */
  trackWindowPreset(windowId, presetName) {
    this.currentPresets.set(windowId, presetName);
  }

  /**
   * Remove window tracking
   */
  removeWindow(windowId) {
    this.currentPresets.delete(windowId);
  }

  /**
   * Get all presets (raw)
   */
  getAllPresets() {
    return this.presets;
  }

  /**
   * Get preset categories
   */
  getCategories() {
    const categories = new Map();
    this.presets.forEach((preset) => {
      if (!categories.has(preset.category)) {
        categories.set(preset.category, []);
      }
      categories.get(preset.category).push(preset);
    });
    return categories;
  }
}
