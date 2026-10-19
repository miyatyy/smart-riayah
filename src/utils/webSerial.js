// Web Serial API Manager for ESP32-S3 + RC522 RFID Reader
// Compatible with Chrome, Edge, and modern Chromium browsers

class WebSerialManager {
  constructor() {
    this.port = null;
    this.reader = null;
    this.writer = null;
    this.readableStreamClosed = null;
    this.writableStreamClosed = null;
    this.keepReading = false;
    this.listeners = new Set();
    this.rawLogListeners = new Set();
    this.isConnected = false;
    this.lineBuffer = '';
    this.lastScannedUid = null;
    this.lastScanTimestamp = 0;
  }

  isSupported() {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  addRawLogListener(callback) {
    this.rawLogListeners.add(callback);
    return () => this.rawLogListeners.delete(callback);
  }

  notifyListeners(event, data) {
    this.listeners.forEach(cb => {
      try {
        cb(event, data);
      } catch (err) {
        console.error('Error in serial listener:', err);
      }
    });
  }

  notifyRawLog(type, text) {
    this.rawLogListeners.forEach(cb => {
      try {
        cb({ type, text, timestamp: new Date() });
      } catch (err) {
        console.error('Error in raw log listener:', err);
      }
    });
  }

  async autoConnect(baudRate = 115200) {
    if (!this.isSupported() || this.isConnected) return false;
    try {
      const ports = await navigator.serial.getPorts();
      if (ports && ports.length > 0) {
        this.port = ports[0];
        await this.port.open({ baudRate });
        this.isConnected = true;
        this.keepReading = true;
        this.notifyListeners('CONNECT', { baudRate, isAuto: true });
        this.notifyRawLog('SYSTEM', `Serial port terhubung kembali otomatis pada ${baudRate} baud.`);
        this.startReading();
        return true;
      }
    } catch (err) {
      console.warn('Auto-reconnect serial skipped:', err);
    }
    return false;
  }

  async connect(baudRate = 115200) {
    if (!this.isSupported()) {
      throw new Error('Web Serial API tidak didukung di browser ini. Harap gunakan Google Chrome atau Microsoft Edge terbaru.');
    }

    // Always clean up any existing open reader/port first
    if (this.port || this.isConnected) {
      await this.disconnect();
    }

    let selectedPort = null;
    try {
      selectedPort = await navigator.serial.requestPort();
    } catch (err) {
      if (err.name === 'NotFoundError') {
        return false; // User cancelled the picker dialog
      }
      throw err;
    }

    if (!selectedPort) return false;
    this.port = selectedPort;

    try {
      await this.port.open({ baudRate });
      this.isConnected = true;
      this.keepReading = true;
      this.notifyListeners('CONNECT', { baudRate });
      this.notifyRawLog('SYSTEM', `Serial port terhubung pada ${baudRate} baud.`);

      this.startReading();
      return true;
    } catch (err) {
      this.isConnected = false;
      this.keepReading = false;
      try {
        await this.port.close();
      } catch {}
      this.port = null;

      let msg = err.message;
      if (msg && msg.toLowerCase().includes('failed to open serial port')) {
        msg = 'Port USB sedang dikunci oleh tab Smart Riayah lainnya atau Serial Monitor Arduino. Harap tutup tab Smart Riayah lainnya di browser Anda (atau tutup Arduino IDE Serial Monitor), lalu klik Hubungkan Alat kembali.';
      }
      this.notifyListeners('ERROR', msg);
      this.notifyRawLog('ERROR', `Gagal menghubungkan serial port: ${msg}`);
      throw new Error(msg);
    }
  }

  async startReading() {
    while (this.port && this.port.readable && this.keepReading) {
      try {
        const textDecoder = new TextDecoderStream();
        this.readableStreamClosed = this.port.readable.pipeTo(textDecoder.writable);
        this.reader = textDecoder.readable.getReader();

        while (true) {
          const { value, done } = await this.reader.read();
          if (done) {
            break;
          }
          if (value) {
            this.handleIncomingChunk(value);
          }
        }
      } catch (err) {
        if (this.keepReading) {
          console.warn('Serial read error:', err);
          this.notifyRawLog('ERROR', `Read error: ${err.message}`);
        }
        break;
      }
    }
  }

  handleIncomingChunk(chunk) {
    this.lineBuffer += chunk;

    // Direct check if lineBuffer already contains a valid 4-to-10 byte UID even without waiting for newline
    const normalizedBuffer = this.lineBuffer.replace(/0x([0-9A-Fa-f]{2})/gi, '$1');
    const directHexMatch = normalizedBuffer.match(/([0-9A-Fa-f]{2}[:\s,-][0-9A-Fa-f]{2}[:\s,-][0-9A-Fa-f]{2}[:\s,-][0-9A-Fa-f]{2}(?:[:\s,-][0-9A-Fa-f]{2})*)/i);
    if (directHexMatch && directHexMatch[1]) {
      const cleanUid = directHexMatch[1].replace(/[\s,-]/g, ':').replace(/:+/g, ':').toUpperCase();
      this.notifyRawLog('RX', `[STREAM] ${cleanUid}`);
      this.parseSerialLine(cleanUid);
      this.lineBuffer = '';
      return;
    }

    const lines = this.lineBuffer.split(/\r?\n/);
    this.lineBuffer = lines.pop() || ''; // Keep incomplete line in buffer

    if (this.lineBuffer.length > 256) {
      this.lineBuffer = '';
    }

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      this.notifyRawLog('RX', trimmed);
      this.parseSerialLine(trimmed);
    }
  }

