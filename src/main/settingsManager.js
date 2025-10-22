import { app } from 'electron';
import path from 'path';
import fs from 'fs/promises';

/**
 * SettingsManager - Manages persistent app settings
 */
class SettingsManager {
  constructor() {
    this.settingsPath = path.join(app.getPath('userData'), 'settings.json');
    this.settings = null;
    this.saveTimeout = null;
    this.isDirty = false;
  }

  async load() {
    try {
      const data = await fs.readFile(this.settingsPath, 'utf8');
      this.settings = JSON.parse(data);
      console.log('✅ Settings loaded:', this.settingsPath);
    } catch {
      // Try to restore from backup if main file is corrupted
      const backupPath = this.settingsPath + '.backup';
      try {
        const backupData = await fs.readFile(backupPath, 'utf8');
        this.settings = JSON.parse(backupData);
        console.log('✅ Settings restored from backup');

        // Save the restored settings back to main file
        await this.save();
      } catch {
        // Backup also failed or doesn't exist, use defaults
        this.settings = {
          microphoneDeviceId: 'default',
          microphoneGain: 5.0,
          disabledPresets: [],
        };
        console.log('✅ Using default settings');
      }
    }
    return this.settings;
  }

  async save() {
    if (!this.isDirty) {
      return; // No changes since last save
    }

    try {
      // Validate that settings can be serialized to JSON
      const jsonString = JSON.stringify(this.settings, null, 2);

      // Validate that it can be parsed back (catch any JSON issues)
      JSON.parse(jsonString);

      // Create backup of existing file before overwriting
      const backupPath = this.settingsPath + '.backup';
      try {
        await fs.copyFile(this.settingsPath, backupPath);
      } catch (backupError) {
        // File might not exist yet, that's okay
        if (backupError.code !== 'ENOENT') {
          console.warn('⚠️ Could not create settings backup:', backupError.message);
        }
      }

      // Write directly
      await fs.writeFile(this.settingsPath, jsonString, 'utf8');

      this.isDirty = false;
      console.log('💾 Settings saved');
    } catch (error) {
      console.error('❌ Failed to save settings:', error);
      throw error; // Propagate error so caller knows save failed
    }
  }

  get(key, defaultValue = null) {
    if (!this.settings) {
      throw new Error('Settings not loaded. Call load() first.');
    }
    const value = this.settings[key] !== undefined ? this.settings[key] : defaultValue;
    return value;
  }

  set(key, value) {
    if (!this.settings) {
      throw new Error('Settings not loaded. Call load() first.');
    }
    this.settings[key] = value;
    this.isDirty = true;

    // Debounce saves - wait 1 second after last change before saving
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.save();
    }, 1000);
  }

  /**
   * Force immediate save (used on app quit)
   */
  async saveNow() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    if (this.isDirty) {
      await this.save();
    }
  }

  // Convenience methods
  getMicrophoneDeviceId() {
    return this.get('microphoneDeviceId', 'default');
  }

  setMicrophoneDeviceId(deviceId) {
    this.set('microphoneDeviceId', deviceId);
  }

  getMicrophoneGain() {
    return this.get('microphoneGain', 5.0);
  }

  setMicrophoneGain(gain) {
    this.set('microphoneGain', gain);
  }

  getDisabledPresets() {
    return this.get('disabledPresets', []);
  }

  setDisabledPresets(presets) {
    this.set('disabledPresets', presets);
  }

  togglePresetEnabled(presetName) {
    const disabled = this.getDisabledPresets();
    const index = disabled.indexOf(presetName);

    if (index === -1) {
      // Not disabled, add to disabled list
      disabled.push(presetName);
    } else {
      // Already disabled, remove from list
      disabled.splice(index, 1);
    }

    this.setDisabledPresets(disabled);
    return disabled;
  }

  isPresetDisabled(presetName) {
    const disabled = this.getDisabledPresets();
    return disabled.includes(presetName);
  }
}

export default SettingsManager;
