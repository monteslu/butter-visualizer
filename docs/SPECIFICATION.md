# Butter Visualizer - Technical Specification

**Version:** 1.0.0
**License:** AGPL-3.0
**Purpose:** Multi-window audio-reactive visualization application with centralized control

---

## Overview

Butter Visualizer is an Electron-based application that creates multiple synchronized visualization windows driven by live microphone audio. The main window acts as a control dashboard, managing visualization windows and distributing audio streams via WebRTC peer connections.

### Core Concept

```
[Microphone Input] → [Main Dashboard Window] → [WebRTC Audio Stream] → [Popup Windows]
                            ↓                                                  ↓
                    [Control Interface]                            [Butterchurn Canvas]
```

---

## Technology Stack

### Desktop Framework
- **Electron** (latest stable)
- ES6 modules throughout (no CommonJS)
- Multi-process architecture (main + renderer + popup windows)

### Frontend
- **React** (latest) with functional components + hooks
- **Vite** for fast HMR development
- **Tailwind CSS 3** with dark mode (class strategy)
- Custom component classes (btn-primary, btn-secondary, input, card)
- Material Icons font for UI elements
- Clean ES6 imports (no require())

### Backend
- **Node.js Express** server on port 4069 (configurable)
- **Socket.IO** for real-time bidirectional communication
- REST API for remote control capabilities

### Audio & Visualization
- **Web Audio API** for microphone input
- **Butterchurn** v2.6+ for audio-reactive visualizations
- **Butterchurn Presets** v2.4+ (200+ presets)
- **WebRTC** for audio streaming (PeerConnection API)

---

## Architecture

### Process Structure

```
Main Process (Node.js)
├── main.js                    # Entry point, window management
├── expressServer.js           # Express + Socket.IO server
├── windowManager.js           # Popup window lifecycle management
└── ipcHandlers.js             # IPC communication handlers

Renderer Process (Main Window)
├── App.jsx                    # React root component
├── Dashboard.jsx              # Main control interface
├── microphoneManager.js       # Mic input + Web Audio API
├── webrtcController.js        # WebRTC connection management
└── visualizationController.js # Butterchurn preset control

Popup Window Process (per window)
├── popup.html                 # Minimal HTML container
├── PopupCanvas.jsx            # React canvas component
├── butterchurnRenderer.js     # Butterchurn instance
└── webrtcReceiver.js          # WebRTC audio stream receiver
```

---

## Main Dashboard Window (Renderer)

### UI Components

**Dashboard Layout:**
```jsx
<Dashboard>
  <Header>
    <AppTitle>Butter Visualizer</AppTitle>
    <MicrophoneStatus />
  </Header>

  <MainControls>
    <MicrophoneSelector />      {/* Select audio input device */}
    <MicrophoneToggle />        {/* Enable/disable mic input */}
    <AudioLevelMeter />         {/* Visual audio level indicator */}
  </MainControls>

  <WindowManager>
    <WindowList>
      {windows.map(window => (
        <WindowCard>
          <WindowPreview />      {/* Small canvas preview */}
          <WindowControls>
            <PresetSelector />   {/* Change visualization */}
            <CloseButton />      {/* Close window */}
          </WindowControls>
        </WindowCard>
      ))}
    </WindowList>
    <AddWindowButton />         {/* Create new popup */}
  </WindowManager>

  <PresetBrowser>
    <PresetSearch />            {/* Filter presets */}
    <PresetCategories />        {/* Group by author */}
    <PresetGrid>
      {presets.map(preset => (
        <PresetCard>
          <PresetThumbnail />    {/* 280x150px screenshot from kai-player */}
          <PresetInfo>
            <CategoryBadge />    {/* Geiss, Martin, Flexi, etc. */}
            <PresetName />
            <AuthorName />
          </PresetInfo>
          <CardActions>
            <UseButton />        {/* Apply to current window */}
            <ApplyAllButton />   {/* Apply to all windows */}
          </CardActions>
        </PresetCard>
      ))}
    </PresetGrid>
  </PresetBrowser>

  <ServerPanel>
    <ServerStatus />            {/* Express server status */}
    <ServerURL />               {/* Display access URL */}
    <QRCode />                  {/* Mobile access QR code */}
  </ServerPanel>
</Dashboard>
```

