# Butter Visualizer Architecture

## Overview

Butter Visualizer is an Electron-based application that provides synchronized Butterchurn music visualizations across multiple windows (both Electron popups and browser clients). Audio from the microphone is streamed to all visualization windows via WebRTC DataChannels.

## Core Components

### Main Process (Electron)

- **main.js**: Application entry point, orchestrates all services
- **windowManager.js**: Manages Electron popup windows
- **expressServer.js**: HTTP/Socket.IO server on port 4069
- **ipcHandlers.js**: IPC communication between main and renderer
- **settingsManager.js**: Persistent settings storage

### Renderer Process (Dashboard)

The main control interface running at `http://localhost:4069/renderer/`

**Key Services:**
- **microphoneManager.js**: Captures and analyzes microphone input
- **webrtcController.js**: Manages WebRTC peer connections to all windows
- **visualizationController.js**: Manages preset selection and distribution

**Components:**
- **Dashboard.jsx**: Main UI container
- **MicrophoneControls.jsx**: Mic enable/disable, device selection, gain
- **WindowManager.jsx**: List of active visualization windows
- **PresetBrowser.jsx**: Browse and select Butterchurn presets
- **NetworkInfo.jsx**: QR code and network URL for remote access

### Popup Windows

Visualization windows that can run as:
1. **Electron popups** (spawned from main window)
2. **Browser clients** (mobile phones, tablets, other computers)

Both load from `http://localhost:4069/popup`

**Key Components:**
- **PopupCanvas.jsx**: Canvas rendering and lifecycle
- **ButterchurnRenderer.js**: Butterchurn visualization engine
- **WebRTCReceiver.js**: Receives data via WebRTC (Electron popups)
- **SocketReceiver.js**: Receives data via Socket.IO + WebRTC (browser clients)

## Communication Architecture

### WebRTC DataChannels (Audio + Control)

Each visualization window has TWO DataChannels:

1. **Audio DataChannel** (`audioData`)
   - Unordered, unreliable (maxRetransmits: 0)
   - Sends binary time-domain audio data (Uint8Array)
   - ~23fps at 48kHz sample rate
   - Butterchurn does its own FFT analysis

2. **Control DataChannel** (`control`)
   - Ordered, reliable
   - JSON messages for preset changes
   - Example: `{ type: 'preset-change', preset: 'Geiss - Tornado' }`

### Connection Types

#### Electron Popups
```
Dashboard → IPC (main process) → WebRTC Offer/Answer → Popup Window
         ↓
    DataChannels (audio + control)
```

#### Browser Clients
```
Browser → Socket.IO (signaling) → Express Server → IPC → Dashboard
       ↓
  WebRTC DataChannels (audio + control)
```

### Preset Loading Flow

**For Electron Popups:**
1. Popup loads and picks random preset
2. Popup sends `preset:loaded` via IPC to main process
3. Main process forwards to dashboard
4. Dashboard updates window list with correct thumbnail

**For Browser Clients:**
1. Browser loads and picks random preset
2. Browser sends `preset:loaded` via Socket.IO to Express
3. Express forwards to main process via event emitter
4. Main process sends to dashboard via IPC
5. Dashboard updates window list

**Changing Presets:**
- Dashboard → IPC (Electron) + WebRTC control channel (all windows)
- Popups receive via IPC listener (Electron) or control channel callback (browser)

## Port Architecture

**Single Port: 4069**
- Express server serves everything
- HTTP endpoints for REST API
- Socket.IO for browser client signaling
- Static files (renderer, popup, libs)

**No Vite Dev Server in Production**
- Dev mode: Build once, serve from port 4069
- Production: Same - everything on 4069

## Audio Flow

```
Microphone
    ↓
AudioContext (Dashboard)
    ↓
AnalyserNode (2048 FFT)
    ↓
getByteTimeDomainData() ~23fps
    ↓
WebRTC DataChannel (binary)
    ↓
Popup Windows
    ↓
Patch Butterchurn's internal analysers
    ↓
Butterchurn renders visualization
```

**Key Innovation**: Popups use `OfflineAudioContext` (no hardware access needed) and patch Butterchurn's internal analysers to inject the DataChannel audio data directly.

## File Structure

```
src/
├── main/                    # Electron main process
│   ├── main.js
│   ├── windowManager.js
│   ├── expressServer.js
│   ├── ipcHandlers.js
│   ├── preload.js
│   └── settingsManager.js
├── renderer/                # Dashboard UI
│   ├── components/
│   ├── services/
│   ├── styles/
│   ├── App.jsx
│   └── main.jsx
├── popup/                   # Visualization windows
│   ├── components/
│   ├── services/
│   ├── styles/
│   └── popup.jsx
├── shared/                  # Shared constants
│   ├── constants.js
│   └── ipcChannels.js
└── lib/                     # External libraries
    ├── butterchurn.min.js
    └── butterchurnPresets.min.js

public/
├── butterchurn-screenshots/ # Preset thumbnails
└── fonts/                   # Material Icons

docs/
├── ARCHITECTURE.md          # This file
├── SPECIFICATION.md         # Original spec
└── WEBRTC-ARCHITECTURE.md   # WebRTC details
```

## Development Workflow

```bash
npm run dev                  # Build all + start Electron
npm run build:all           # Build renderer + popup
npm run build:linux         # Build Linux AppImage
```

**Dev Mode:**
1. Builds renderer and popup with Vite
2. Starts Electron with `NODE_ENV=production`
3. Express serves built files from port 4069
4. DevTools open automatically

## Key Design Decisions

1. **DataChannels over MediaStream**: More efficient, no audio hardware needed in popups
2. **Dual DataChannels**: Separate reliable control from unreliable audio
3. **OfflineAudioContext**: Popups don't claim audio hardware
4. **Single Port**: Simplified networking, easier firewall rules
5. **Build-based Dev**: No Vite proxy complexity, faster startup
6. **Preset from Popup**: Avoids race conditions, popup knows what it loaded
7. **Silence Fallback**: Connections work before mic is enabled

## Browser Compatibility

- Modern browsers with WebRTC support
- Socket.IO for signaling (works through firewalls)
- Mobile-friendly (tested on Android/iOS)
- QR code for easy connection
