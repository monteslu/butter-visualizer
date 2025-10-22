# WebRTC Architecture Documentation

## Overview

Butter Visualizer uses WebRTC DataChannels for real-time audio data streaming from the dashboard to visualization clients (Electron popup windows and browser clients). The architecture uses **dual DataChannels** per connection:

1. **Audio Data Channel** - Binary audio transmission (unordered, unreliable for real-time performance)
2. **Control Channel** - JSON control messages (ordered, reliable for commands like preset changes)

Socket.IO is used **ONLY for WebRTC signaling** (offer/answer/ICE candidates), then all application data flows through WebRTC DataChannels for maximum efficiency.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Main Process                                │
│                                                                       │
│  ┌──────────────┐         ┌─────────────┐        ┌──────────────┐  │
│  │ WindowManager│◄────────┤ IPC Handlers├────────► ExpressServer│  │
│  └──────────────┘         └─────────────┘        └──────────────┘  │
│         │                        │                      │            │
│         │                        │                      │            │
└─────────┼────────────────────────┼──────────────────────┼────────────┘
          │                        │                      │
          │ IPC                    │ IPC                  │ Socket.IO
          │                        │                      │ (signaling)
          │                        │                      │
┌─────────▼────────────────────────▼───────┐  ┌───────────▼───────────┐
│        Dashboard (Renderer)              │  │  Browser Client       │
│                                          │  │                       │
│  ┌────────────────┐                     │  │  ┌─────────────────┐ │
│  │ Microphone     │                     │  │  │ SocketReceiver  │ │
│  │ Manager        │                     │  │  │ (Socket.IO)     │ │
│  └────────┬───────┘                     │  │  └────────┬────────┘ │
│           │                              │  │           │          │
│           ▼                              │  │           ▼          │
│  ┌────────────────┐                     │  │  ┌─────────────────┐ │
│  │ WebRTC         │◄───────WebRTC───────┼──┼──┤ Peer Connection │ │
│  │ Controller     │       DataChannels  │  │  └────────┬────────┘ │
│  └────────┬───────┘                     │  │           │          │
│           │                              │  │           ▼          │
│           │                              │  │  ┌─────────────────┐ │
│           ▼                              │  │  │ Butterchurn     │ │
│    Audio + Control                       │  │  │ Renderer        │ │
│    DataChannels                          │  │  └─────────────────┘ │
│                                          │  │                       │
└──────────────────────────────────────────┘  └───────────────────────┘
          │
          │ IPC
          │