### Features

1. **Microphone Management**
   - Enumerate available audio input devices
   - Select default input device
   - Enable/disable microphone capture
   - Real-time audio level metering
   - Auto-restart on device change

2. **Window Management**
   - Create new visualization windows
   - Track active window states
   - Send preset changes to specific windows
   - Bulk control (apply preset to all windows)
   - Close individual or all windows

3. **Preset Management**
   - Browse 200+ butterchurn presets with thumbnails
   - Visual grid layout with preset screenshots (280x150px)
   - Search/filter by name or author
   - Category filtering (Geiss, Martin, Flexi, Shifter, Other)
   - Apply presets to specific windows
   - Apply presets to all windows at once
   - Hover effects and visual feedback

4. **WebRTC Coordination**
   - Create peer connection per popup window
   - Stream microphone audio to each peer
   - Manage connection lifecycle
   - Handle reconnection on failure

---

## Popup Visualization Windows

### Structure

Each popup window is a separate BrowserWindow with:
- **Frameless design** (optional - for clean fullscreen)
- **Canvas element** matching window dimensions
- **Butterchurn renderer** consuming audio stream
- **WebRTC receiver** for audio input

### Lifecycle

```
1. User clicks "Add Window" in dashboard
2. Main process creates new BrowserWindow
3. Popup loads popup.html with React app
4. Popup signals ready via IPC
5. Dashboard creates WebRTC offer
6. Popup accepts and establishes connection
7. Dashboard sends microphone MediaStream
8. Popup feeds audio to Butterchurn
9. Butterchurn renders to canvas at 60 FPS
```

### Canvas Rendering

```javascript
// PopupCanvas.jsx (simplified)
function PopupCanvas() {
  const canvasRef = useRef(null);
  const butterchurnRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);

  useEffect(() => {
    // Initialize Butterchurn
    const canvas = canvasRef.current;
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;

    butterchurnRef.current = butterchurn.createVisualizer(
      audioContext,
      canvas,
      { width: window.innerWidth, height: window.innerHeight }
    );

    audioContextRef.current = audioContext;
    analyserRef.current = analyser;

    // Start render loop
    startRenderLoop();
  }, []);

  const handleAudioStream = (stream) => {
    const source = audioContextRef.current.createMediaStreamSource(stream);
    source.connect(analyserRef.current);
  };

  return <canvas ref={canvasRef} />;
}
```

### Window-Specific Features

- Resize handling (update canvas dimensions + Butterchurn)
- Fullscreen toggle
- Independent preset selection
- Connection status indicator (small overlay)
- FPS counter (optional debug mode)

---

## WebRTC Audio Streaming

### Architecture

**Audio Flow:**
```
Microphone → MediaStream → Dashboard's AudioContext → WebRTC PeerConnection → Popup's AudioContext → Butterchurn Analyser
```

### Implementation Strategy

Unlike kai-player (which streams video via canvas.captureStream()), butter-visualizer streams **audio-only**:

**Dashboard (Sender):**
```javascript
// microphoneManager.js
class MicrophoneManager {
  async getMicrophoneStream() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        sampleRate: 48000
      },
      video: false
    });
    return this.stream;
  }
}

// webrtcController.js
class WebRTCController {
  async createPeerConnection(windowId) {
    const pc = new RTCPeerConnection({
      iceServers: [] // Local connection only
    });

    // Add audio tracks from microphone
    this.micStream.getAudioTracks().forEach(track => {
      pc.addTrack(track, this.micStream);
    });

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendToPopup(windowId, 'ice-candidate', event.candidate);
      }
    };

    // Create offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    this.connections.set(windowId, pc);
    return offer;
  }
}
```

**Popup (Receiver):**
```javascript
// webrtcReceiver.js
class WebRTCReceiver {
  async handleOffer(offer) {
    this.pc = new RTCPeerConnection({
      iceServers: []
    });

    // Receive remote audio stream
    this.pc.ontrack = (event) => {
      const [stream] = event.streams;
      this.onAudioStream(stream); // Pass to Butterchurn
    };

    // Handle ICE candidates
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendToDashboard('ice-candidate', event.candidate);
      }
    };

    await this.pc.setRemoteDescription(offer);
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    return answer;
  }
}
```

