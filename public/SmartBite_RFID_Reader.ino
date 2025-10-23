/***********************************
 * SmartBite RFID Card Reader
 * 
 * This sketch reads RFID cards using an RC522 module
 * and outputs the card ID in a 10-digit format
 * compatible with the SmartBite system.
 * 
 * Connections:
 * RC522      Arduino Uno
 * -----------------------------
 * SDA (SS) - Pin 10
 * SCK      - Pin 13
 * MOSI     - Pin 11
 * MISO     - Pin 12
 * IRQ      - Not connected
 * GND      - GND
 * RST      - Pin 9
 * 3.3V     - 3.3V
 ***********************************/

#include <SPI.h>
#include <MFRC522.h>

// Pin configuration for Arduino Uno
#define SS_PIN 10   // SDA/SS is connected to pin 10
#define RST_PIN 9   // RST is connected to pin 9
#define BUZZER_PIN 8 // Buzzer for audio feedback

// Create MFRC522 instance
MFRC522 mfrc522(SS_PIN, RST_PIN);

void setup() {
  // Initialize serial communication
  Serial.begin(9600);
  // Note: Arduino Uno doesn't need to wait for Serial
  
  // Initialize SPI bus
  SPI.begin();
  
  // Initialize MFRC522
  mfrc522.PCD_Init();
  
  // Set up buzzer pin
  pinMode(BUZZER_PIN, OUTPUT);
  
  // Quick startup feedback beep
  tone(BUZZER_PIN, 1000, 100);
  delay(100);
  
  // Print firmware version and check if we can communicate with the MFRC522
  byte v = mfrc522.PCD_ReadRegister(mfrc522.VersionReg);
  Serial.print("MFRC522 Firmware Version: 0x");
  Serial.println(v, HEX);
  
  // If version is 0x00 or 0xFF, there's likely a connection problem
  if (v == 0x00 || v == 0xFF) {
    Serial.println("WARNING: Communication failure, check wiring!");
  }
  
  Serial.println("===============================");
  Serial.println("Arduino Uno RFID RC522 Test");
  Serial.println("===============================");
  Serial.println("1. Place a card near the reader");
  Serial.println("2. Card details will appear here");
  Serial.println("3. No output? Check connections");
  Serial.println("===============================");
  Serial.println("Waiting for RFID card...");
}

void loop() {
  // Look for new cards
  if (!mfrc522.PICC_IsNewCardPresent()) {
    // No card present (normal state when waiting)
    delay(100);
    return;
  }

  // Select one of the cards
  if (!mfrc522.PICC_ReadCardSerial()) {
    // Card detected but could not read serial
    Serial.println("ERROR: Card detected but failed to read");
    delay(100);
    return;
  }
  
  
  // For 13.56MHz cards, use reliable conversion for SmartBite system
  
  // Convert RFID UID to a consistent 10-digit card number using the reversed bytes method
  // This ensures it will always work with the card registration system
  unsigned long cardDecimal = 0;
  
  // Use reversed bytes method only (reading the UID bytes in reverse order)
  // This is now the preferred method for this system
  for (int i = mfrc522.uid.size - 1; i >= 0; i--) {
    cardDecimal = cardDecimal * 256 + mfrc522.uid.uidByte[i];
  }
  
  // Convert to string and ensure exactly 10 digits
  String cardNumber = String(cardDecimal);
  
  // Pad with leading zeros if needed
  while (cardNumber.length() < 10) {
    cardNumber = "0" + cardNumber;
  }
  
  // Truncate to exactly 10 digits if longer
  if (cardNumber.length() > 10) {
    cardNumber = cardNumber.substring(cardNumber.length() - 10);
  }
  
  // Send card number in format expected by SmartBite registration system
  // Format: just the 10 digits with no other text/prefix for easy parsing
  Serial.println(cardNumber);
  
  // Provide audio feedback that card was successfully read
  tone(BUZZER_PIN, 2000, 200); // Higher pitch beep
  delay(200);
  tone(BUZZER_PIN, 3000, 100); // Second beep
  delay(100);
  
  // Halt PICC and stop encryption
  mfrc522.PICC_HaltA();
  mfrc522.PCD_StopCrypto1();
  
  // Short delay before next read
  delay(700); // Adjusted to keep total delay around 1 second
}