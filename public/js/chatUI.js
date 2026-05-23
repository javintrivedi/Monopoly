// chatUI.js - Chat panel
class ChatUI {
  constructor(socket) {
    this.socket = socket;
    this.messagesEl = document.getElementById('chatMessages');
    this.inputEl = document.getElementById('chatInput');

    document.getElementById('chatSendBtn').addEventListener('click', () => this.sendMessage());
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.sendMessage();
    });
  }

  sendMessage() {
    const text = this.inputEl.value.trim();
    if (!text) return;
    this.socket.send('chat', { message: text });
    this.inputEl.value = '';
    // Also show locally
    this.addMessage('You', text, 'var(--accent-gold)');
  }

  addMessage(name, text, color) {
    const el = document.createElement('div');
    el.className = 'chat-message';
    el.innerHTML = `<span class="chat-name" style="color:${color || 'var(--accent-purple)'}">${name}:</span>${this.escapeHtml(text)}`;
    this.messagesEl.appendChild(el);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  addSystemMessage(text) {
    const el = document.createElement('div');
    el.className = 'chat-message system';
    el.textContent = text;
    this.messagesEl.appendChild(el);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
