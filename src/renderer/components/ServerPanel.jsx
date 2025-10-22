import { useState, useEffect } from 'react';

function ServerPanel() {
  const [serverStatus, setServerStatus] = useState(null);

  useEffect(() => {
    loadServerStatus();
  }, []);

  const loadServerStatus = async () => {
    try {
      const status = await window.electronAPI.getServerStatus();
      setServerStatus(status);
    } catch (error) {
      console.error('Failed to get server status:', error);
    }
  };

  if (!serverStatus) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <div
        className={`w-2 h-2 rounded-full ${serverStatus.running ? 'bg-green-500' : 'bg-gray-500'}`}
      />
      <span className="text-gray-400">
        {serverStatus.running ? 'Server Running' : 'Stopped'}
      </span>
      {serverStatus.running && (
        <a
          href={serverStatus.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:text-blue-400 transition-colors"
        >
          {serverStatus.url}
        </a>
      )}
    </div>
  );
}

export default ServerPanel;
