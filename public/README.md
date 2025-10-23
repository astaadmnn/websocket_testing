# SmartBite Arduino Auto-Detection System

This system automatically connects to Arduino devices with RFID readers for use with the SmartBite application. The system includes multiple ways to connect to Arduino devices:

1. Web-based detection (JavaScript - browser)
2. Node.js bridge server
3. Python detection script
4. PowerShell detection script

## Arduino Setup

1. Upload the provided Arduino sketch to your Arduino Uno
2. Connect the RFID RC522 module to your Arduino:

   | RC522 Pin | Arduino Uno Pin |
   |-----------|-----------------|
   | SDA (SS)  | 10              |
   | SCK       | 13              |
   | MOSI      | 11              |
   | MISO      | 12              |
   | IRQ       | Not connected   |
   | GND       | GND             |
   | RST       | 9               |
   | 3.3V      | 3.3V            |

## Option 1: Web Browser Detection (No Installation Required)

The web detection script is integrated directly into the SmartBite web application and uses the Web Serial API.

1. Open the SmartBite app in Chrome or Edge browser (Web Serial API required)
2. On the Register Card page, click "Connect Arduino"
3. Select the Arduino port from the dropdown list
4. The indicator will turn green when connected

**Note**: Web Serial API only works in secure contexts (HTTPS) or localhost.

## Option 2: Node.js Bridge (Server-based)

For server-based detection or when Web Serial API is not available:

1. Navigate to the `arduino` folder
2. Install dependencies:
   ```
   npm install
   ```
3. Start the bridge:
   ```
   npm start
   ```

   Or with auto-detection:
   ```
   npm run start:auto
   ```

4. Open the provided URL in your browser to monitor card events
5. The bridge will automatically forward card data to the browser via WebSockets

## Option 3: Python Script (Cross-platform)

For standalone detection or integration with other systems:

1. Install Python 3.6 or higher
2. Install required packages:
   ```
   pip install pyserial requests
   ```
3. Run the script:
   ```
   python arduino_detector.py --debug
   ```

   With HTTP forwarding:
   ```
   python arduino_detector.py --http-endpoint http://localhost:8080/api/card
   ```

## Option 4: PowerShell Script (Windows Only)

For quick detection on Windows systems:

1. Open PowerShell
2. Navigate to the `arduino` folder
3. Run:
   ```powershell
   .\arduino_detector.ps1
   ```

   Or with auto-detection:
   ```powershell
   .\arduino_detector.ps1 -AutoConnect
   ```

   To list available ports:
   ```powershell
   .\arduino_detector.ps1 -ListOnly
   ```

## Troubleshooting

1. **Arduino Not Detected**
   - Make sure the Arduino is properly connected to the computer
   - Try a different USB cable
   - Check if the Arduino appears in Device Manager (Windows) or with `lsusb` (Linux)
   - Install/reinstall Arduino drivers

2. **Permission Denied**
   - On Linux: Add user to the `dialout` group: `sudo usermod -a -G dialout $USER`
   - On Windows: Run scripts with administrator privileges
   - On macOS: Allow access to the serial device in System Preferences

3. **RFID Card Not Reading**
   - Check the wiring between Arduino and RFID module
   - Make sure the RFID card is compatible (13.56MHz)
   - Try placing the card directly on the reader
   - Ensure the correct Arduino sketch is uploaded

4. **Communication Errors**
   - Verify the baud rate matches (default: 9600)
   - Try resetting the Arduino (press reset button)
   - Check for any interference or loose connections

5. **Browser Detection Not Working**
   - Ensure you're using Chrome or Edge (Web Serial API required)
   - Running locally or via HTTPS is required for Web Serial API
   - Try disconnecting and reconnecting the Arduino

## Arduino Sketch

The Arduino sketch (provided separately) reads RFID cards and outputs the card number in a 10-digit format compatible with the SmartBite system.

Key features:
- Automatic RFID card detection
- Conversion of RFID UID to 10-digit number format
- Serial output at 9600 baud
- Status messages for debugging