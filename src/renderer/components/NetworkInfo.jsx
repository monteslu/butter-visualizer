import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function NetworkInfo() {
  const [networkInfo, setNetworkInfo] = useState(null);
  const [selectedAddress, setSelectedAddress] = useState(null);

  useEffect(() => {
    loadNetworkInfo();
  }, []);

  const loadNetworkInfo = async () => {
    const info = await window.electronAPI.getNetworkInfo();
    setNetworkInfo(info);
    if (info.addresses.length > 0) {
      setSelectedAddress(info.addresses[0]);
    }
  };

  if (!networkInfo || networkInfo.addresses.length === 0) {
    return null;
  }

  const currentUrl = selectedAddress
    ? `http://${selectedAddress.address}:${networkInfo.port}/popup`
    : null;

  return (
    <div className="space-y-2">
      {/* Network address selector */}
      {networkInfo.addresses.length > 1 && (
        <select
          value={selectedAddress?.address || ''}
          onChange={(e) => {
            const addr = networkInfo.addresses.find((a) => a.address === e.target.value);
            setSelectedAddress(addr);
          }}
          className="w-full bg-gray-700 text-white text-xs rounded px-2 py-1 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {networkInfo.addresses.map((addr) => (
            <option key={addr.address} value={addr.address}>
              {addr.name} - {addr.address}
            </option>
          ))}
        </select>
      )}

      {/* QR Code */}
      {currentUrl && (
        <div className="flex flex-col items-center gap-2">
          <div className="bg-white p-2 rounded">
            <QRCodeSVG value={currentUrl} size={120} level="M" />
          </div>

          {/* URL Display */}
          <div className="w-full flex items-center gap-1">
            <input
              type="text"
              value={currentUrl}
              readOnly
              className="flex-1 bg-gray-700 text-white rounded px-2 py-1 border border-gray-600 font-mono text-xs"
            />
            <button
              onClick={() => navigator.clipboard.writeText(currentUrl)}
              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
              title="Copy to clipboard"
            >
              <span className="material-icons text-sm">content_copy</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