┌─────────▼─────────────────────────────┐
│   Electron Popup Window               │
│                                       │
│  ┌─────────────────┐                 │
│  │ WebRTCReceiver  │                 │
│  │ (IPC)           │                 │
│  └────────┬────────┘                 │
│           │                           │
│           ▼                           │
│  ┌─────────────────┐                 │
│  │ Peer Connection │                 │
│  └────────┬────────┘                 │
│           │                           │
│           ▼                           │
│  ┌─────────────────┐                 │
│  │ Butterchurn     │                 │
│  │ Renderer        │                 │
│  └─────────────────┘                 │
│                                       │
└───────────────────────────────────────┘
```

## Dual DataChannel Protocol

### Audio Data Channel
- **Label**: `audioData`
- **Configuration**: `{ ordered: false, maxRetransmits: 0 }`
- **Data Format**: Binary ArrayBuffer (Uint8Array)
- **Content**: Time domain audio data from Web Audio API
- **Send Rate**: Optimized to match audio sample rate (~23.4fps for 2048@48kHz)
- **Purpose**: Real-time audio visualization data

**Why Unordered/Unreliable?**
For real-time audio visualization, dropping old packets is better than waiting for retransmission. If a packet is delayed, we prefer to show the latest data rather than stall on old data.

### Control Channel
- **Label**: `control`
- **Configuration**: `{ ordered: true }`
- **Data Format**: JSON strings
- **Content**: Control messages (preset changes, window commands, etc.)
- **Purpose**: Reliable command transmission

**Why Ordered/Reliable?**
Control messages (like preset changes) must arrive in order and cannot be lost, otherwise the UI state becomes inconsistent.

### Message Protocol

#### Audio Data Messages (Binary)
```
Uint8Array[fftSize] - Raw time domain audio samples (0-255)
```

#### Control Messages (JSON)
```json
{
  "type": "preset:change",
  "preset": "Martin - Xstream / goody 2 blues"
}
```

```json
{
  "type": "window:close"
}
```

## Connection Flow

### Electron Popup Windows

1. **Dashboard creates popup**
   ```javascript
   const { windowId } = await window.electronAPI.createWindow();
   ```

2. **Popup window ready**
   ```javascript
   // Popup sends ready signal
   window.electronAPI.sendWindowReady();
   ```

3. **Dashboard creates WebRTC connection**
   ```javascript
   webrtcController.createConnection(windowId);
   ```

4. **WebRTC Signaling** (via IPC)
   ```
   Dashboard → Main → Popup:  Offer
   Popup → Main → Dashboard:  Answer
   Both:                       ICE Candidates
   ```

5. **DataChannels established**
   - Audio data flows: Dashboard → audioData channel → Popup
   - Control messages: Dashboard → control channel → Popup

### Browser Clients

1. **Browser connects to `/popup`**
   ```
   http://localhost:4069/popup
   ```

2. **Socket.IO connection established**
   ```javascript
   const socket = io('http://localhost:4069');
   ```

3. **Browser generates client ID and announces readiness**
   ```javascript
   const clientId = crypto.randomUUID();
   socket.emit('visualization:ready', { clientId });
   ```

4. **WebRTC Signaling** (via Socket.IO)
   ```
   Dashboard → Express → Socket.IO → Browser:  Offer
   Browser → Socket.IO → Express → Dashboard:  Answer
   Both:                                       ICE Candidates
   ```

5. **DataChannels established**
   - Socket.IO connection remains open but unused for data
   - Audio data flows: Dashboard → audioData channel → Browser
   - Control messages: Dashboard → control channel → Browser

## Key Design Decisions

### Why DataChannels for Everything?

**Efficiency**: WebRTC DataChannels are peer-to-peer after connection establishment. Socket.IO would require the server to relay every audio packet, consuming server resources and adding latency.

**Bandwidth**: With binary DataChannels, we achieve ~48 KB/sec per client vs ~120 KB/sec with JSON over Socket.IO (60% reduction).

**Consistency**: Using the same communication method (DataChannels) for both Electron popups and browser clients simplifies the codebase.

### Why Dual Channels?

**Separation of Concerns**:
- Audio data has different requirements (low latency, lossy OK) than control messages (reliable, ordered)
- Allows independent tuning of each channel's configuration

**Performance**:
- Audio channel can drop packets without affecting control message delivery
- Control channel reliability doesn't add latency to audio stream

### Audio Optimization

**Only Time Domain Data**:
Butterchurn performs its own FFT on time domain data. Sending frequency data would be redundant.

**Optimal Send Rate**:
Send rate matches audio buffer duration to eliminate redundant overlapping data:
```javascript
const windowDurationMs = (fftSize / sampleRate) * 1000;
// 2048 samples @ 48kHz = 42.67ms = ~23.4fps
```

**Binary Format**:
Raw Uint8Array buffer transmission instead of JSON encoding saves ~60% bandwidth.

## Code Structure

### Dashboard (Renderer Process)

**`src/renderer/services/microphoneManager.js`**
- Manages Web Audio API microphone access
- Creates AnalyserNode for audio data extraction
- Provides audio stream to WebRTC

**`src/renderer/services/webrtcController.js`**
- Creates WebRTC connections for both popup windows and browser clients
- Detects client type (number = popup, UUID = browser client)
- Routes signaling messages appropriately
- Creates dual DataChannels per connection
- Sends audio data at optimal rate via audioData channel
- Provides `sendControlMessage(clientId, message)` for control commands

**`src/renderer/App.jsx`**
- Sets up IPC event listeners for WebRTC signaling
- Handles browser client ready events
- Routes WebRTC answers and ICE candidates to webrtcController

### Popup Windows (Renderer Process)

**`src/popup/services/webrtcReceiver.js`** (Electron)
- Handles IPC-based WebRTC signaling
- Receives both audioData and control DataChannels
- Routes audio data to Butterchurn
- Handles control messages (preset changes, etc.)

**`src/popup/services/socketReceiver.js`** (Browser)
- Handles Socket.IO WebRTC signaling
- Generates self-assigned UUID client ID
- Receives both audioData and control DataChannels
- Same data handling as webrtcReceiver

**`src/popup/services/butterchurnRenderer.js`**
- Initializes Butterchurn visualization library
- Monkey-patches Butterchurn's internal audio analyser
- Injects DataChannel audio data into Butterchurn
- Loads random preset on initialization

### Main Process

**`src/main/main.js`**
- Orchestrates WindowManager and ExpressServer
- Relays browser client events from Express to Dashboard
- Handles app lifecycle

**`src/main/windowManager.js`**
- Creates and manages Electron popup windows
- Routes IPC messages to specific windows

**`src/main/expressServer.js`**
- HTTP server for serving `/popup` to browsers
- Socket.IO server for WebRTC signaling only
- Relays offers/ICE from dashboard to browser clients
- Relays answers/ICE from browser clients to dashboard
- Tracks connected browser clients by client ID

**`src/main/ipcHandlers.js`**
- IPC handlers for window management
- IPC handlers for WebRTC signaling (popup windows)
- IPC handlers for browser client signaling (relay to Socket.IO)

## File Locations

### Core WebRTC Files
- `src/renderer/services/webrtcController.js` - Dashboard WebRTC sender
- `src/popup/services/webrtcReceiver.js` - Electron popup receiver
- `src/popup/services/socketReceiver.js` - Browser client receiver

### Main Process
- `src/main/main.js` - Application entry
- `src/main/windowManager.js` - Window lifecycle
- `src/main/expressServer.js` - HTTP + Socket.IO server
- `src/main/ipcHandlers.js` - IPC message routing
- `src/main/preload.js` - IPC API exposure

### Visualization
- `src/popup/services/butterchurnRenderer.js` - Butterchurn integration
- `src/popup/components/PopupCanvas.jsx` - Canvas component

### Shared
- `src/shared/constants.js` - WebRTC configuration
- `src/shared/ipcChannels.js` - IPC channel constants
- `src/shared/config.js` - Port configuration

## Testing

### Test Electron Popup
1. Start dev server: `npm run dev`
2. Click "Create Window" in dashboard
3. Verify audio visualization appears
4. Check console for DataChannel connection logs

### Test Browser Client
1. Start dev server: `npm run dev`
2. Open browser: `http://localhost:4069/popup`
3. Check browser console for Socket.IO connection
4. Verify WebRTC connection establishes
5. Verify audio visualization appears

