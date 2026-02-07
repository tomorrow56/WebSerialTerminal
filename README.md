# Web Serial Terminal

This is a feature-rich terminal application that allows you to communicate directly with serial devices from your browser using the Web Serial API.

## Key Features

- **Flexible Connection Settings:**
  - Configure baud rate, data bits, stop bits, and parity.
- **Send/Receive Functionality:**
  - Send and receive text data.
  - Selectable newline characters (None, LF, CR, CRLF) for both sending and receiving.
- **Advanced Log Display:**
  - **Format Switching:** Display incoming data in either ASCII or HEX (hexadecimal) format.
  - **Timestamp Toggle:** Show or hide timestamps for each log entry.
  - Color-coded logs to distinguish between sent (`>>`) and received (`<<`) data.
- **Convenient Utilities:**
  - **Auto-Reconnect:** Automatically attempts to reconnect if the device is unexpectedly disconnected.
    - **Note:** Auto-reconnect may not work properly with devices using CH340 series USB-to-serial converter chips. If disconnection occurs, please click the "Connect" button again to manually reconnect.
  - **Save Log:** Save the current log to a timestamped text file.
  - **Clear Log:** Clear the log display at any time.
- **Input Assistance:**
  - Prevents accidental sending when using an IME (e.g., for Japanese input).

## How to Use

1. **Connect Your Device:** Plug a serial-enabled device (e.g., Arduino, M5Stack) into your computer.
2. **Configure Settings:** Use the top panel to set the correct communication parameters (baud rate, etc.) for your device.
3. **Connect to Port:** Click the "Connect" button and select the appropriate serial port from the browser's pop-up window.
4. **Send and Receive Data:**
   - **Receiving:** Data from the device will automatically appear in the log.
   - **Sending:** Type text into the input box at the bottom and click "Send" or press Enter to transmit the data.
5. **Change Settings on the Fly:** Adjust log display format or timestamp visibility in real-time as needed.

## 📁 Project Structure

- `index.html`: The main HTML file for the user interface.
- `style.css`: CSS for styling the terminal interface.
- `script.js`: JavaScript code that handles the Web Serial API logic and UI interactions.
- `LICENSE`: The project's license file.
- `README.md`: This file.

## 🚀 Getting Started

1.  Open `index.html` in a compatible web browser (e.g., Google Chrome, Microsoft Edge).
2.  Click the "Connect" button.
3.  Select the desired serial port from the list.
4.  Start sending and receiving data.

## 📝 License

This project is licensed under the terms of the LICENSE file.