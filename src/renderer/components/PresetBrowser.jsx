import { useState } from 'react';
import { PRESET_CATEGORIES } from '../../shared/constants.js';
import PresetCard from './PresetCard.jsx';

function PresetBrowser({ visualizationController, onPresetSelect, onPresetSelectWindow, windows }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentCategory, setCurrentCategory] = useState('all');
  const [disabledPresets, setDisabledPresets] = useState(visualizationController.disabledPresets);

  const allPresets = visualizationController.getAllPresets();

  const handleTogglePresetEnabled = async (presetName) => {
    await visualizationController.togglePresetEnabled(presetName);
    setDisabledPresets([...visualizationController.disabledPresets]);
  };

  // Filter presets
  let filteredPresets = allPresets;

  if (currentCategory !== 'all') {
    filteredPresets = filteredPresets.filter((p) => p.category === currentCategory);
  }

  if (searchTerm.trim()) {
    const term = searchTerm.toLowerCase();
    filteredPresets = filteredPresets.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.displayName.toLowerCase().includes(term) ||
        p.author.toLowerCase().includes(term)
    );
  }

  const handleRandomPreset = () => {
    const randomPreset = visualizationController.getRandomPreset();
    if (randomPreset) {
      onPresetSelect(randomPreset.name);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Search Bar */}
      <div className="p-4 bg-gray-800 border-b border-gray-700 flex justify-between items-center">
        <div className="flex-1 max-w-md">
          <input
            type="text"
            className="w-full input"
            placeholder="Search presets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-4 text-gray-400">
          <span className="text-sm">
            {filteredPresets.length} of {allPresets.length} presets
          </span>
          <button onClick={handleRandomPreset} className="btn-primary flex items-center gap-1.5">
            <span className="material-icons text-lg">casino</span>
            Random
          </button>
        </div>
      </div>

      {/* Category Filters */}
      <div className="p-2.5 px-4 bg-gray-800 border-b border-gray-700 flex gap-2.5">
        {PRESET_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            className={`px-3 py-1.5 rounded text-xs cursor-pointer transition-all ${
              currentCategory === cat.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
            }`}
            onClick={() => setCurrentCategory(cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Preset Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredPresets.length === 0 ? (
          <div className="text-center p-10 text-gray-500 flex flex-col items-center">
            <span className="material-icons text-5xl mb-2.5">search_off</span>
            <div className="text-base">No presets found</div>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
            {filteredPresets.map((preset) => (
              <PresetCard
                key={preset.name}
                preset={preset}
                onSelect={() => onPresetSelect(preset.name)}
                onSelectWindow={(windowId) => onPresetSelectWindow(windowId, preset.name)}
                windows={windows}
                isDisabled={disabledPresets.includes(preset.name)}
                onToggleEnabled={handleTogglePresetEnabled}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default PresetBrowser;
