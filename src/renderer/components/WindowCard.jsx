import { useState } from 'react';

function WindowCard({ window, onClose, onPresetChange, visualizationController }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredPresets = visualizationController
    .getAllPresets()
    .filter(
      (preset) =>
        preset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        preset.displayName.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .slice(0, 5); // Show only top 5

  // Get current preset object to access thumbnailPath
  const currentPreset = window.preset
    ? visualizationController.getAllPresets().find((p) => p.name === window.preset)
    : null;

  return (
    <div className="card p-2">
      <div className="flex items-center gap-2 mb-2">
        {/* Thumbnail */}
        <div className="flex-shrink-0 w-12 h-12 bg-gray-700 rounded flex items-center justify-center overflow-hidden">
          {currentPreset ? (
            <img
              src={`/butterchurn-screenshots/${currentPreset.thumbnailPath}`}
              alt={currentPreset.displayName}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.outerHTML = '<span class="material-icons text-gray-500 text-xl">image</span>';
              }}
            />
          ) : (
            <span className="material-icons text-gray-500 text-xl">image</span>
          )}
        </div>

        {/* Window number */}
        <span className="text-white text-sm font-medium">#{window.id}</span>

        {/* Preset name */}
        {window.preset && (
          <div className="flex-1 min-w-0 text-xs text-gray-400 truncate">
            {window.preset}
          </div>
        )}

        {/* Close button */}
        <button
          onClick={() => onClose(window.id)}
          className="flex-shrink-0 text-gray-400 hover:text-red-500 transition-colors"
        >
          <span className="material-icons text-sm">close</span>
        </button>
      </div>

      {/* Preset controls - all on one line */}
      <div className="flex gap-1">
        <button
          onClick={() => {
            const prevPreset = visualizationController.getPreviousPreset(window.id);
            if (prevPreset) {
              onPresetChange(window.id, prevPreset.name);
            }
          }}
          className="btn-secondary px-2 py-1 flex items-center justify-center"
          title="Previous preset"
        >
          <span className="material-icons text-sm">skip_previous</span>
        </button>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex-1 btn-secondary px-2 py-1 text-xs flex items-center justify-center gap-1"
        >
          <span className="material-icons text-sm">
            {isExpanded ? 'expand_less' : 'expand_more'}
          </span>
          Change Preset
        </button>
        <button
          onClick={() => {
            const nextPreset = visualizationController.getNextPreset(window.id);
            if (nextPreset) {
              onPresetChange(window.id, nextPreset.name);
            }
          }}
          className="btn-secondary px-2 py-1 flex items-center justify-center"
          title="Next preset"
        >
          <span className="material-icons text-sm">skip_next</span>
        </button>
      </div>

      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-gray-700">
          <input
            type="text"
            placeholder="Search presets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full input text-sm mb-2"
          />
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {filteredPresets.map((preset) => (
              <button
                key={preset.name}
                onClick={() => {
                  onPresetChange(window.id, preset.name);
                  setIsExpanded(false);
                  setSearchTerm('');
                }}
                className="w-full text-left px-2 py-1.5 rounded hover:bg-gray-700 text-sm text-gray-300 hover:text-white transition-colors truncate"
              >
                {preset.displayName}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default WindowCard;
