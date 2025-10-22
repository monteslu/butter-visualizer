function ConnectionStatus({ connectionState, currentPreset }) {
  const getStatusColor = () => {
    switch (connectionState) {
      case 'connected':
        return 'bg-green-500';
      case 'connecting':
        return 'bg-yellow-500';
      case 'failed':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = () => {
    switch (connectionState) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'failed':
        return 'Connection Failed';
      default:
        return 'Disconnected';
    }
  };

  // Only show status when not connected
  if (connectionState === 'connected') {
    return null;
  }

  return (
    <div className="absolute top-4 left-4 bg-black bg-opacity-70 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-3">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
        <span>{getStatusText()}</span>
      </div>

      {currentPreset && (
        <>
          <div className="w-px h-4 bg-gray-600" />
          <span className="text-gray-300 truncate max-w-xs">{currentPreset}</span>
        </>
      )}
    </div>
  );
}

export default ConnectionStatus;