### IPC Signaling

WebRTC signaling happens via Electron IPC:

```javascript
// Main Process (main.js)
ipcMain.handle('webrtc:create-connection', async (event, windowId) => {
  // Dashboard requests new connection for popup
  return { windowId, readyForOffer: true };
});

ipcMain.handle('webrtc:offer', async (event, { windowId, offer }) => {
  // Forward offer from dashboard to popup
  const popup = BrowserWindow.fromId(windowId);
  popup.webContents.send('webrtc:offer', offer);
});

ipcMain.handle('webrtc:answer', async (event, { windowId, answer }) => {
  // Forward answer from popup to dashboard
  const dashboard = BrowserWindow.getAllWindows()[0]; // Main window
  dashboard.webContents.send('webrtc:answer', { windowId, answer });
});

ipcMain.handle('webrtc:ice-candidate', async (event, { windowId, candidate, direction }) => {
  // Forward ICE candidates bidirectionally
  if (direction === 'to-popup') {
    const popup = BrowserWindow.fromId(windowId);
    popup.webContents.send('webrtc:ice-candidate', candidate);
  } else {
    const dashboard = BrowserWindow.getAllWindows()[0];
    dashboard.webContents.send('webrtc:ice-candidate', { windowId, candidate });
  }
});
```

---

## Butterchurn Integration

### Preset Management

```javascript
// visualizationController.js
class VisualizationController {
  constructor() {
    this.presets = butterchurnPresets.getPresets();
    this.presetNames = Object.keys(this.presets);
    this.currentPresets = new Map(); // windowId -> presetName
  }

  getPresetCategories() {
    // Group by author (e.g., "Geiss - ", "Martin - ")
    const categories = {};
    this.presetNames.forEach(name => {
      const author = name.split(' - ')[0];
      if (!categories[author]) categories[author] = [];
      categories[author].push(name);
    });
    return categories;
  }

  getPresetList() {
    // Return presets with metadata for UI display
    return this.presetNames.map(name => {
      const parts = name.split(' - ');
      const author = parts[0];
      const displayName = parts.slice(1).join(' - ') || author;

      // Determine category
      let category = 'other';
      const authorLower = author.toLowerCase();
      if (authorLower.includes('geiss')) category = 'geiss';
      else if (authorLower.includes('martin')) category = 'martin';
      else if (authorLower.includes('flexi')) category = 'flexi';
      else if (authorLower.includes('shifter')) category = 'shifter';

      return {
        name,
        displayName,
        author,
        category,
        thumbnailPath: this.sanitizeFilename(name)
      };
    });
  }

  sanitizeFilename(name) {
    // Convert preset name to thumbnail filename
    // Special chars become underscores
    return name.replace(/[^a-zA-Z0-9-_\s]/g, '_') + '.png';
  }

  setWindowPreset(windowId, presetName) {
    this.currentPresets.set(windowId, presetName);
    // Send to popup via IPC or Socket.IO
    this.sendToWindow(windowId, 'preset:change', { presetName });
  }

  setAllWindowsPreset(presetName) {
    this.currentPresets.forEach((_, windowId) => {
      this.setWindowPreset(windowId, presetName);
    });
  }
}
```

### Preset Thumbnails

Butter Visualizer uses the same preset thumbnails as kai-player:
- **Source:** `kai-player/static/images/butterchurn-screenshots/`
- **Format:** PNG images (280x150px aspect ratio recommended)
- **Naming:** Sanitized preset names (special chars → underscores)
- **Count:** ~100 thumbnails for popular presets
- **Fallback:** Material icon placeholder if thumbnail missing

**Thumbnail Display:**
```jsx
// PresetCard.jsx (simplified)
const screenshotPath = `../../static/images/butterchurn-screenshots/${sanitizedName}.png`;

<img
  src={screenshotPath}
  alt={preset.displayName}
  className="w-full h-[150px] object-cover transition-transform hover:scale-105"
  onError={(e) => {
    // Fallback to placeholder icon if thumbnail not found
    e.target.style.display = 'none';
    e.target.nextElementSibling.style.display = 'flex';
  }}
/>
<div className="hidden items-center justify-center bg-gray-200 dark:bg-gray-900">
  <span className="material-icons text-5xl">image_not_supported</span>
</div>
```

