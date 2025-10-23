/**
 * Arduino Serial Bridge for SmartBite
 * 
 * This script provides a bridge between the Web Serial API and Arduino.
 * It can also be used with the Python script to automatically detect Arduino ports.
 */

// Store detected ports and active connections
const arduinoSerialBridge = {
  detectedPorts: [],
  activeConnection: null,
  listeners: [],
  
  /**
   * Check if Web Serial API is supported in this browser
   */
  isSupported: function() {
    return !!(navigator.serial && navigator.serial.getPorts);
  },
  
  /**
   * Initialize the bridge
   */
  init: async function() {
    if (!this.isSupported()) {
      console.error('Web Serial API not supported. Use Chrome or Edge browser.');
      return false;
    }
    
    // Try to get previously authorized ports
    this.detectedPorts = await navigator.serial.getPorts();
    return true;
  },
  
  /**
   * Request user permission to access a port
   */
  requestPortAccess: async function() {
    if (!this.isSupported()) return null;
    
    try {
      const port = await navigator.serial.requestPort();
      if (port) {
        this.detectedPorts.push(port);
      }
      return port;
    } catch (err) {
      console.error('Failed to request port access:', err);
      return null;
    }
  },
  
  /**
   * Try to connect to the first available port
   */
  connectToFirstAvailable: async function() {
    if (!this.isSupported() || this.detectedPorts.length === 0) return null;
    
    for (const port of this.detectedPorts) {
      try {
        await port.open({ baudRate: 9600 });
        this.activeConnection = port;
        this._startReading(port);
        return port;
      } catch (err) {
        console.log('Failed to connect to port:', err);
      }
    }
    
    return null;
  },
  
  /**
   * Try all available ports to find an Arduino
   */
  autoDetectArduino: async function() {
    if (!this.isSupported()) return null;
    
    // First try previously authorized ports
    await this.init();
    
    if (this.detectedPorts.length > 0) {
      const port = await this.connectToFirstAvailable();
      if (port) return port;
    }
    
    // If that fails, ask user permission to try new ports
    return await this.requestPortAccess();
  },
  
  /**
   * Start reading from a connected port
   */
  _startReading: function(port) {
    if (!port || !port.readable) return;
    
    const reader = port.readable.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    
    // Read loop
    const readLoop = async () => {
      try {
        while (true) {
          const { value, done } = await reader.read();
          
          if (done) {
            reader.releaseLock();
            break;
          }
          
          // Process the data
          const text = decoder.decode(value);
          buffer += text;
          
          // Process complete lines
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer
          
          // Process complete lines
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed) {
              this._notifyListeners(trimmed);
            }
          }
        }
      } catch (err) {
        console.error('Error reading from serial port:', err);
      } finally {
        reader.releaseLock();
        this.activeConnection = null;
      }
    };
    
    readLoop();
  },
  
  /**
   * Add a listener for card data
   */
  addListener: function(callback) {
    if (typeof callback === 'function') {
      this.listeners.push(callback);
    }
  },
  
  /**
   * Remove a listener
   */
  removeListener: function(callback) {
    const index = this.listeners.indexOf(callback);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  },
  
  /**
   * Notify all listeners of new data
   */
  _notifyListeners: function(data) {
    for (const listener of this.listeners) {
      try {
        listener(data);
      } catch (err) {
        console.error('Error in listener:', err);
      }
    }
  }
};

// Export for use in other scripts
window.arduinoSerialBridge = arduinoSerialBridge;
