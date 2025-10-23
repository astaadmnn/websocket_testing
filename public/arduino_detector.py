"""
Arduino Auto-Detector for SmartBite RFID System

This Python script automatically detects Arduino devices on all available serial ports
and forwards RFID card data to either a local HTTP endpoint or to the console.

Requirements:
- Python 3.6+
- pyserial
- requests (optional, for HTTP forwarding)

Usage:
python arduino_detector.py [--http-endpoint URL] [--baud-rate RATE]
"""

import argparse
import json
import os
import sys
import time
from typing import Dict, List, Optional, Union

try:
    import serial
    import serial.tools.list_ports
except ImportError:
    print("Error: pyserial package not installed. Install it using:")
    print("pip install pyserial")
    sys.exit(1)

try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False
    print("Warning: requests package not installed. HTTP forwarding disabled.")
    print("To enable HTTP forwarding, install it using:")
    print("pip install requests")


class ArduinoDetector:
    def __init__(
        self,
        baud_rate: int = 9600,
        http_endpoint: Optional[str] = None,
        debug: bool = False
    ):
        self.baud_rate = baud_rate
        self.http_endpoint = http_endpoint
        self.debug = debug
        self.serial_port = None
        self.connected = False
        self.ports_info = []
        self.last_scan_time = 0

    def log(self, message: str):
        """Print debug messages if debug mode is enabled"""
        if self.debug:
            print(f"[ArduinoDetector] {message}")

    def list_ports(self) -> List[Dict[str, str]]:
        """List all available serial ports"""
        ports = []
        for port in serial.tools.list_ports.comports():
            port_info = {
                "device": port.device,
                "description": port.description,
                "hwid": port.hwid,
                "manufacturer": port.manufacturer if hasattr(port, 'manufacturer') else None,
            }
            ports.append(port_info)
            self.log(f"Found port: {port.device} - {port.description}")
        
        self.ports_info = ports
        self.last_scan_time = time.time()
        return ports

    def is_arduino(self, port_info: Dict[str, str]) -> bool:
        """Check if the port is likely an Arduino based on description"""
        if not port_info.get('description'):
            return False
        
        description = port_info['description'].lower()
        manufacturer = str(port_info.get('manufacturer') or '').lower()
        
        arduino_keywords = ['arduino', 'uno', 'mega', 'leonardo', 'nano', 'micro', 'due', 'ch340', 'ft232', 'usb serial']
        
        return any(keyword in description or keyword in manufacturer for keyword in arduino_keywords)

    def try_connect(self, port_name: str) -> bool:
        """Try to connect to a specific port"""
        try:
            self.log(f"Trying to connect to {port_name}")
            
            # Close existing connection if any
            if self.serial_port and self.serial_port.is_open:
                self.serial_port.close()
                self.connected = False
                self.serial_port = None
            
            # Create new serial connection
            serial_port = serial.Serial(port_name, self.baud_rate, timeout=1)
            time.sleep(2)  # Wait for Arduino reset
            
            # Flush any pending data
            serial_port.reset_input_buffer()
            serial_port.reset_output_buffer()
            
            # Send a test command to check if it's really an Arduino with RFID reader
            # Uncomment if your Arduino expects a command
            # serial_port.write(b'TEST\n')
            # time.sleep(0.5)
            # response = serial_port.readline().decode('utf-8', errors='ignore').strip()
            # if not response or 'READY' not in response:
            #    serial_port.close()
            #    return False
            
            # Success - store the connection
            self.serial_port = serial_port
            self.connected = True
            self.log(f"Successfully connected to Arduino on {port_name}")
            return True
            
        except (serial.SerialException, OSError) as e:
            self.log(f"Failed to connect to {port_name}: {str(e)}")
            return False

    def auto_connect(self) -> bool:
        """Try to connect to an Arduino by scanning all available ports"""
        if self.connected and self.serial_port and self.serial_port.is_open:
            return True
            
        # List all ports
        ports = self.list_ports()
        
        # First try ports that look like Arduino
        arduino_ports = [p for p in ports if self.is_arduino(p)]
        
        # Try Arduino-like ports first
        for port_info in arduino_ports:
            if self.try_connect(port_info["device"]):
                return True
        
        # If no Arduino-like ports or connection failed, try all other ports
        for port_info in ports:
            if port_info not in arduino_ports:
                if self.try_connect(port_info["device"]):
                    return True
                    
        self.log("No Arduino found on any port")
        return False

    def disconnect(self):
        """Disconnect from the Arduino"""
        if self.serial_port:
            try:
                self.serial_port.close()
            except Exception as e:
                self.log(f"Error while disconnecting: {str(e)}")
        
        self.connected = False
        self.serial_port = None

    def forward_to_http(self, card_number: str) -> bool:
        """Forward card number to HTTP endpoint"""
        if not self.http_endpoint or not REQUESTS_AVAILABLE:
            return False
            
        try:
            payload = {"card_number": card_number, "timestamp": time.time()}
            response = requests.post(
                self.http_endpoint,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=5
            )
            
            if response.status_code == 200:
                self.log(f"Card data sent successfully to {self.http_endpoint}")
                return True
            else:
                self.log(f"HTTP error {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log(f"Error sending data to HTTP endpoint: {str(e)}")
            return False

    def read_and_process(self):
        """Read data from Arduino and process it"""
        if not self.connected or not self.serial_port or not self.serial_port.is_open:
            return False
            
        try:
            # Read a line from the serial port
            line = self.serial_port.readline().decode('utf-8', errors='ignore').strip()
            
            if not line:
                return False
                
            self.log(f"Received data: {line}")
            
            # Check if it's a valid card number (10 digits)
            if line.isdigit() and len(line) == 10:
                print(f"RFID Card detected: {line}")
                
                # Forward to HTTP if endpoint configured
                if self.http_endpoint:
                    self.forward_to_http(line)
                    
                return True
                
        except (serial.SerialException, OSError) as e:
            self.log(f"Error reading from serial port: {str(e)}")
            self.disconnect()
            return False
            
        return False

    def run_forever(self):
        """Main loop to continuously scan for and read from Arduino"""
        try:
            print("Starting Arduino Auto-Detector for SmartBite RFID System")
            print("Press Ctrl+C to exit")
            
            while True:
                # Try to connect if not connected
                if not self.connected:
                    self.auto_connect()
                
                # If connected, read and process data
                if self.connected:
                    self.read_and_process()
                else:
                    # Wait before retrying connection
                    time.sleep(2)
                    
                # Periodically rescan ports if not connected
                if not self.connected and (time.time() - self.last_scan_time) > 10:
                    self.list_ports()
                    
        except KeyboardInterrupt:
            print("\nExiting...")
        finally:
            self.disconnect()


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="Arduino Auto-Detector for SmartBite RFID System")
    parser.add_argument("--http-endpoint", help="URL to forward card data (e.g., http://localhost:8080/card)")
    parser.add_argument("--baud-rate", type=int, default=9600, help="Baud rate for serial connection")
    parser.add_argument("--debug", action="store_true", help="Enable debug logging")
    
    args = parser.parse_args()
    
    if args.http_endpoint and not REQUESTS_AVAILABLE:
        print("Warning: HTTP forwarding requested but requests package not installed.")
        print("Install it using: pip install requests")
        
    detector = ArduinoDetector(
        baud_rate=args.baud_rate,
        http_endpoint=args.http_endpoint,
        debug=args.debug
    )
    
    detector.run_forever()


if __name__ == "__main__":
    main()