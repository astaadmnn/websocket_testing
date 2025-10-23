/**
 * Arduino RFID Integration for SmartBite
 * 
 * This script handles the connection to Arduino RFID readers
 * and populates the card register field when an RFID card is scanned.
 */

document.addEventListener("DOMContentLoaded", () => {
  // Get UI elements
  const cardNumberField = document.getElementById("card_number_register");
  const connectButton = document.getElementById("connectArduinoBtn");
  const statusDot = document.getElementById("arduinoStatusDot");
  const statusText = document.getElementById("arduinoStatusText");
  const modalConnectionStatus = document.getElementById("modalConnectionStatus");
  const modalPortName = document.getElementById("modalPortName");
  const modalLastCardRead = document.getElementById("modalLastCardRead");
  const arduinoStatusModal = document.getElementById("arduinoStatusModal");
  const closeArduinoStatusBtn = document.getElementById("closeArduinoStatusBtn");
  const cardNumberContainer = document.getElementById("cardNumberContainer");
  
  // Initialize Arduino detector
  let arduinoDetector = null;
  
  // Update status UI
  function updateConnectionStatus(connected, portInfo = null) {
    if (connected) {
      // Update main UI
      statusDot.classList.remove("bg-red-500");
      statusDot.classList.add("bg-green-500");
      statusText.textContent = "Arduino connected";
      
      // Update button
      if (connectButton) {
        connectButton.innerHTML = '<i class="fas fa-unlink"></i> Disconnect Arduino';
        connectButton.classList.remove("bg-blue-500", "hover:bg-blue-600");
        connectButton.classList.add("bg-red-500", "hover:bg-red-600");
      }
      
      // Update card input field
      if (cardNumberContainer) {
        cardNumberContainer.classList.add("rfid-active");
      }
      
      // Update modal if open
      if (modalConnectionStatus) {
        modalConnectionStatus.textContent = "Connected";
        modalConnectionStatus.classList.remove("text-red-500");
        modalConnectionStatus.classList.add("text-green-500");
      }
      
      if (modalPortName && portInfo) {
        modalPortName.textContent = portInfo.getInfo ? 
          portInfo.getInfo().usbVendorId || "Unknown" :
          "Connected";
      }
    } else {
      // Update main UI
      statusDot.classList.remove("bg-green-500");
      statusDot.classList.add("bg-red-500");
      statusText.textContent = "Arduino disconnected";
      
      // Update button
      if (connectButton) {
        connectButton.innerHTML = '<i class="fas fa-microchip"></i> Connect Arduino';
        connectButton.classList.remove("bg-red-500", "hover:bg-red-600");
        connectButton.classList.add("bg-blue-500", "hover:bg-blue-600");
      }
      
      // Update card input field
      if (cardNumberContainer) {
        cardNumberContainer.classList.remove("rfid-active");
      }
      
      // Update modal if open
      if (modalConnectionStatus) {
        modalConnectionStatus.textContent = "Disconnected";
        modalConnectionStatus.classList.remove("text-green-500");
        modalConnectionStatus.classList.add("text-red-500");
      }
      
      if (modalPortName) {
        modalPortName.textContent = "None";
      }
    }
  }
  
  // Handle card reading
  function onCardRead(cardNumber) {
    console.log("Card read:", cardNumber);
    
    // Play a beep sound for feedback (browser-based feedback)
    try {
      const beep = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YWoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLXPM+dF5MwgZWL/z3og9CQxIt/zkkkMHAj6y+uiYRgT9M6v47JtHAPovpPvvnEj+9iuh/fCdSPv0KZ///55I+PEnngDwoEj18iWdAfShSPPzJJwC9aJI8fQimwL2o0jw9SGbA/ijR+/2IZoE+aRI7vcgmQT7pEjt+B+ZBPykSOz5H5gF/aNH7PofmAX9o0bs+h6XBf+jRuz6HpcF/6NG7PoeZBf+/6NG7PoeVwY=");
      beep.play();
    } catch (e) {
      console.log("Browser audio not supported");
    }
    
    // Populate card number field
    if (cardNumberField) {
      cardNumberField.value = cardNumber;
      
      // Highlight the field to show it was updated
      cardNumberField.classList.add("bg-green-50");
      setTimeout(() => {
        cardNumberField.classList.remove("bg-green-50");
      }, 2000);
      
      // Trigger input event to validate
      const inputEvent = new Event('input', {
        bubbles: true,
        cancelable: true,
      });
      cardNumberField.dispatchEvent(inputEvent);
    }
    
    // Update last card read in modal
    if (modalLastCardRead) {
      modalLastCardRead.textContent = cardNumber;
    }
  }
  
  // Initialize Arduino detector
  function initializeDetector() {
    if (typeof ArduinoDetector !== 'function') {
      console.error("ArduinoDetector not available! Make sure arduino_detector.js is loaded.");
      return false;
    }
    
    arduinoDetector = new ArduinoDetector({
      baudRate: 9600,
      autoReconnect: true,
      debug: true,
      
      // Handle card readings
      rfidReadCallback: onCardRead,
      
      // Handle connection status
      connectionCallback: (port) => {
        updateConnectionStatus(true, port);
        console.log("Arduino connected successfully");
      },
      
      disconnectionCallback: () => {
        updateConnectionStatus(false);
        console.log("Arduino disconnected");
      }
    });
    
    return true;
  }
  
  // Toggle Arduino connection
  function toggleArduinoConnection() {
    if (!arduinoDetector) {
      if (!initializeDetector()) {
        alert("Could not initialize Arduino detector. Make sure Web Serial API is supported in your browser.");
        return;
      }
    }
    
    if (statusDot.classList.contains("bg-green-500")) {
      // Currently connected, disconnect
      arduinoDetector.disconnect();
    } else {
      // Currently disconnected, connect
      arduinoDetector.connect().then(success => {
        if (!success) {
          alert("Failed to connect to Arduino. Make sure it's properly connected and try again.");
        }
      });
    }
  }
  
  // Show/hide modal
  function showModal() {
    if (arduinoStatusModal) {
      arduinoStatusModal.classList.remove("hidden");
      arduinoStatusModal.classList.add("flex");
    }
  }
  
  function hideModal() {
    if (arduinoStatusModal) {
      arduinoStatusModal.classList.add("hidden");
      arduinoStatusModal.classList.remove("flex");
    }
  }
  
  // Set up event listeners
  if (connectButton) {
    connectButton.addEventListener("click", toggleArduinoConnection);
  }
  
  if (statusText) {
    statusText.addEventListener("click", showModal);
  }
  
  if (closeArduinoStatusBtn) {
    closeArduinoStatusBtn.addEventListener("click", hideModal);
  }
  
  // Initialize Arduino detector on page load
  initializeDetector();
  
  // Try to auto-connect if allowed
  try {
    navigator.serial.getPorts().then(ports => {
      if (ports.length > 0 && arduinoDetector) {
        console.log("Previously connected Arduino found. Attempting to reconnect...");
        arduinoDetector.connect();
      }
    });
  } catch (e) {
    console.log("Auto-connect not possible:", e);
  }
});