### Popup Rendering

```javascript
// butterchurnRenderer.js (in popup)
class ButterchurnRenderer {
  constructor(canvas, audioStream) {
    this.canvas = canvas;

    // Create audio context from stream
    this.audioContext = new AudioContext();
    this.sourceNode = this.audioContext.createMediaStreamSource(audioStream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.sourceNode.connect(this.analyser);

    // Initialize Butterchurn
    this.visualizer = butterchurn.createVisualizer(
      this.audioContext,
      canvas,
      {
        width: canvas.width,
        height: canvas.height,
        pixelRatio: window.devicePixelRatio
      }
    );

    // Load default preset
    this.loadPreset('Geiss - Wavy');

    // Start render loop
    this.startRendering();
  }

  loadPreset(presetName) {
    const presets = butterchurnPresets.getPresets();
    if (presets[presetName]) {
      this.visualizer.loadPreset(presets[presetName], 2.0); // 2s transition
    }
  }

  startRendering() {
    const render = () => {
      this.visualizer.render();
      requestAnimationFrame(render);
    };
    render();
  }

  handleResize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.visualizer.setRendererSize(width, height);
  }
}
```

---

## Express Server + Socket.IO

### Purpose

The built-in web server enables:
1. Remote control from mobile devices
2. External applications to control visualizations
3. Future web-based remote dashboard

### API Endpoints

**REST API:**
```javascript
// GET /api/status
{
  "microphoneEnabled": true,
  "windowCount": 3,
  "windows": [
    { "id": 1, "preset": "Geiss - Wavy", "connected": true },
    { "id": 2, "preset": "Martin - Shimmer", "connected": true }
  ]
}

// POST /api/microphone/toggle
{ "enabled": true }

// POST /api/windows/create
{ "windowId": 4 }

// POST /api/windows/:id/preset
{ "preset": "Flexi - Mindblob" }

// POST /api/windows/:id/close
{ "success": true }

// GET /api/presets
{ "presets": ["Geiss - Wavy", "Martin - Shimmer", ...] }
```

**Socket.IO Events:**
```javascript
// Server → Client
socket.emit('status:update', { micEnabled, windowCount, windows });
socket.emit('window:created', { windowId, preset });
socket.emit('window:closed', { windowId });
socket.emit('preset:changed', { windowId, preset });
socket.emit('audio:level', { level }); // Real-time audio meter

// Client → Server
socket.on('microphone:toggle', (enabled) => { ... });
socket.on('window:create', () => { ... });
socket.on('window:close', (windowId) => { ... });
socket.on('preset:set', ({ windowId, preset }) => { ... });
socket.on('preset:set-all', (preset) => { ... });
```

### Server Implementation

```javascript
// expressServer.js
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

class ExpressServer {
  constructor(port = 4069) {
    this.port = port;
    this.app = express();
    this.httpServer = createServer(this.app);
    this.io = new SocketIOServer(this.httpServer, {
      cors: { origin: '*' }
    });

    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketIO();
  }

  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.static('public')); // Future web UI
  }

  setupRoutes() {
    this.app.get('/api/status', (req, res) => {
      res.json(this.getStatus());
    });

    this.app.post('/api/microphone/toggle', (req, res) => {
      const { enabled } = req.body;
      this.emit('microphone:toggle', enabled);
      res.json({ success: true, enabled });
    });

    // ... more routes
  }

  setupSocketIO() {
    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      // Send current state
      socket.emit('status:update', this.getStatus());

      // Handle events
      socket.on('window:create', () => {
        this.emit('window:create-requested');
      });

      socket.on('preset:set', ({ windowId, preset }) => {
        this.emit('preset:set-requested', { windowId, preset });
      });
    });
  }

  start() {
    this.httpServer.listen(this.port, () => {
      console.log(`Server running on http://localhost:${this.port}`);
    });
  }
}
```

---

## Dark Mode Styling

### Tailwind Configuration

Butter Visualizer uses the same dark mode strategy as kai-player:

**Theme Colors:**
- Background: `bg-white dark:bg-gray-900`
- Text: `text-gray-900 dark:text-gray-100`
- Borders: `border-gray-200 dark:border-gray-700`
- Cards: `bg-white dark:bg-gray-800`
- Inputs: `bg-white dark:bg-gray-800`

**Custom Component Classes:**
```css
.btn-primary {
  @apply px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg;
}

