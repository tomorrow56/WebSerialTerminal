document.addEventListener('DOMContentLoaded', () => {
  // --- UI Elements ---
  const connectButton = document.getElementById('connectButton');
  const disconnectButton = document.getElementById('disconnectButton');
  const clearLogButton = document.getElementById('clearLogButton');
  const saveLogButton = document.getElementById('saveLogButton');
  const status = document.getElementById('status');
  const log = document.getElementById('log');
  const sendInput = document.getElementById('sendInput');
  const sendButton = document.getElementById('sendButton');

  // --- Setting Elements ---
  const baudRateSelect = document.getElementById('baudRate');
  const dataBitsSelect = document.getElementById('dataBits');
  const stopBitsSelect = document.getElementById('stopBits');
  const paritySelect = document.getElementById('parity');
  const sendNewlineSelect = document.getElementById('sendNewline');
  const receiveNewlineSelect = document.getElementById('receiveNewline');
  const autoReconnectCheckbox = document.getElementById('autoReconnectCheckbox');

  // --- State Variables ---
  let port;
  let reader;
  let writer;
  let portInfo; // To store vendorId/productId for reconnect
  let reconnectInterval;
  let isManualDisconnect = false;

  // --- Event Listeners ---
  connectButton.addEventListener('click', connectPort);
  disconnectButton.addEventListener('click', () => {
    isManualDisconnect = true;
    disconnectPort();
  });
  sendButton.addEventListener('click', sendData);
  clearLogButton.addEventListener('click', () => { log.innerHTML = ''; });
  saveLogButton.addEventListener('click', saveLog);
  sendInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !sendButton.disabled) {
      sendData();
    }
  });

  navigator.serial.addEventListener('disconnect', (e) => {
    if (port && e.target === port) {
        console.log('Device disconnected unexpectedly.');
        isManualDisconnect = false;
        disconnectPort();
    }
  });

  // --- Core Functions ---
  async function connectPort() {
    try {
      port = await navigator.serial.requestPort();
      portInfo = port.getInfo();
      const options = {
        baudRate: parseInt(baudRateSelect.value),
        dataBits: parseInt(dataBitsSelect.value),
        stopBits: parseInt(stopBitsSelect.value),
        parity: paritySelect.value,
      };
      await port.open(options);
      isManualDisconnect = false;
      updateUiForConnection();
      readLoop();
    } catch (error) {
      console.error('Connection error:', error);
      status.textContent = `エラー: ${error.message}`;
    }
  }

  async function disconnectPort() {
    if (reconnectInterval) {
        clearInterval(reconnectInterval);
        reconnectInterval = null;
    }
    if (!port) return;

    const wasConnected = !!port;

    try {
      if (reader) {
        await reader.cancel();
        reader = null;
      }
      if (writer) {
        writer = null;
      }
      await port.close();
    } catch (error) {
      console.error('Disconnection error:', error);
    }
    
    port = null;
    updateUiForDisconnection();

    if (wasConnected && autoReconnectCheckbox.checked && !isManualDisconnect) {
        status.textContent = 'ステータス: 再接続待機中...';
        reconnectInterval = setInterval(tryReconnect, 2000);
    }
  }

  async function readLoop() {
    if (!port || !port.readable) return;
    reader = port.readable.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
            reader.releaseLock();
            break;
        }
        appendLog(decoder.decode(value, { stream: true }), 'received');
      }
    } catch (error) {
        if (!isManualDisconnect) {
            console.error('Read error:', error);
            appendLog(`[ERROR] Read error: ${error.message}`, 'error');
        }
    }
  }

  async function sendData() {
    if (!port || !port.writable) return;
    let textToSend = sendInput.value;
    if (!textToSend) return;

    const newline = sendNewlineSelect.value;
    let textWithNewline = textToSend;
    if (newline === 'lf') textWithNewline += '\n';
    else if (newline === 'cr') textWithNewline += '\r';
    else if (newline === 'crlf') textWithNewline += '\r\n';

    try {
      writer = port.writable.getWriter();
      await writer.write(new TextEncoder().encode(textWithNewline));
      writer.releaseLock();
      appendLog(textToSend, 'sent');
      sendInput.value = '';
    } catch (error) {
      console.error('Write error:', error);
      appendLog(`[ERROR] Write error: ${error.message}`, 'error');
      if (writer) writer.releaseLock();
    }
  }

  async function tryReconnect() {
    if (!portInfo) return;

    try {
        const availablePorts = await navigator.serial.getPorts();
        const targetPort = availablePorts.find(p => {
            const info = p.getInfo();
            return info.usbVendorId === portInfo.usbVendorId && info.usbProductId === portInfo.usbProductId;
        });

        if (targetPort) {
            console.log('Device found, attempting to reconnect...');
            clearInterval(reconnectInterval);
            reconnectInterval = null;
            port = targetPort;
            const options = {
                baudRate: parseInt(baudRateSelect.value),
                dataBits: parseInt(dataBitsSelect.value),
                stopBits: parseInt(stopBitsSelect.value),
                parity: paritySelect.value,
            };
            await port.open(options);
            isManualDisconnect = false;
            updateUiForConnection();
            readLoop();
        }
    } catch (error) {
        console.error('Reconnect attempt failed:', error);
    }
  }

  // --- UI & Log Functions ---
  function updateUiForConnection() {
    status.textContent = 'ステータス: 接続中';
    connectButton.disabled = true;
    disconnectButton.disabled = false;
    sendButton.disabled = false;
    sendInput.disabled = false;
    setSettingsState(true);
    if (reconnectInterval) {
        clearInterval(reconnectInterval);
        reconnectInterval = null;
    }
  }

  function updateUiForDisconnection() {
    status.textContent = 'ステータス: 切断';
    connectButton.disabled = false;
    disconnectButton.disabled = true;
    sendButton.disabled = true;
    sendInput.disabled = true;
    setSettingsState(false);
  }

  function setSettingsState(disabled) {
    baudRateSelect.disabled = disabled;
    dataBitsSelect.disabled = disabled;
    stopBitsSelect.disabled = disabled;
    paritySelect.disabled = disabled;
  }

  function appendLog(text, type = 'received') {
    const span = document.createElement('span');
    span.className = type;

    const timestamp = new Date().toLocaleTimeString();
    const prefix = type === 'sent' ? '>> ' : '<< ';
    
    let processedText = text;
    if (type === 'received') {
        const newlineSetting = receiveNewlineSelect.value;
        if (newlineSetting === 'cr') processedText = text.replace(/\r/g, '\n');
        else if (newlineSetting === 'crlf') processedText = text.replace(/\r\n/g, '\n');
    }

    span.textContent = `[${timestamp}] ${prefix}${processedText}`;
    
    log.appendChild(span);
    log.appendChild(document.createElement('br'));
    log.scrollTop = log.scrollHeight;
  }

  function saveLog() {
    const blob = new Blob([log.innerText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const timestamp = new Date().toISOString().replace(/[:.-]/g, '').slice(0, 14);
    a.download = `serial_log_${timestamp}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
});
