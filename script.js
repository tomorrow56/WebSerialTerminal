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
  const formatAscii = document.getElementById('formatAscii');
  const showTimestampCheckbox = document.getElementById('showTimestampCheckbox');
  const autoScrollCheckbox = document.getElementById('autoScrollCheckbox');
  const langJa = document.getElementById('lang-ja');
  const langEn = document.getElementById('lang-en');

  // --- State & Translation Data ---
  let currentLang = 'ja';
  const translations = {
    ja: {
      mainTitle: "Webシリアルターミナル",
      connect: "接続",
      disconnect: "切断",
      clearLog: "ログをクリア",
      saveLog: "ログを保存",
      baudRateLabel: "ボーレート",
      dataBitsLabel: "データビット",
      stopBitsLabel: "ストップビット",
      parityLabel: "パリティ",
      autoReconnectLabel: "自動で再接続",
      showTimestampLabel: "タイムスタンプ表示",
      autoScrollLabel: "自動スクロール",
      sendLabel: "送信",
      receiveLabel: "受信",
      displayFormatLabel: "表示形式",
      asciiLabel: "ASCII",
      hexLabel: "HEX",
      sendInputPlaceholder: "送信するテキストを入力...",
      sendButtonLabel: "送信",
      statusLabel: "ステータス",
      statusConnected: "接続済み",
      statusDisconnected: "切断",
      statusConnecting: "接続中...",
      statusError: "エラー"
    },
    en: {
      mainTitle: "Web Serial Terminal",
      connect: "Connect",
      disconnect: "Disconnect",
      clearLog: "Clear Log",
      saveLog: "Save Log",
      baudRateLabel: "Baud Rate",
      dataBitsLabel: "Data Bits",
      stopBitsLabel: "Stop Bits",
      parityLabel: "Parity",
      autoReconnectLabel: "Auto Reconnect",
      showTimestampLabel: "Show Timestamp",
      autoScrollLabel: "Auto Scroll",
      sendLabel: "Send",
      receiveLabel: "Receive",
      displayFormatLabel: "Display Format",
      asciiLabel: "ASCII",
      hexLabel: "HEX",
      sendInputPlaceholder: "Enter text to send...",
      sendButtonLabel: "Send",
      statusLabel: "Status",
      statusConnected: "Connected",
      statusDisconnected: "Disconnected",
      statusConnecting: "Connecting...",
      statusError: "Error"
    }
  };
  let port;
  let reader;
  let writer;
  let portInfo; // To store vendorId/productId for reconnect
  let reconnectInterval;
  let isManualDisconnect = false;
  let currentLine = ''; // 現在の行を保持する変数
  let currentLineTimestamp = ''; // 現在の行のタイムスタンプ

  // --- Event Listeners ---
  connectButton.addEventListener('click', connectPort);
  disconnectButton.addEventListener('click', () => {
    isManualDisconnect = true;
    disconnectPort();
  });
  sendButton.addEventListener('click', sendData);
  clearLogButton.addEventListener('click', () => { 
    log.innerHTML = ''; 
    currentLine = '';
    currentLineTimestamp = '';
  });
  saveLogButton.addEventListener('click', saveLog);
  sendInput.addEventListener('keydown', (e) => {
    // e.isComposingがtrueの場合はIME変換中なので、送信しない
    if (e.key === 'Enter' && !e.isComposing && !sendButton.disabled) {
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

  document.querySelectorAll('input[name="language"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      setLanguage(e.target.value);
    });
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
    
    // 未完了の行バッファをクリア
    if (currentLine.trim() !== '') {
        const span = document.createElement('span');
        span.className = 'received';
        span.textContent = `${currentLineTimestamp}${currentLine}`;
        log.appendChild(span);
        log.appendChild(document.createElement('br'));
        if (autoScrollCheckbox.checked) {
            console.log('Auto-scroll enabled for disconnect, scrolling to bottom');
            setTimeout(() => {
                const brElement = log.lastElementChild;
                if (brElement) {
                    brElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
                }
            }, 0);
        } else {
            console.log('Auto-scroll disabled for disconnect');
        }
    }
    currentLine = '';
    currentLineTimestamp = '';
    
    updateUiForDisconnection();

    if (wasConnected && autoReconnectCheckbox.checked && !isManualDisconnect) {
        status.textContent = `${translations[currentLang].statusLabel}: 再接続待機中...`;
        reconnectInterval = setInterval(tryReconnect, 2000);
    }
  }

  async function readLoop() {
    if (!port || !port.readable) return;
    reader = port.readable.getReader();

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
            reader.releaseLock();
            break;
        }
        appendLog(value, 'received');
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

  // --- Language & Initialization ---
  function setLanguage(lang) {
    currentLang = lang;
    document.querySelectorAll('[data-lang-key]').forEach(elem => {
      const key = elem.getAttribute('data-lang-key');
      if (translations[lang][key]) {
        // Handle specific labels that include a colon
        const labelText = translations[lang][key];
        if (['baudRateLabel', 'dataBitsLabel', 'stopBitsLabel', 'parityLabel', 'sendLabel', 'receiveLabel', 'displayFormatLabel'].includes(key)) {
            elem.textContent = `${labelText}:`;
        } else {
            elem.textContent = labelText;
        }
      }
    });
    document.querySelectorAll('[data-lang-key-placeholder]').forEach(elem => {
      const key = elem.getAttribute('data-lang-key-placeholder');
      if (translations[lang][key]) {
        elem.placeholder = translations[lang][key];
      }
    });

    // Update status text separately as it's dynamic
    if (port && port.readable) {
        updateUiForConnection();
    } else {
        updateUiForDisconnection();
    }

    // Update radio button state
    document.getElementById(`lang-${lang}`).checked = true;
    document.title = translations[lang].mainTitle;
  }

  setLanguage('ja'); // Set initial language

  // --- UI & Log Functions ---
  function updateUiForConnection() {
    status.textContent = `${translations[currentLang].statusLabel}: ${translations[currentLang].statusConnected}`;
    connectButton.disabled = true;
    disconnectButton.disabled = false;
    sendButton.disabled = false;
    sendInput.disabled = false;
    setSettingsState(true);
  }

  function updateUiForDisconnection() {
    status.textContent = `${translations[currentLang].statusLabel}: ${translations[currentLang].statusDisconnected}`;
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

  function appendLog(data, type = 'received') {
    if (type === 'sent' || type === 'error') {
        // 送信データやエラーは即時表示
        const span = document.createElement('span');
        span.className = type;
        const timestamp = showTimestampCheckbox.checked ? `[${new Date().toLocaleTimeString()}] ` : '';
        span.textContent = `${timestamp}${data}`;
        log.appendChild(span);
        log.appendChild(document.createElement('br'));
        if (autoScrollCheckbox.checked) {
            console.log('Auto-scroll enabled for sent/error, scrolling to bottom');
            setTimeout(() => {
                const brElement = log.lastElementChild;
                if (brElement) {
                    brElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
                }
            }, 0);
        } else {
            console.log('Auto-scroll disabled for sent/error');
        }
        return;
    }

    // 受信データの処理
    if (type === 'received') {
        let processedText;
        
        if (formatAscii.checked) {
            const decoder = new TextDecoder();
            let text = decoder.decode(data, { stream: true });
            const newlineSetting = receiveNewlineSelect.value;
            if (newlineSetting === 'cr') text = text.replace(/\r/g, '\n');
            else if (newlineSetting === 'crlf') text = text.replace(/\r\n/g, '\n');
            processedText = text;
        } else { // HEX format
            processedText = Array.from(data).map(byte => byte.toString(16).padStart(2, '0').toUpperCase()).join(' ');
            // HEXモードでは送信の区切りで改行
            const span = document.createElement('span');
            span.className = 'received';
            const timestamp = showTimestampCheckbox.checked ? `[${new Date().toLocaleTimeString()}] ` : '';
            span.textContent = `${timestamp}${processedText}`;
            log.appendChild(span);
            log.appendChild(document.createElement('br'));
            if (autoScrollCheckbox.checked) {
                console.log('Auto-scroll enabled for HEX, scrolling to bottom');
                setTimeout(() => {
                    const brElement = log.lastElementChild;
                    if (brElement) {
                        brElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
                    }
                }, 0);
            } else {
                console.log('Auto-scroll disabled for HEX');
            }
            return;
        }

        // ASCIIモードで改行コードを含む場合のみ行を完了
        if (formatAscii.checked && processedText.includes('\n')) {
            const lines = processedText.split('\n');
            
            // 最初の部分を現在の行に追加
            currentLine += lines[0];
            
            // タイムスタンプがまだ設定されていれば設定
            if (!currentLineTimestamp && showTimestampCheckbox.checked) {
                currentLineTimestamp = `[${new Date().toLocaleTimeString()}] `;
            }
            
            // 完了した行を表示
            if (currentLine.trim() !== '') {
                const span = document.createElement('span');
                span.className = 'received';
                span.textContent = `${currentLineTimestamp}${currentLine}`;
                log.appendChild(span);
                log.appendChild(document.createElement('br'));
            }
            
            // 中間の空行を処理
            for (let i = 1; i < lines.length - 1; i++) {
                if (lines[i].trim() !== '') {
                    const span = document.createElement('span');
                    span.className = 'received';
                    const timestamp = showTimestampCheckbox.checked ? `[${new Date().toLocaleTimeString()}] ` : '';
                    span.textContent = `${timestamp}${lines[i]}`;
                    log.appendChild(span);
                    log.appendChild(document.createElement('br'));
                }
            }
            
            // 最後の部分を新しい現在の行として設定
            currentLine = lines[lines.length - 1];
            currentLineTimestamp = '';
            
            if (currentLine.trim() !== '') {
                // 新しい行のタイムスタンプを設定
                if (showTimestampCheckbox.checked) {
                    currentLineTimestamp = `[${new Date().toLocaleTimeString()}] `;
                }
            }
            
            if (autoScrollCheckbox.checked) {
                console.log('Auto-scroll enabled for ASCII newline, scrolling to bottom');
                setTimeout(() => {
                    const brElement = log.lastElementChild;
                    if (brElement) {
                        brElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
                    }
                }, 0);
            } else {
                console.log('Auto-scroll disabled for ASCII newline');
            }
        } else {
            // 改行コードがない場合は現在の行に追加
            currentLine += processedText;
            
            // 最初のデータでタイムスタンプを設定
            if (!currentLineTimestamp && showTimestampCheckbox.checked && currentLine.trim() !== '') {
                currentLineTimestamp = `[${new Date().toLocaleTimeString()}] `;
            }
        }
    }
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