.btn-secondary {
  @apply px-4 py-2 bg-gray-200 hover:bg-gray-300
         dark:bg-gray-700 dark:hover:bg-gray-600
         text-gray-900 dark:text-gray-100 rounded-lg;
}

.input {
  @apply px-3 py-2 border border-gray-300 dark:border-gray-600
         rounded-lg bg-white dark:bg-gray-800
         text-gray-900 dark:text-gray-100
         focus:outline-none focus:ring-2 focus:ring-blue-500;
}

.card {
  @apply bg-white dark:bg-gray-800
         border border-gray-200 dark:border-gray-700
         rounded-lg shadow-sm;
}
```

**Custom Scrollbar:**
- Track: `bg-gray-100 dark:bg-gray-800`
- Thumb: `bg-gray-300 dark:bg-gray-600`
- Hover: `bg-gray-400 dark:bg-gray-500`

Dark mode is enabled by default and uses the `class` strategy (toggled via `.dark` class on root element).

---

## File Structure

```
butter-visualizer/
├── package.json                  # Dependencies + scripts
├── vite.config.js                # Vite configuration (shared)
├── tailwind.config.js            # Tailwind CSS config
├── eslint.config.js              # ESLint configuration
├── prettier.config.js            # Prettier configuration
├── vitest.config.js              # Test configuration
├── .husky/                       # Git hooks (pre-commit)
├── SPECIFICATION.md              # This document
├── README.md                     # User documentation
│
├── scripts/
│   └── rename-artifacts.js       # Post-build artifact renaming
│
├── static/
│   ├── images/
│   │   ├── icon.png              # App icon (512x512)
│   │   ├── icon-512.png          # Linux icon
│   │   └── butterchurn-screenshots/  # Preset thumbnails (copied from kai-player)
│   │       ├── Geiss_-_Wavy.png  # ~100 preset screenshots
│   │       ├── Martin_-_Shimmer.png
│   │       └── ... (100+ thumbnails)
│   └── fonts/
│       └── material-icons.woff2  # Material Icons font
│
├── src/
│   ├── main/                     # Main process (Node.js)
│   │   ├── main.js               # Entry point
│   │   ├── expressServer.js      # Express + Socket.IO
│   │   ├── windowManager.js      # Popup window management
│   │   ├── ipcHandlers.js        # IPC handlers
│   │   └── preload.js            # Preload script for context bridge
│   │
│   ├── renderer/                 # Main dashboard (React)
│   │   ├── index.html            # Main window HTML
│   │   ├── main.jsx              # React entry point
│   │   ├── App.jsx               # Root component
│   │   ├── vite.config.js        # Vite config for renderer
│   │   │
│   │   ├── components/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── MicrophoneControls.jsx
│   │   │   ├── WindowManager.jsx
│   │   │   ├── WindowCard.jsx
│   │   │   ├── PresetBrowser.jsx
│   │   │   ├── PresetCard.jsx
│   │   │   └── ServerPanel.jsx
│   │   │
│   │   ├── services/
│   │   │   ├── microphoneManager.js
│   │   │   ├── webrtcController.js
│   │   │   └── visualizationController.js
│   │   │
│   │   └── styles/
│   │       └── tailwind.css      # Tailwind imports + custom styles
│   │
│   ├── popup/                    # Popup window (React)
│   │   ├── popup.html            # Minimal HTML
│   │   ├── popup.jsx             # React entry point
│   │   ├── vite.config.js        # Vite config for popup
│   │   │
│   │   ├── components/
│   │   │   ├── PopupCanvas.jsx
│   │   │   └── ConnectionStatus.jsx
│   │   │
│   │   ├── services/
│   │   │   ├── webrtcReceiver.js
│   │   │   └── butterchurnRenderer.js
│   │   │
│   │   └── styles/
│   │       └── tailwind.css      # Tailwind imports
│   │
│   ├── shared/                   # Shared utilities
│   │   ├── ipcChannels.js        # IPC channel names
│   │   └── constants.js          # App constants
│   │
│   ├── lib/                      # Third-party libraries
│   │   ├── butterchurn.min.js
│   │   └── butterchurnPresets.min.js
│   │
│   └── test/                     # Test files
│       ├── setup.js              # Vitest setup
│       └── **/*.test.js          # Component tests
│
└── public/                       # Future web UI assets
    └── index.html
```

---

## IPC Channel Definitions

```javascript
// src/shared/ipcChannels.js
export const IPC_CHANNELS = {
  // Microphone
  MIC_GET_DEVICES: 'microphone:get-devices',
  MIC_TOGGLE: 'microphone:toggle',
  MIC_SET_DEVICE: 'microphone:set-device',
  MIC_STATUS: 'microphone:status',

  // Window Management
  WINDOW_CREATE: 'window:create',
  WINDOW_CLOSE: 'window:close',
  WINDOW_CLOSE_ALL: 'window:close-all',
  WINDOW_LIST: 'window:list',
  WINDOW_READY: 'window:ready',

  // Presets
  PRESET_GET_ALL: 'preset:get-all',
  PRESET_SET: 'preset:set',
  PRESET_SET_ALL: 'preset:set-all',
  PRESET_CHANGED: 'preset:changed',

  // WebRTC Signaling
  WEBRTC_CREATE: 'webrtc:create-connection',
  WEBRTC_OFFER: 'webrtc:offer',
  WEBRTC_ANSWER: 'webrtc:answer',
  WEBRTC_ICE_CANDIDATE: 'webrtc:ice-candidate',

  // Server
  SERVER_START: 'server:start',
  SERVER_STOP: 'server:stop',
  SERVER_STATUS: 'server:status',
};
```

---

## Development Workflow

### Build System

Butter Visualizer uses the same comprehensive build system as kai-player, but simplified since there are **no external dependencies** (no Python, ffmpeg, flatpak-builder, etc.) - just Electron and npm packages.

### Scripts

```json
{
  "scripts": {
    "start": "electron . --no-sandbox",
    "dev": "npm run build:all && electron . --dev --no-sandbox",
    "build": "npm run build:all && electron-builder && node scripts/rename-artifacts.js",
    "build:all": "npm run build:renderer && npm run build:popup",
    "build:renderer": "vite build --config src/renderer/vite.config.js",
    "build:popup": "vite build --config src/popup/vite.config.js",
    "build:linux": "npm run build:all && electron-builder --linux && node scripts/rename-artifacts.js",
    "build:win": "npm run build:all && electron-builder --win && node scripts/rename-artifacts.js",
    "build:mac": "npm run build:all && electron-builder --mac && node scripts/rename-artifacts.js",
    "rebuild": "electron-rebuild",
    "postinstall": "electron-builder install-app-deps",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint src/",
    "lint:fix": "eslint src/ --fix",
    "format": "prettier --write \"src/**/*.{js,jsx,json,css,md}\"",
    "format:check": "prettier --check \"src/**/*.{js,jsx,json,css,md}\"",
    "prepare": "husky"
  }
}
```

### Multi-Platform Build Configuration

**electron-builder Configuration (in package.json):**

```json
{
  "build": {
    "appId": "com.buttervisualizer.app",
    "productName": "ButterVisualizer",
    "publish": {
      "provider": "github",
      "releaseType": "release"
    },
    "directories": {
      "output": "dist"
    },
    "files": [
      "src/**/*",
      "static/**/*",
      "node_modules/**/*",
      "!src/**/node_modules",
      "!src/**/src"
    ],
    "icon": "static/images/icon.png",

    "linux": {
      "target": [
        {
          "target": "AppImage",
          "arch": ["x64", "arm64"]
        },
        {
          "target": "deb",
          "arch": ["x64", "arm64"]
        }
      ],
      "icon": "static/images/icon.png",
      "category": "AudioVideo",
      "desktop": {
        "entry": {
          "Name": "Butter Visualizer",
          "Comment": "Multi-window audio-reactive visualizations",
          "Categories": "AudioVideo;Audio;Visualization;"
        }
      },
      "artifactName": "${productName}-${version}-linux-${arch}.${ext}"
    },

    "win": {
      "target": [
        {
          "target": "nsis",
          "arch": ["x64"]
        },
        {
          "target": "portable",
          "arch": ["x64"]
        }
      ],
      "icon": "static/images/icon.png",
      "artifactName": "${productName}-${version}-windows-${arch}.${ext}"
    },

    "nsis": {
      "differentialPackage": false,
      "artifactName": "${productName}-${version}-windows-${arch}-installer.${ext}"
    },

    "portable": {
      "artifactName": "${productName}-${version}-windows-${arch}-portable.${ext}"
    },

    "mac": {
      "target": [
        {
          "target": "dmg",
          "arch": ["x64", "arm64"]
        }
      ],
      "icon": "static/images/icon.png",
      "artifactName": "${productName}-${version}-macos-${arch}.${ext}",
      "identity": null
    },

    "dmg": {
      "writeUpdateInfo": false
    }
  }
}
```

### Artifact Naming

After build completes, `scripts/rename-artifacts.js` renames files to use Linux-style architecture names:
- `x64` → `x86_64`
- `arm64` → `aarch64`

**Example output:**
```
dist/
├── ButterVisualizer-1.0.0-linux-x86_64.AppImage
├── ButterVisualizer-1.0.0-linux-aarch64.AppImage
├── ButterVisualizer-1.0.0-linux-x86_64.deb
├── ButterVisualizer-1.0.0-windows-x86_64-installer.exe
├── ButterVisualizer-1.0.0-windows-x86_64-portable.exe
├── ButterVisualizer-1.0.0-macos-x86_64.dmg
└── ButterVisualizer-1.0.0-macos-aarch64.dmg
```

### Hot Module Replacement

Vite enables HMR for React components during development:
- Main dashboard updates instantly on code changes
- Popup windows require manual refresh (limitation of separate windows)
- Express server requires restart for changes

### Git Hooks (Husky + lint-staged)

**Pre-commit hooks:**
```json
{
  "lint-staged": {
    "src/**/*.{js,jsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "src/**/*.test.{js,jsx}": [
      "vitest related --run"
    ],
    "src/**/*.{json,css,md}": [
      "prettier --write"
    ]
  }
}
```

Automatically runs on `git commit`:
1. ESLint fixes code issues
2. Prettier formats code
3. Runs related tests
4. Formats JSON/CSS/Markdown files

---

## Configuration

### User Settings

```javascript
// Stored in electron-store or JSON file
{
  "microphone": {
    "deviceId": "default",
    "enabled": true,
    "autoStart": false
  },
  "server": {
    "enabled": true,
    "port": 4069,
    "allowRemote": true
  },
  "windows": {
    "rememberPositions": true,
    "lastPositions": [
      { "x": 1920, "y": 0, "width": 1920, "height": 1080 }
    ]
  },
  "visualization": {
    "fps": 60,
    "defaultPreset": "Geiss - Wavy",
    "transitionDuration": 2.0
  }
}
```

---

## Performance Considerations

1. **WebRTC Connections:**
   - Each popup requires one PeerConnection
   - Limit: ~10 simultaneous windows (depends on hardware)
   - Local connections only (no STUN/TURN needed)

2. **Canvas Rendering:**
   - Butterchurn is GPU-accelerated (WebGL)
   - 60 FPS target per window
   - Monitor GPU usage on multi-window setups

3. **Audio Processing:**
   - Single microphone capture shared via WebRTC
   - Minimal CPU overhead (no encoding/decoding for local)
   - FFT analysis per window (2048 bins standard)

4. **Memory:**
   - Each popup window ~50-100MB
   - Butterchurn textures ~20MB per instance
   - Monitor for leaks during preset changes

---

## Future Enhancements

### Phase 2
- Web-based remote dashboard (mobile-friendly UI)
- Save/load window layouts (presets + positions)
- MIDI controller support for preset changes
- Audio input from files (not just microphone)

### Phase 3
- Custom preset editor
- Preset playlists with auto-rotation
- Beat detection for synchronized effects
- DMX lighting integration

### Phase 4
- Multi-machine synchronization (network)
- VJ mode with transition effects
- Recording output to video files
- Plugin system for custom effects

---

## Build Targets

### Supported Platforms

- **Linux:** AppImage (x64 + ARM64), Deb (x64 + ARM64)
- **Windows:** NSIS Installer (x64), Portable Executable (x64)
- **macOS:** DMG (Intel x64 + Apple Silicon ARM64)

### Platform Advantages

Unlike kai-player, Butter Visualizer has **zero external dependencies** beyond Electron and npm packages:
- ❌ No Python runtime required
- ❌ No ffmpeg binaries
- ❌ No flatpak-builder or complex toolchains
- ❌ No native modules to compile
- ✅ Just Node.js + npm install → ready to build!

This makes the build process:
- **Faster** - no dependency downloads or compilation
- **Simpler** - works on any platform with Node.js
- **More reliable** - fewer points of failure
- **Easier to CI/CD** - minimal GitHub Actions setup

### System Requirements

**Runtime:**
- Electron 38+ (bundles Chromium + Node.js)
- Microphone access (getUserMedia API)
- WebGL-capable GPU (for Butterchurn)

**Development:**
- Node.js 18+ with npm
- Git (for version control)
- Any OS that supports Electron (Linux, Windows, macOS)

**No external binaries required!**

---

## Testing Strategy

1. **Unit Tests:** Vitest for services/utilities
2. **Component Tests:** React Testing Library
3. **E2E Tests:** Playwright for Electron
4. **Manual Testing:**
   - WebRTC connection establishment
   - Multi-window rendering performance
   - Preset switching smoothness
   - Server API functionality

---

## License

AGPL-3.0 (same as kai-player)

---

## Dependencies

### Production Dependencies

```json
{
  "dependencies": {
    "butterchurn": "^2.6.7",
    "butterchurn-presets": "^2.4.7",
    "cors": "^2.8.5",
    "express": "^5.1.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "socket.io": "^4.8.1",
    "socket.io-client": "^4.8.1"
  }
}
```

### Development Dependencies

```json
{
  "devDependencies": {
    "@eslint/js": "^9.37.0",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.0",
    "@testing-library/user-event": "^14.6.1",
    "@vitejs/plugin-react": "^5.0.4",
    "@vitest/coverage-v8": "^3.2.4",
    "@vitest/ui": "^3.2.4",
    "autoprefixer": "^10.4.21",
    "electron": "^38.2.0",
    "electron-builder": "^26.0.12",
    "eslint": "^9.37.0",
    "eslint-config-prettier": "^10.1.8",
    "eslint-plugin-react": "^7.37.5",
    "eslint-plugin-react-hooks": "^7.0.0",
    "globals": "^16.4.0",
    "happy-dom": "^20.0.0",
    "husky": "^9.1.7",
    "lint-staged": "^16.2.4",
    "postcss": "^8.5.6",
    "prettier": "^3.6.2",
    "tailwindcss": "^3.4.18",
    "vite": "^7.1.9",
    "vitest": "^3.2.4"
  }
}
```

**Total dependencies:** ~20 (vs kai-player's ~50+)
**No native bindings required!**

---

## Getting Started

```bash
# Clone and install
git clone <repo>
cd butter-visualizer
npm install

# Copy preset thumbnails from kai-player (required for visual preset browser)
cp -r ../kai-player/static/images/butterchurn-screenshots static/images/

# Development (builds renderer + popup, then launches Electron)
npm run dev

# Production build (all platforms)
npm run build

# Platform-specific builds
npm run build:linux   # AppImage + Deb
npm run build:win     # NSIS + Portable
npm run build:mac     # DMG

# Testing
npm test              # Run tests in watch mode
npm run test:run      # Run tests once
npm run test:coverage # Generate coverage report
npm run test:ui       # Open Vitest UI

# Code quality
npm run lint          # Check code issues
npm run lint:fix      # Auto-fix issues
npm run format        # Format all files
npm run format:check  # Check formatting
```

---

## Summary

Butter Visualizer is a specialized tool for creating multi-window audio-reactive visualizations. Its architecture cleanly separates concerns:

- **Main Process:** Window management, IPC coordination, Express server
- **Dashboard Renderer:** Control interface, microphone capture, WebRTC sender
- **Popup Renderer:** Canvas rendering, WebRTC receiver, Butterchurn consumer

The WebRTC audio streaming approach ensures low-latency, synchronized visualizations across multiple windows without complex video encoding overhead.
