import { useState, useEffect } from 'react';

function MicrophoneControls({ micEnabled, onToggle, microphoneManager }) {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('default');
  const [audioLevel, setAudioLevel] = useState(0);
  const [gain, setGain] = useState(5.0);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);

  useEffect(() => {
    // Load settings and audio devices
    async function loadSettings() {
      const savedGain = await window.electronAPI.settingsGet('microphoneGain');
      const savedDevice = await window.electronAPI.settingsGet('microphoneDeviceId');

      if (savedGain !== null) {
        setGain(savedGain);
        microphoneManager.setGain(savedGain);
      }

      if (savedDevice !== null) {
        setSelectedDevice(savedDevice);
      }

      setIsLoadingSettings(false);
    }

    loadSettings();

    // Load audio devices
    microphoneManager.getDevices().then(setDevices);

    // Update audio level periodically
    const interval = setInterval(() => {
      if (micEnabled) {
        const level = microphoneManager.getAudioLevel();
        setAudioLevel(level);
      } else {
        setAudioLevel(0);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [micEnabled, microphoneManager]);

  const handleDeviceChange = async (deviceId) => {
    setSelectedDevice(deviceId);
    if (micEnabled) {
      await microphoneManager.changeDevice(deviceId);
    }
    // Save to settings
    if (!isLoadingSettings) {
      await window.electronAPI.settingsSet('microphoneDeviceId', deviceId);
    }
  };

  const handleGainChange = (newGain) => {
    setGain(newGain);
    microphoneManager.setGain(newGain);
    // Save to settings
    if (!isLoadingSettings) {
      window.electronAPI.settingsSet('microphoneGain', newGain);
    }
  };

  return (
    <div className="space-y-2">
      {/* Device Selector and Enable Button */}
      <div className="flex gap-2">
        <select
          value={selectedDevice}
          onChange={(e) => handleDeviceChange(e.target.value)}
          className="flex-1 min-w-0 input text-xs"
        >
          <option value="default">Default</option>
          {devices.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
            </option>
          ))}
        </select>

        <button
          onClick={onToggle}
          className={`px-3 py-2 rounded-lg font-medium flex items-center justify-center transition-colors flex-shrink-0 ${
            micEnabled
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
          title={micEnabled ? 'Disable Microphone' : 'Enable Microphone'}
        >
          <span className="material-icons text-lg">
            {micEnabled ? 'mic_off' : 'mic'}
          </span>
        </button>
      </div>

      {/* Gain Slider */}
      {micEnabled && (
        <div>
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span>Gain</span>
            <span>{gain.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="50.0"
            step="0.5"
            value={gain}
            onChange={(e) => handleGainChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
          />
        </div>
      )}

      {/* Audio Level Meter */}
      {micEnabled && (
        <div>
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span>Audio Level</span>
            <span>{Math.round(audioLevel * 100)}%</span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-100"
              style={{ width: `${audioLevel * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Status */}
      <div className="flex items-center gap-2 text-xs">
        <div
          className={`w-2 h-2 rounded-full ${micEnabled ? 'bg-green-500' : 'bg-gray-500'}`}
        />
        <span className="text-gray-400">{micEnabled ? 'Active' : 'Inactive'}</span>
      </div>
    </div>
  );
}

export default MicrophoneControls;
