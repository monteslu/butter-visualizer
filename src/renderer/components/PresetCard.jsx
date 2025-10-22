import { useState } from 'react';

function PresetCard({ preset, onSelect, onSelectWindow, windows, isDisabled, onToggleEnabled }) {
  const [selectedWindow, setSelectedWindow] = useState('all');
  const screenshotPath = `/butterchurn-screenshots/${preset.thumbnailPath}`;

  const handleApply = (e) => {
    e.stopPropagation();
    if (selectedWindow === 'all') {
      onSelect();
    } else {
      const windowId = parseInt(selectedWindow);
      onSelectWindow(windowId);
    }
  };

  const handleToggleEnabled = async (e) => {
    e.stopPropagation();
    if (onToggleEnabled) {
      await onToggleEnabled(preset.name);
    }
  };

  return (
    <div
      className={`card p-0 cursor-pointer transition-all overflow-hidden flex flex-col hover:border-blue-600 ${isDisabled ? 'opacity-50' : ''}`}
      onClick={onSelect}
    >
      {/* Thumbnail */}
      <div className="relative w-full h-[150px] bg-gray-900 overflow-hidden">
        <img
          src={screenshotPath}
          alt={preset.displayName}
          className="w-full h-full object-cover transition-transform hover:scale-105"
          onError={(e) => {
            e.target.style.display = 'none';
            e.target.nextElementSibling.style.display = 'flex';
          }}
        />
        <div className="absolute top-0 left-0 w-full h-full hidden items-center justify-center bg-gray-900 text-gray-600">
          <span className="material-icons text-5xl">image_not_supported</span>
        </div>
        {/* Disabled indicator and toggle button */}
        {isDisabled && (
          <div className="absolute top-0 left-0 w-full h-full bg-black bg-opacity-50 flex items-center justify-center">
            <span className="material-icons text-5xl text-gray-400">block</span>
          </div>
        )}
        <button
          className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
            isDisabled
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-green-600 hover:bg-green-700'
          }`}
          onClick={handleToggleEnabled}
          title={isDisabled ? 'Enable preset' : 'Disable preset'}
        >
          <span className="material-icons text-sm text-white">
            {isDisabled ? 'visibility_off' : 'visibility'}
          </span>
        </button>
      </div>

      {/* Info */}
      <div className="p-4 flex-1">
        <div className="inline-block bg-blue-600 text-white px-1.5 py-0.5 rounded text-[11px] mb-2 uppercase">
          {preset.category}
        </div>
        <div className="font-bold mb-1.5 text-sm text-white">
          {preset.displayName}
        </div>
        <div className="text-xs mb-1.5 text-gray-400">by {preset.author}</div>

        {/* Window selector and apply button */}
        <div className="mt-2 flex gap-2">
          <select
            value={selectedWindow}
            onChange={(e) => {
              e.stopPropagation();
              setSelectedWindow(e.target.value);
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 input text-xs py-1.5"
          >
            <option value="all">All Windows</option>
            {windows.map((window) => (
              <option key={window.id} value={window.id}>
                Window {window.id}
              </option>
            ))}
          </select>
          <button
            className="btn-primary text-xs px-3"
            onClick={handleApply}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

export default PresetCard;
