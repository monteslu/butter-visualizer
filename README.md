# Butter Visualizer

![Butter Visualizer](butter_visualizer.png)

Multi-window audio-reactive visualization application powered by Butterchurn.

## Features

- **Multi-Window Visualizations**: Create unlimited popup windows, each running independent Butterchurn visualizations
- **Microphone Input**: Capture live audio from your microphone
- **WebRTC Audio Streaming**: Low-latency audio-only streaming to visualization windows
- **200+ Presets**: Browse and apply Butterchurn presets with visual thumbnails
- **Dark Mode UI**: Beautiful dark-themed interface matching kai-player
- **Remote Control**: Built-in Express server for remote control via REST API and Socket.IO
- **Cross-Platform**: Builds for Linux (AppImage, Deb), Windows (NSIS, Portable), and macOS (DMG)

## Getting Started

### Installation

```bash
# Clone repository
cd butter-visualizer

# Install dependencies
npm install

# Setup development environment (copies assets to public folders)
npm run setup
```

### Development

```bash
# Run in development mode (auto-runs setup, starts Vite dev servers + Electron)
npm run dev

# Clean start (kills old processes first)
npm run dev:clean

# Or manually start components:
npm run dev:renderer  # Start renderer dev server on :5173
npm run dev:popup     # Start popup dev server on :5175
npm start             # Start Electron (requires dev servers running)

# Use custom ports with environment variables (optional)
RENDERER_PORT=5180 POPUP_PORT=5181 SERVER_PORT=4070 npm run dev

# Or create a .env file (copy from .env.example)
cp .env.example .env
# Edit .env with your custom ports, then:
npm run dev
```

### Production Build

```bash
# Build for all platforms
npm run build

# Platform-specific builds
npm run build:linux   # AppImage + Deb
npm run build:win     # NSIS Installer + Portable
npm run build:mac     # DMG (Intel + Apple Silicon)
```

## Usage

1. **Enable Microphone**: Click "Enable Microphone" to start capturing audio
2. **Create Windows**: Click "New Window" to create visualization windows
3. **Select Presets**: Browse presets and click to apply to all windows
4. **Individual Control**: Use window cards in sidebar to change presets per window

## Remote Control API

The built-in server runs on port 4069 by default.

### REST API

- `GET /api/status` - Get application status
- `POST /api/microphone/toggle` - Toggle microphone
- `POST /api/windows/create` - Create new window
- `POST /api/windows/:id/close` - Close window
- `POST /api/windows/:id/preset` - Set window preset
- `POST /api/presets/set-all` - Apply preset to all windows
- `GET /api/presets` - Get all available presets

### Socket.IO Events

```javascript
// Server → Client
socket.on('status:update', (data) => { ... });
socket.on('window:created', ({ windowId }) => { ... });
socket.on('window:closed', ({ windowId }) => { ... });
socket.on('preset:changed', ({ windowId, preset }) => { ... });

// Client → Server
socket.emit('window:create');
socket.emit('preset:set', { windowId, preset });
socket.emit('microphone:toggle', enabled);
```

## Architecture

### Main Process (Node.js)
- **main.js**: Application entry point
- **windowManager.js**: Popup window lifecycle management
- **expressServer.js**: REST + Socket.IO server
- **ipcHandlers.js**: IPC communication handlers

### Renderer Process (Dashboard)
- **React**: UI framework
- **MicrophoneManager**: Audio input capture
- **WebRTCController**: Audio streaming to popups
- **VisualizationController**: Preset management

### Popup Windows
- **React**: Minimal canvas UI
- **ButterchurnRenderer**: WebGL visualization rendering
- **WebRTCReceiver**: Audio stream receiver

## Technology Stack

- **Electron 38**: Desktop framework
- **React 19**: UI library
- **Vite 7**: Build tool with HMR
- **Tailwind CSS 3**: Styling with dark mode
- **Butterchurn 2.6**: Audio visualization engine
- **Express 5**: Web server
- **Socket.IO 4**: Real-time communication
- **WebRTC**: Peer-to-peer audio streaming

## Development Scripts

```bash
npm run dev           # Development mode (Vite HMR + Electron)
npm run dev:renderer  # Start renderer dev server only
npm run dev:popup     # Start popup dev server only
npm run build:all     # Build renderer + popup
npm run lint          # Check code quality
npm run lint:fix      # Auto-fix linting issues
npm run format        # Format code with Prettier
npm test              # Run tests
npm run test:ui       # Open Vitest UI
npm run test:coverage # Generate coverage report
```

## System Requirements

- **Runtime**: Electron 38+ (bundles Chromium + Node.js)
- **Microphone**: Audio input device with getUserMedia support
- **GPU**: WebGL-capable graphics card
- **Development**: Node.js 18+ with npm

## License

AGPL-3.0

## Credits

- Built with [Butterchurn](https://github.com/jberg/butterchurn) by jberg
- Inspired by [kai-player](https://github.com/monteslu/kai-player)
- Preset thumbnails from kai-player project
