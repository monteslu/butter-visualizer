import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * ExpressServer - Built-in web server for remote control
 */
export class ExpressServer {
  constructor(port = 4069) {
    this.port = port;
    this.app = express();
    this.httpServer = createServer(this.app);
    this.io = new SocketIOServer(this.httpServer, {
      cors: { origin: '*' },
    });
    this.isRunning = false;
    this.eventHandlers = new Map();
    this.audioDataClients = new Map(); // clientId -> socket

    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketIO();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
  }

  setupRoutes() {
    // Serve built files (same in dev and production)
    this.app.get('/renderer/', (req, res) => {
      res.sendFile(join(__dirname, '../renderer/dist/index.html'));
    });

    this.app.get('/popup', (req, res) => {
      res.sendFile(join(__dirname, '../popup/dist/popup.html'));
    });

    // Serve /assets from both renderer and popup (try both, first one wins)
    // This works because renderer and popup have different bundle names
    this.app.use(
      '/assets',
      express.static(join(__dirname, '../renderer/dist/assets')),
      express.static(join(__dirname, '../popup/dist/assets'))
    );

    // Serve butterchurn libs at root (shared by both renderer and popup)
    this.app.get('/butterchurn.min.js', (req, res) => {
      res.sendFile(join(__dirname, '../renderer/dist/butterchurn.min.js'));
    });
    this.app.get('/butterchurnPresets.min.js', (req, res) => {
      res.sendFile(join(__dirname, '../renderer/dist/butterchurnPresets.min.js'));
    });

    // Serve static assets at root (shared by both renderer and popup)
    this.app.use('/butterchurn-screenshots', express.static(join(__dirname, '../../static/images/butterchurn-screenshots')));
    this.app.use('/fonts', express.static(join(__dirname, '../../static/fonts')));

    this.app.get('/api/status', (req, res) => {
      const status = this.emit('get-status');
      res.json(status || { error: 'No status handler' });
    });

    this.app.post('/api/microphone/toggle', (req, res) => {
      const { enabled } = req.body;
      this.emit('microphone:toggle', enabled);
      res.json({ success: true, enabled });
    });

    this.app.post('/api/windows/create', (req, res) => {
      const result = this.emit('window:create-requested');
      res.json(result || { success: true });
    });

    this.app.post('/api/windows/:id/close', (req, res) => {
      const windowId = parseInt(req.params.id);
      this.emit('window:close-requested', windowId);
      res.json({ success: true });
    });

    this.app.post('/api/windows/:id/preset', (req, res) => {
      const windowId = parseInt(req.params.id);
      const { preset } = req.body;
      this.emit('preset:set-requested', { windowId, preset });
      res.json({ success: true });
    });

    this.app.post('/api/presets/set-all', (req, res) => {
      const { preset } = req.body;
      this.emit('preset:set-all-requested', preset);
      res.json({ success: true });
    });

    this.app.get('/api/presets', (req, res) => {
      const presets = this.emit('get-presets');
      res.json({ presets: presets || [] });
    });
  }