### Debug Logging

**Dashboard Console:**
```
📊 Audio DataChannel opened for window: <id>
🎛️ Control DataChannel opened for window: <id>
📊 Optimized send rate: 42.67ms per frame (23.4 fps)
🧊 Dashboard ICE candidate
```

**Popup/Browser Console:**
```
📊 DataChannel received: audioData
📊 DataChannel received: control
📊 Audio DataChannel opened!
🎛️ Control DataChannel opened!
```

**Express Server Console:**
```
Browser visualization client ready: <clientId>
WebRTC answer from browser client <clientId>
ICE candidate from browser client <clientId>
```

## Bandwidth Calculations

### Per Client (Optimized)
- Audio data: 2048 bytes * 23.4 fps = ~48 KB/sec
- Control messages: Negligible (<1 KB/sec)
- **Total: ~48 KB/sec per client**

### Network Capacity
- **WiFi**: ~100 clients at 5 MB/sec total
- **LAN**: ~1000 clients at 50 MB/sec total
- **Localhost**: Limited only by GPU rendering capacity

## Future Improvements

1. **Adaptive Send Rate**: Reduce send rate if network congestion detected
2. **Audio Quality Levels**: Allow reduced fftSize for lower bandwidth
3. **Control Channel Protocol**: Formalize control message schema
4. **Connection Pooling**: Reuse WebRTC connections for multiple visualizations
5. **TURN Server**: Add TURN for remote clients behind NAT

## Troubleshooting

### No Audio in Popup
- Check dashboard console for "No microphone stream available"
- Enable microphone in dashboard
- Verify AudioContext is not suspended

### WebRTC Connection Fails
- Check ICE candidate exchange in console
- Verify firewall allows WebRTC (UDP ports)
- Check for conflicting browser extensions

### Browser Client Can't Connect
- Verify Express server running on port 4069
- Check CORS configuration in expressServer.js
- Verify Socket.IO connection establishes first

### High Bandwidth Usage
- Check send rate: Should be ~23fps, not 60fps
- Verify binary format (ArrayBuffer, not JSON)
- Check for multiple redundant connections

## References

- WebRTC DataChannel API: https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel
- Socket.IO Documentation: https://socket.io/docs/
- Butterchurn: https://github.com/jberg/butterchurn
- Web Audio API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
