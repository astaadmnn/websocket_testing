/**
 * Arduino Auto-Detector for SmartBite RFID System
 * 
 * This script automatically detects and connects to Arduino devices on all available
 * serial ports. It's designed to work with the RFID reader functionality in the
 * SmartBite system.
 */

class ArduinoDetector {
  constructor(options = {}) {
    this.options = {
      baudRate: 9600,
      rfidReadCallback: null,
      connectionCallback: null,
      disconnectionCallback: null,
      autoReconnect: true,
      reconnectDelay: 5000,
      debug: false,
      ...options
    };
    
    this.port = null;
    this.reader = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.reconnectTimer = null;
    this.buffer = "";
    this.ports = [];
    
    // Bind methods
    this.connect = this.connect.bind(this);
    this.disconnect = this.disconnect.bind(this);
    this.onReceiveData = this.onReceiveData.bind(this);
    this.reconnect = this.reconnect.bind(this);
    
    // Check if SerialPort API is available
    if (typeof navigator === 'undefined' || !navigator.serial) {
      this.log('Web Serial API not supported in this browser. Try Chrome or Edge.');
      return null;
    }
    
    this.log('Arduino Detector initialized');
  }
  
  /**
   * Log messages when debug is enabled
   */
  log(...args) {
    if (this.options.debug) {
      console.log('[ArduinoDetector]', ...args);
    }
  }
  
  /**
   * List all available serial ports
   * @returns {Promise<Array>} List of available ports
   */
  async listPorts() {
    try {
      this.ports = await navigator.serial.getPorts();
      this.log(`Found ${this.ports.length} previously connected ports`);
      return this.ports;
    } catch (error) {
      this.log('Error listing ports:', error);
      return [];
    }
  }
  
  /**
   * Request user to select a serial port
   * @returns {Promise<SerialPort|null>}
   */
  async requestPort() {
    try {
      const port = await navigator.serial.requestPort();
      this.log('User selected port:', port);
      return port;
    } catch (error) {
      this.log('User cancelled port selection or error:', error);
      return null;
    }
  }
  
  /**
   * Try to connect to a specific port
   * @param {SerialPort} port - The port to connect to
   * @returns {Promise<boolean>} True if connection successful
   */
  async tryConnect(port) {
    try {
      this.log('Trying to connect to port:', port);
      await port.open({ baudRate: this.options.baudRate });
      
      // Success! Set as current port
      this.port = port;
      this.isConnected = true;
      
      // Set up the reader for incoming data
      this.startReading();
      
      // Call the connection callback if provided
      if (this.options.connectionCallback) {
        this.options.connectionCallback(port);
      }
      
      this.log('Successfully connected to Arduino');
      return true;
    } catch (error) {
      this.log('Failed to connect to this port:', error);
      return false;
    }
  }
  
  /**
   * Start reading data from the connected port
   */
  async startReading() {
    if (!this.port || !this.isConnected) return;
    
    const textDecoder = new TextDecoder();
    this.reader = this.port.readable.getReader();
    
    try {
      while (true) {
        const { value, done } = await this.reader.read();
        
        if (done) {
          this.log('Reader has been cancelled');
          break;
        }
        
        const text = textDecoder.decode(value);
        this.onReceiveData(text);
      }
    } catch (error) {
      this.log('Error reading from port:', error);
    } finally {
      this.reader.releaseLock();
      this.handleDisconnection();
    }
  }
  
  /**
   * Handle received data from Arduino
   * @param {string} data - The received data
   */
  onReceiveData(data) {
    // Add to buffer and process complete lines
    this.buffer += data;
    
    // Process complete lines (RFID card numbers)
    const lines = this.buffer.split('\n');
    
    // Keep the last incomplete line in the buffer
    this.buffer = lines.pop() || "";
    
    // Process each complete line
    lines.forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine) {
        this.log('Received RFID data:', trimmedLine);
        
        // Check if it's a valid 10-digit card number
        if (/^\d{10}$/.test(trimmedLine)) {
          if (this.options.rfidReadCallback) {
            this.options.rfidReadCallback(trimmedLine);
          }
        }
      }
    });
  }
  
  /**
   * Handle disconnection and cleanup
   */
  handleDisconnection() {
    if (!this.isConnected) return;
    
    this.isConnected = false;
    this.log('Disconnected from Arduino');
    
    if (this.options.disconnectionCallback) {
      this.options.disconnectionCallback();
    }
    
    // Auto-reconnect if enabled
    if (this.options.autoReconnect && !this.reconnectTimer) {
      this.log(`Will try to reconnect in ${this.options.reconnectDelay / 1000} seconds...`);
      this.reconnectTimer = setTimeout(this.reconnect, this.options.reconnectDelay);
    }
  }
  
  /**
   * Attempt to reconnect
   */
  async reconnect() {
    this.reconnectTimer = null;
    this.log('Attempting to reconnect...');
    await this.connect();
  }
  
  /**
   * Connect to an Arduino by trying all available ports
   * @returns {Promise<boolean>} True if connection successful
   */
  async connect() {
    if (this.isConnected || this.isConnecting) {
      this.log('Already connected or connecting');
      return this.isConnected;
    }
    
    this.isConnecting = true;
    let connected = false;
    
    try {
      // First try ports we've connected to before
      let ports = await this.listPorts();
      
      // If no previously connected ports, request permission for all ports
      if (ports.length === 0) {
        const port = await this.requestPort();
        if (port) ports = [port];
      }
      
      // Try each port until one works
      for (const port of ports) {
        connected = await this.tryConnect(port);
        if (connected) break;
      }
      
      return connected;
    } catch (error) {
      this.log('Error during connection process:', error);
      return false;
    } finally {
      this.isConnecting = false;
    }
  }
  
  /**
   * Disconnect from the Arduino
   */
  async disconnect() {
    if (!this.isConnected || !this.port) return;
    
    // Clear any pending reconnect
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    try {
      if (this.reader) {
        await this.reader.cancel();
        this.reader = null;
      }
      
      await this.port.close();
      this.isConnected = false;
      this.log('Disconnected from Arduino');
      
      if (this.options.disconnectionCallback) {
        this.options.disconnectionCallback();
      }
    } catch (error) {
      this.log('Error during disconnection:', error);
    }
  }
}

// Make available globally
window.ArduinoDetector = ArduinoDetector;