  setupSocketIO() {
    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      // Send current state
      const status = this.emit('get-status');
      socket.emit('status:update', status);

      // Handle browser visualization clients ready for WebRTC
      socket.on('visualization:ready', ({ clientId }) => {
        console.log(`Browser visualization client ready: ${clientId}`);
        this.audioDataClients.set(clientId, socket);

        // Notify main app to create WebRTC connection for this browser client
        this.emit('browser-client:ready', clientId);
      });

      // Relay WebRTC signaling: answer from browser to dashboard
      socket.on('webrtc:answer', ({ clientId, answer }) => {
        console.log(`WebRTC answer from browser client ${clientId}`);
        // Emit to main process to relay to dashboard
        this.emit('browser-client:answer', { clientId, answer });
      });

      // Relay WebRTC signaling: ICE candidate from browser to dashboard
      socket.on('webrtc:ice-candidate', ({ clientId, candidate }) => {
        console.log(`ICE candidate from browser client ${clientId}`);
        // Emit to main process to relay to dashboard
        this.emit('browser-client:ice', { clientId, candidate });
      });

      // Handle events
      socket.on('window:create', () => {
        this.emit('window:create-requested');
      });

      socket.on('window:close', (windowId) => {
        this.emit('window:close-requested', windowId);
      });

      socket.on('preset:set', ({ windowId, preset }) => {
        this.emit('preset:set-requested', { windowId, preset });
      });

      socket.on('preset:set-all', (preset) => {
        this.emit('preset:set-all-requested', preset);
      });

      socket.on('microphone:toggle', (enabled) => {
        this.emit('microphone:toggle', enabled);
      });

      socket.on('preset:loaded', ({ clientId, preset }) => {
        console.log(`Browser client ${clientId} loaded preset: ${preset}`);
        // Emit to main process to relay to dashboard
        this.emit('browser-client:preset-loaded', { clientId, preset });
      });

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        // Clean up audio data client if it was registered
        for (const [clientId, clientSocket] of this.audioDataClients.entries()) {
          if (clientSocket === socket) {
            this.audioDataClients.delete(clientId);
            console.log(`Visualization client left: ${clientId}`);

            // Notify main process so it can broadcast to renderer
            this.emit('browser-client:closed', clientId);

            // Also broadcast via Socket.IO for other connected clients
            this.io.emit('window:closed', { windowId: clientId });
            break;
          }
        }
      });
    });
  }

  /**
   * Register an event handler
   */
  on(event, handler) {
    this.eventHandlers.set(event, handler);
  }

  /**
   * Emit an event to registered handlers
   */
  emit(event, data) {
    const handler = this.eventHandlers.get(event);
    if (handler) {
      return handler(data);
    }
    return null;
  }

  /**
   * Broadcast status update to all connected clients
   */
  broadcastStatus(status) {
    this.io.emit('status:update', status);
  }

  /**
   * Broadcast window created
   */
  broadcastWindowCreated(windowId) {
    this.io.emit('window:created', { windowId });
  }

  /**
   * Broadcast window closed
   */
  broadcastWindowClosed(windowId) {
    this.io.emit('window:closed', { windowId });
  }

  /**
   * Broadcast preset changed
   */
  broadcastPresetChanged(windowId, preset) {
    this.io.emit('preset:changed', { windowId, preset });
  }

  /**
   * Send WebRTC offer to browser client
   */
  sendOfferToBrowserClient(clientId, offer) {
    const socket = this.audioDataClients.get(clientId);
    if (socket) {
      socket.emit('webrtc:offer', { offer });
      console.log(`Sent WebRTC offer to browser client ${clientId}`);
    } else {
      console.error(`Browser client ${clientId} not found`);
    }
  }

  /**
   * Send ICE candidate to browser client
   */
  sendIceCandidateToBrowserClient(clientId, candidate) {
    const socket = this.audioDataClients.get(clientId);
    if (socket) {
      socket.emit('webrtc:ice-candidate', { candidate });
    }
  }

  /**
   * Get list of connected browser clients
   */
  getBrowserClientIds() {
    return Array.from(this.audioDataClients.keys());
  }

  /**
   * Start the server
   */
  start() {
    return new Promise((resolve, reject) => {
      const tryPort = (portToTry) => {
        try {
          this.httpServer.listen(portToTry, () => {
            this.port = portToTry;
            this.isRunning = true;
            console.log(`Server running on http://localhost:${this.port}`);
            resolve();
          });

          this.httpServer.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
              console.log(`Port ${portToTry} in use, trying ${portToTry + 1}...`);
              this.httpServer.removeAllListeners('error');
              tryPort(portToTry + 1);
            } else {
              reject(error);
            }
          });
        } catch (error) {
          reject(error);
        }
      };

      tryPort(this.port);
    });
  }

  /**
   * Stop the server
   */
  stop() {
    return new Promise((resolve) => {
      if (this.isRunning) {
        this.httpServer.close(() => {
          this.isRunning = false;
          console.log('Server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Get server status
   */
  getStatus() {
    return {
      running: this.isRunning,
      port: this.port,
      url: `http://localhost:${this.port}`,
    };
  }
}
