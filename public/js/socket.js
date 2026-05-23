// socket.js - WebSocket client wrapper
class GameSocket {
  constructor() {
    this.ws = null;
    this.handlers = {};
    this.reconnectAttempts = 0;
    this.maxReconnect = 5;
  }

  connect() {
    return new Promise((resolve, reject) => {
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      this.ws = new WebSocket(`${protocol}//${location.host}`);
      this.ws.onopen = () => { this.reconnectAttempts = 0; resolve(); };
      this.ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (this.handlers[msg.type]) {
            this.handlers[msg.type].forEach(fn => fn(msg));
          }
          if (this.handlers['*']) {
            this.handlers['*'].forEach(fn => fn(msg));
          }
        } catch (err) { console.error('Message parse error:', err); }
      };
      this.ws.onerror = (e) => { console.error('WS error:', e); reject(e); };
      this.ws.onclose = () => {
        if (this.reconnectAttempts < this.maxReconnect) {
          this.reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
          setTimeout(() => this.connect(), delay);
        }
      };
    });
  }

  on(type, fn) {
    if (!this.handlers[type]) this.handlers[type] = [];
    this.handlers[type].push(fn);
  }

  send(type, data = {}) {
    if (this.ws && this.ws.readyState === 1) {
      this.ws.send(JSON.stringify({ type, ...data }));
    }
  }
}
