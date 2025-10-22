import WindowCard from './WindowCard.jsx';

function WindowManager({ windows, onCreateWindow, onCloseWindow, onPresetChange, visualizationController }) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="py-2 border-b border-gray-700 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">
          Windows ({windows.length})
        </h2>
        <button
          onClick={onCreateWindow}
          className="btn-primary text-xs flex items-center gap-1 px-2 py-1"
        >
          <span className="material-icons text-sm">add</span>
          New
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2 space-y-2">
        {windows.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <span className="material-icons text-5xl mb-2">
              desktop_windows
            </span>
            <p className="text-sm">No visualization windows</p>
            <p className="text-xs mt-1">Click "New Window" to create one</p>
          </div>
        ) : (
          windows.map((window) => (
            <WindowCard
              key={window.id}
              window={window}
              onClose={onCloseWindow}
              onPresetChange={onPresetChange}
              visualizationController={visualizationController}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default WindowManager;
