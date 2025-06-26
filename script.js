document.addEventListener('DOMContentLoaded', () => {
    const connectButton = document.getElementById('connectButton');
    const disconnectButton = document.getElementById('disconnectButton');
    const saveLogButton = document.getElementById('saveLogButton');
    const clearLogButton = document.getElementById('clearLogButton');
    const statusDisplay = document.getElementById('status');
    const terminalContainer = document.getElementById('terminal');
    const sendButton = document.getElementById('sendButton');
    const inputField = document.getElementById('inputField');
    const baudRateSelector = document.getElementById('baudRate');

    let port;
    let reader;
    let keepReading = false;
    let reconnectionIntervalId = null;

    const textEncoder = new TextEncoder();
    const textDecoder = new TextDecoder();

    // 接続ボタンのクリックイベント
    connectButton.addEventListener('click', async () => {
        if ('serial' in navigator) {
            try {
                port = await navigator.serial.requestPort();
                const selectedBaudRate = parseInt(baudRateSelector.value, 10);
                await port.open({ baudRate: selectedBaudRate });

                // 接続に成功したら、再接続ループを停止
                if (reconnectionIntervalId) {
                    clearInterval(reconnectionIntervalId);
                    reconnectionIntervalId = null;
                }

                keepReading = true;
                updateUIForConnection();
                readLoop();
            } catch (err) {
                statusDisplay.textContent = `エラー: ${err.message}`;
            }
        } else {
            alert('お使いのブラウザは Web Serial API をサポートしていません。');
        }
    });

    // 切断ボタンのクリックイベント
    disconnectButton.addEventListener('click', async () => {
        // 再接続中であれば、ループを停止する
        if (reconnectionIntervalId) {
            clearInterval(reconnectionIntervalId);
            reconnectionIntervalId = null;
        }
        await handleDisconnection();
    });

    // ログ保存ボタンのクリックイベント
    saveLogButton.addEventListener('click', () => {
        const logText = terminalContainer.textContent;
        const blob = new Blob([logText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'serial-log.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    // ログクリアボタンのクリックイベント
    clearLogButton.addEventListener('click', () => {
        terminalContainer.textContent = '';
    });

    // 送信ボタンのクリックイベント
    sendButton.addEventListener('click', async () => {
        const text = inputField.value;
        if (!port || !text) {
            return;
        }

        let localWriter;
        try {
            localWriter = port.writable.getWriter();
            await localWriter.write(textEncoder.encode(text + '\n'));
            inputField.value = '';
        } catch (err) {
            console.error('送信エラー:', err);
            statusDisplay.textContent = `エラー: ${err.message}`;
        } finally {
            if (localWriter) {
                localWriter.releaseLock();
            }
        }
    });

    // Enterキーで送信
    inputField.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            sendButton.click();
        }
    });

    // データ読み取りループ
    async function readLoop() {
        while (port && port.readable && keepReading) {
            reader = port.readable.getReader();
            try {
                while (true) {
                    const { value, done } = await reader.read();
                    if (done) {
                        reader.releaseLock();
                        break;
                    }
                    const text = textDecoder.decode(value, { stream: true });
                    appendToTerminal(text);
                }
            } catch (err) {
                console.error('読み取りエラー:', err);
                if (err.message.includes('The device has been lost.')) {
                    appendToTerminal(`\n--- エラー: デバイスが切断されました。再接続を試みます... ---\n`);
                    await startReconnectionProcess();
                } else {
                    appendToTerminal(`\n--- エラー: ${err.message} ---\n`);
                    await handleDisconnection();
                }
            }
        }
    }

    // 切断処理
    async function handleDisconnection() {
        keepReading = false;
        if (reader) {
            try { await reader.cancel(); } catch (e) { /* ignore */ } 
        }
        if (port) {
            try { await port.close(); } catch (e) { /* ignore */ } 
        }
        port = null;
        reader = null;
        updateUIForDisconnection();
    }

    // 再接続プロセスの開始
    async function startReconnectionProcess() {
        keepReading = false;
        if (reader) {
            try { await reader.cancel(); } catch (e) { /* ignore */ } 
        }
        if (port) {
            try { await port.close(); } catch (e) { /* ignore */ } 
        }
        port = null;
        reader = null;

        updateUIForReconnecting();
        reconnectionIntervalId = setInterval(tryReconnect, 2000);
    }

    // 再接続の試行
    async function tryReconnect() {
        try {
            const availablePorts = await navigator.serial.getPorts();
            if (availablePorts.length === 0) {
                return; // 許可されたポートがない場合は待機
            }

            port = availablePorts[0]; // 以前許可されたポートを再利用
            const selectedBaudRate = parseInt(baudRateSelector.value, 10);
            await port.open({ baudRate: selectedBaudRate });

            // 再接続成功
            clearInterval(reconnectionIntervalId);
            reconnectionIntervalId = null;

            appendToTerminal(`\n--- 再接続に成功しました ---\n`);
            keepReading = true;
            updateUIForConnection();
            readLoop();
        } catch (err) {
            port = null; // openに失敗した場合、次の試行のためにリセット
            console.log('再接続に失敗しました。再試行します...', err);
        }
    }

    // ターミナルにテキストを追加
    function appendToTerminal(text) {
        terminalContainer.textContent += text;
        terminalContainer.scrollTop = terminalContainer.scrollHeight;
    }

    // UIの状態を更新（接続時）
    function updateUIForConnection() {
        statusDisplay.textContent = 'ステータス: 接続中';
        connectButton.disabled = true;
        disconnectButton.disabled = false;
        sendButton.disabled = false;
        inputField.disabled = false;
        baudRateSelector.disabled = true;
    }

    // UIの状態を更新（切断時）
    function updateUIForDisconnection() {
        statusDisplay.textContent = 'ステータス: 切断';
        connectButton.disabled = false;
        disconnectButton.disabled = true;
        sendButton.disabled = true;
        inputField.disabled = true;
        baudRateSelector.disabled = false;
        if (!terminalContainer.textContent.endsWith('接続が切れました ---\n')) {
            appendToTerminal('\n--- 接続が切れました ---\n');
        }
    }

    // UIの状態を更新（再接続中）
    function updateUIForReconnecting() {
        statusDisplay.textContent = 'ステータス: 再接続中...';
        connectButton.disabled = true;
        disconnectButton.disabled = false;
        sendButton.disabled = true;
        inputField.disabled = true;
        baudRateSelector.disabled = true;
    }
});