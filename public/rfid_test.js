/**
 * Arduino RFID Test Utility
 * 
 * This utility helps test if your Arduino is properly connected and
 * correctly reading RFID cards for the SmartBite system.
 */

// DOM elements
const statusElement = document.getElementById('status');
const cardNumberElement = document.getElementById('cardNumber');
const logElement = document.getElementById('log');
const connectButton = document.getElementById('connectButton');
const clearButton = document.getElementById('clearButton');

// Card detection history
let cardHistory = [];
const MAX_HISTORY = 10;

// Initialize ArduinoDetector
let arduinoDetector = null;

// Update status display
function updateStatus(connected) {
  if (statusElement) {
    if (connected) {
      statusElement.textContent = 'Connected';
      statusElement.className = 'text-green-500 font-bold';
      connectButton.textContent = 'Disconnect';
      connectButton.className = 'bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded';
    } else {
      statusElement.textContent = 'Disconnected';
      statusElement.className = 'text-red-500 font-bold';
      connectButton.textContent = 'Connect Arduino';
      connectButton.className = 'bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded';
    }
  }
}

// Add a log entry
function addLogEntry(message, isCard = false) {
  if (!logElement) return;
  
  const entry = document.createElement('div');
  entry.className = isCard ? 'log-entry card-entry' : 'log-entry';
  
  const timestamp = new Date().toLocaleTimeString();
  entry.innerHTML = `<span class="text-gray-500">[${timestamp}]</span> ${message}`;
  
  logElement.insertBefore(entry, logElement.firstChild);
  
  // Trim log if too long
  if (logElement.children.length > 100) {
    logElement.removeChild(logElement.lastChild);
  }
}

// Update card display
function updateCardDisplay(cardNumber) {
  if (!cardNumberElement) return;
  
  cardNumberElement.textContent = cardNumber;
  cardNumberElement.className = 'text-xl font-bold bg-green-100 p-4 rounded animate-pulse';
  
  // Stop animation after a moment
  setTimeout(() => {
    cardNumberElement.classList.remove('animate-pulse');
  }, 2000);
  
  // Add to card history
  addCardToHistory(cardNumber);
}

// Add card to history
function addCardToHistory(cardNumber) {
  // Avoid duplicates in a row
  if (cardHistory.length > 0 && cardHistory[0] === cardNumber) return;
  
  // Add to beginning
  cardHistory.unshift(cardNumber);
  
  // Trim if too long
  if (cardHistory.length > MAX_HISTORY) {
    cardHistory.pop();
  }
  
  // Update history display
  updateHistoryDisplay();
}

// Update history display
function updateHistoryDisplay() {
  const historyElement = document.getElementById('cardHistory');
  if (!historyElement) return;
  
  historyElement.innerHTML = '';
  
  cardHistory.forEach((card, index) => {
    const item = document.createElement('div');
    item.className = index === 0 ? 
      'p-2 border-l-4 border-green-500 bg-green-50' : 
      'p-2 border-l-4 border-gray-300';
    item.textContent = card;
    historyElement.appendChild(item);
  });
}

// Clear log
function clearLog() {
  if (logElement) logElement.innerHTML = '';
}

// Initialize detector
function initializeDetector() {
  // Check if ArduinoDetector is available
  if (typeof ArduinoDetector !== 'function') {
    addLogEntry('Error: ArduinoDetector not available. Make sure arduino_detector.js is loaded.');
    return false;
  }
  
  // Create detector
  arduinoDetector = new ArduinoDetector({
    debug: true,
    baudRate: 9600,
    autoReconnect: true,
    
    // Handle card readings
    rfidReadCallback: (cardNumber) => {
      updateCardDisplay(cardNumber);
      addLogEntry(`Card detected: ${cardNumber}`, true);
      
      // Play beep sound
      try {
        const beep = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YWoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLXPM+dF5MwgZWL/z3og9CQxIt/zkkkMHAj6y+uiYRgT9M6v47JtHAPovpPvvnEj+9iuh/fCdSPv0KZ///55I+PEnngDwoEj18iWdAfShSPPzJJwC9aJI8fQimwL2o0jw9SGbA/ijR+/2IZoE+aRI7vcgmQT7pEjt+B+ZBPykSOz5H5gF/aNH7PofmAX9o0bs+h6XBf+jRuz6HpcF/6NG7PoeZBf+/6NG7PoeVwY=");
        beep.play();
      } catch (e) {
        console.log("Browser audio not supported");
      }
    },
    
    // Handle connection status
    connectionCallback: () => {
      updateStatus(true);
      addLogEntry('Arduino connected successfully');
    },
    
    disconnectionCallback: () => {
      updateStatus(false);
      addLogEntry('Arduino disconnected');
    }
  });
  
  return true;
}

// Connect/disconnect button handler
function toggleConnection() {
  if (!arduinoDetector) {
    if (!initializeDetector()) return;
  }
  
  if (connectButton.textContent.includes('Connect')) {
    // Connect
    connectButton.textContent = 'Connecting...';
    connectButton.disabled = true;
    
    arduinoDetector.connect().then(success => {
      connectButton.disabled = false;
      if (!success) {
        addLogEntry('Failed to connect to Arduino');
      }
    });
  } else {
    // Disconnect
    arduinoDetector.disconnect();
  }
}

// Set up event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Initialize detector
  initializeDetector();
  
  // Set up button handlers
  if (connectButton) {
    connectButton.addEventListener('click', toggleConnection);
  }
  
  if (clearButton) {
    clearButton.addEventListener('click', clearLog);
  }
  
  addLogEntry('RFID Test Utility loaded');
});