  // Parse lines such as "Card UID: 53 57 98 0F" or "UID: 04:A1:2B:9C" or "04 A1 2B 9C" or raw hex
  parseSerialLine(line) {
    // Strip ANSI escape codes
    const cleanLine = line.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').trim();

    // Normalize 0x prefixes if present (e.g. 0x53 0x57 0x98 0x0F)
    const normalizedLine = cleanLine.replace(/0x([0-9A-Fa-f]{2})/gi, '$1');

    // 1. Match 4 to 10 hex bytes separated by spaces, colons, commas, or dashes
    const hexMatch = normalizedLine.match(/([0-9A-Fa-f]{2}[:\s,-][0-9A-Fa-f]{2}[:\s,-][0-9A-Fa-f]{2}[:\s,-][0-9A-Fa-f]{2}(?:[:\s,-][0-9A-Fa-f]{2})*)/i);

    let detectedUid = null;

    if (hexMatch && hexMatch[1]) {
      detectedUid = hexMatch[1].replace(/[\s,-]/g, ':').replace(/:+/g, ':').toUpperCase();
    } else {
      // 2. Direct continuous hex match (e.g. 5357980F or 04A12B9C123456)
      const continuousHexMatch = normalizedLine.match(/\b([0-9A-Fa-f]{8}|[0-9A-Fa-f]{14}|[0-9A-Fa-f]{20})\b/);
      if (continuousHexMatch && continuousHexMatch[1]) {
        detectedUid = continuousHexMatch[1].toUpperCase().match(/.{1,2}/g).join(':');
      }
    }

    if (detectedUid) {
      // Smart debounce: prevent sensor flood of the exact same UID within 800ms
      const now = Date.now();
      if (this.lastScannedUid === detectedUid && (now - this.lastScanTimestamp < 800)) {
        return;
      }
      this.lastScannedUid = detectedUid;
      this.lastScanTimestamp = now;

      this.notifyListeners('RFID_TAG', { uid: detectedUid, raw: cleanLine });
      return;
    }

    // 3. Fallback generic command/info
    this.notifyListeners('LINE', { text: cleanLine });
  }

  async sendCommand(command) {
    const textToSend = command.endsWith('\n') ? command : command + '\n';
    this.notifyRawLog('TX', textToSend.trim());

    if (!this.port || !this.port.writable) {
      // If no hardware is plugged in, we still log TX for virtual hardware test!
      this.notifyListeners('TX_SIMULATED', textToSend.trim());
      return false;
    }

    try {
      const textEncoder = new TextEncoder();
      const writer = this.port.writable.getWriter();
      await writer.write(textEncoder.encode(textToSend));
      writer.releaseLock();
      return true;
    } catch (err) {
      console.error('Failed to send serial command:', err);
      this.notifyRawLog('ERROR', `Gagal kirim: ${err.message}`);
      return false;
    }
  }

  // Simulate an incoming RFID scan from UI button
  simulateScan(uid) {
    const formatted = uid.toUpperCase();
    this.notifyRawLog('RX', `[SIMULASI BREADBOARD] UID: ${formatted}`);
    this.notifyListeners('RFID_TAG', { uid: formatted, raw: `UID: ${formatted}`, isSimulated: true });
  }

  async disconnect() {
    this.keepReading = false;
    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch {}
      this.reader = null;
    }
    if (this.readableStreamClosed) {
      try {
        await this.readableStreamClosed;
      } catch {}
      this.readableStreamClosed = null;
    }
    if (this.port) {
      try {
        await this.port.close();
      } catch {}
      this.port = null;
    }
    this.isConnected = false;
    this.notifyListeners('DISCONNECT', {});
    this.notifyRawLog('SYSTEM', 'Serial port terputus.');
  }
}

export const webSerial = new WebSerialManager();
