/**
 * Arduino Serial Bridge for SmartBite System (Node.js version)
 * 
 * This script provides a Node.js server that connects to an Arduino RFID reader
 * and forwards card data to a web client via WebSockets.
 * 
 * Usage:
 *   node arduino_bridge.js [options]
 * 
 * Options:
 *   --port <port>       Serial port to use (e.g. COM3 or /dev/ttyACM0)
 *   --baud <rate>       Baud rate (default: 9600)
 *   --web-port <port>   Web server port (default: 8080)
 *   --help              Show help
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const SerialPort = require('serialport');
const Readline = require('@serialport/parser-readline');

// Default configuration
const config = {
  serialPort: null,
  baudRate: 9600,
  webPort: 8080,
  autoDetect: true,
  debug: true
};

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--port':
        config.serialPort = args[++i];
        config.autoDetect = false;
        break;
      case '--baud':
        config.baudRate = parseInt(args[++i], 10);
        break;
      case '--web-port':
        config.webPort = parseInt(args[++i], 10);
        break;
      case '--debug':
        config.debug = true;
        break;
      case '--help':
        showHelp();
        process.exit(0);
        break;
    }
  }
}

// Display help message
function showHelp() {
  console.log(`
Arduino Serial Bridge for SmartBite System

Usage:
  node arduino_bridge.js [options]

Options:
  --port <port>       Serial port to use (e.g. COM3 or /dev/ttyACM0)
  --baud <rate>       Baud rate (default: 9600)
  --web-port <port>   Web server port (default: 8080)
  --debug             Enable debug logging
  --help              Show this help message

Examples:
  node arduino_bridge.js --port COM3
  node arduino_bridge.js --port /dev/ttyACM0 --baud 115200
  node arduino_bridge.js                      # Auto-detect Arduino ports
  `);
}

// Debug logging function
function log(message) {
  if (config.debug) {
    console.log(`[${new Date().toISOString()}] ${message}`);
  }
}

// List all available serial ports
async function listPorts() {
  try {
    const ports = await SerialPort.list();
    log(`Found ${ports.length} serial ports:`);
    
    ports.forEach((port, i) => {
      log(`[${i}] ${port.path} - ${port.manufacturer || 'Unknown manufacturer'}`);
    });
    
    return ports;
  } catch (err) {
    console.error('Error listing serial ports:', err);
    return [];
  }
}

// Check if a port is likely an Arduino
function isArduino(port) {
  if (!port.manufacturer && !port.productId) return false;
  
  const manufacturer = (port.manufacturer || '').toLowerCase();
  const productId = (port.productId || '').toLowerCase();
  const vendorId = (port.vendorId || '').toLowerCase();
  
  // Common Arduino-related identifiers
  const arduinoSignatures = [
    'arduino',
    'wch',
    'ch340',
    'ftdi',
    '2341', // Arduino Vendor ID
    '1a86'  // CH340 Vendor ID
  ];
  
  return arduinoSignatures.some(sig => 
    manufacturer.includes(sig) || 
    productId.includes(sig) || 
    vendorId.includes(sig)
  );
}

// Find Arduino ports
async function findArduinoPorts() {
  const allPorts = await listPorts();
  const arduinoPorts = allPorts.filter(port => isArduino(port));
  
  if (arduinoPorts.length > 0) {
    log(`Found ${arduinoPorts.length} Arduino-like ports`);
    return arduinoPorts;
  }
  
  log('No Arduino-like ports found. Will try all available ports.');
  return allPorts;
}

// Connect to the specified serial port
function connectToPort(portPath) {
  return new Promise((resolve, reject) => {
    log(`Attempting to connect to ${portPath} at ${config.baudRate} baud`);
    
    const port = new SerialPort(portPath, { 
      baudRate: config.baudRate,
      autoOpen: false
    });
    
    port.open(err => {
      if (err) {
        log(`Error opening port ${portPath}: ${err.message}`);
        return reject(err);
      }
      
      log(`Connected to ${portPath} successfully`);
      
      // Give Arduino time to reset after connection
      setTimeout(() => {
        // Create a readline parser to handle line-by-line data
        const parser = port.pipe(new Readline({ delimiter: '\n' }));
        resolve({ port, parser });
      }, 2000);
    });
    
    port.on('error', err => {
      log(`Serial port error: ${err.message}`);
    });
  });
}

// Auto-detect and connect to Arduino
async function autoDetectArduino() {
  try {
    const arduinoPorts = await findArduinoPorts();
    
    if (arduinoPorts.length === 0) {
      log('No ports available to connect to');
      return null;
    }
    
    // Try to connect to each port until successful
    for (const port of arduinoPorts) {
      try {
        const connection = await connectToPort(port.path);
        return connection;
      } catch (err) {
        log(`Failed to connect to ${port.path}: ${err.message}`);
        // Continue to the next port
      }
    }
    
    log('Failed to connect to any available port');
    return null;
  } catch (err) {
    log(`Error in auto-detection: ${err.message}`);
    return null;
  }
}

// Start the WebSocket server
function startWebSocketServer() {
  // Create a simple HTTP server
  const server = http.createServer((req, res) => {
    if (req.url === '/') {
      // Serve a simple test page
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>SmartBite Arduino Bridge</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
          .card { padding: 15px; margin: 10px 0; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
          .connected { background-color: #d4edda; }
          .disconnected { background-color: #f8d7da; }
          #cardList { max-height: 300px; overflow-y: auto; }
          .card-event { padding: 10px; border-bottom: 1px solid #eee; }
        </style>
      </head>
      <body>
        <h1>SmartBite Arduino Bridge</h1>
        <div id="status" class="card disconnected">
          <h3>Status: <span id="statusText">Disconnected</span></h3>
          <p>Waiting for connection to Arduino...</p>
        </div>
        
        <h3>RFID Card Events:</h3>
        <div id="cardList"></div>
        
        <script>
          const statusEl = document.getElementById('status');
          const statusText = document.getElementById('statusText');
          const cardList = document.getElementById('cardList');
          
          // Connect to WebSocket server
          const ws = new WebSocket('ws://' + location.host);
          
          ws.onopen = () => {
            console.log('WebSocket connected');
          };
          
          ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log('Received:', data);
            
            if (data.type === 'status') {
              statusText.textContent = data.connected ? 'Connected' : 'Disconnected';
              statusEl.className = data.connected ? 'card connected' : 'card disconnected';
            }
            else if (data.type === 'card') {
              const item = document.createElement('div');
              item.className = 'card-event';
              item.textContent = \`Card detected: \${data.cardNumber} (\${new Date().toLocaleTimeString()})\`;
              cardList.insertBefore(item, cardList.firstChild);
            }
          };
          
          ws.onclose = () => {
            statusText.textContent = 'Server Disconnected';
            statusEl.className = 'card disconnected';
          };
        </script>
      </body>
      </html>
      `);
    } else {
      // 404 for other routes
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    }
  });

  // Create a WebSocket server
  const wss = new WebSocket.Server({ server });
  
  // Store connected clients
  const clients = new Set();
  
  // Handle WebSocket connections
  wss.on('connection', (ws) => {
    log('New WebSocket client connected');
    clients.add(ws);
    
    ws.on('close', () => {
      log('WebSocket client disconnected');
      clients.delete(ws);
    });
  });
  
  // Start the server
  server.listen(config.webPort, () => {
    log(`WebSocket server listening on port ${config.webPort}`);
    log(`Open http://localhost:${config.webPort} in your browser to monitor card events`);
  });
  
  // Function to broadcast to all connected clients
  function broadcast(message) {
    const data = JSON.stringify(message);
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }
  
  return { broadcast };
}

// Main function
async function main() {
  // Parse command line arguments
  parseArgs();
  
  console.log('==============================================');
  console.log('SmartBite Arduino Bridge for RFID Card Reading');
  console.log('==============================================');
  
  // Start WebSocket server
  const { broadcast } = startWebSocketServer();
  
  let serialConnection = null;
  let reconnectTimer = null;
  
  // Function to attempt connection
  async function attemptConnection() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    
    if (config.serialPort) {
      // Connect to specified port
      try {
        serialConnection = await connectToPort(config.serialPort);
        onConnected(serialConnection);
      } catch (err) {
        log(`Failed to connect to ${config.serialPort}: ${err.message}`);
        scheduleReconnect();
      }
    } else {
      // Auto-detect Arduino
      serialConnection = await autoDetectArduino();
      
      if (serialConnection) {
        onConnected(serialConnection);
      } else {
        log('Failed to detect Arduino. Will retry in 5 seconds.');
        scheduleReconnect();
      }
    }
  }
  
  // Handle successful connection
  function onConnected({ port, parser }) {
    log('Arduino connected successfully');
    broadcast({ type: 'status', connected: true });
    
    parser.on('data', line => {
      const trimmedLine = line.trim();
      log(`Received data: "${trimmedLine}"`);
      
      // Check if the data is a valid 10-digit card number
      if (/^\d{10}$/.test(trimmedLine)) {
        log(`RFID card detected: ${trimmedLine}`);
        broadcast({ type: 'card', cardNumber: trimmedLine });
      }
    });
    
    port.on('close', () => {
      log('Serial port closed unexpectedly');
      broadcast({ type: 'status', connected: false });
      serialConnection = null;
      scheduleReconnect();
    });
  }
  
  // Schedule reconnection attempt
  function scheduleReconnect() {
    if (!reconnectTimer) {
      log('Scheduling reconnection attempt in 5 seconds...');
      reconnectTimer = setTimeout(() => {
        attemptConnection();
      }, 5000);
    }
  }
  
  // Handle process termination
  function cleanup() {
    log('Shutting down...');
    
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
    }
    
    if (serialConnection && serialConnection.port) {
      serialConnection.port.close();
    }
    
    process.exit(0);
  }
  
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  
  // Start the connection process
  attemptConnection();
}

// Check if SerialPort module is installed
try {
  require.resolve('serialport');
  require.resolve('@serialport/parser-readline');
  require.resolve('ws');
  
  // Start the application
  main();
} catch (err) {
  console.error('Missing required npm packages. Please install them with:');
  console.error('npm install serialport @serialport/parser-readline ws');
  process.exit(1);
}