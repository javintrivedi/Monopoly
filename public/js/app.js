// app.js - Landing page logic
(function() {
  const TOKEN_EMOJIS = { car: '🚗', hat: '🎩', dog: '🐕', ship: '🚢' };
  let selectedToken = 'car';
  let ws = null;
  let isHost = false;
  let myPlayerId = null;

  // Particle effects
  const particlesEl = document.getElementById('particles');
  for (let i = 0; i < 30; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = Math.random() * 100 + '%';
    p.style.top = Math.random() * 100 + '%';
    p.style.setProperty('--duration', (4 + Math.random() * 6) + 's');
    p.style.setProperty('--delay', (Math.random() * 4) + 's');
    p.style.opacity = 0.2 + Math.random() * 0.4;
    particlesEl.appendChild(p);
  }

  // Token selection
  document.querySelectorAll('.token-option').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('.token-option').forEach(e => e.classList.remove('selected'));
      el.classList.add('selected');
      selectedToken = el.dataset.token;
    });
  });

  function showError(msg) {
    const el = document.getElementById('errorMsg');
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(() => el.style.display = 'none', 4000);
  }

  function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  }

  function getWSUrl() {
    const customUrl = localStorage.getItem('monopoly_server_url');
    if (customUrl) return customUrl;
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${location.host}`;
  }

  function showTroubleshootingTip() {
    const troubleBanner = document.getElementById('troubleBanner');
    if (troubleBanner) {
      troubleBanner.style.display = 'block';
    }
  }

  function connectWS() {
    const wsUrl = getWSUrl();
    console.log('🔌 Connecting to WebSocket server:', wsUrl);
    ws = new WebSocket(wsUrl);
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      handleMessage(msg);
    };
    ws.onerror = () => {
      showError('Connection error');
      showTroubleshootingTip();
    };
    ws.onclose = () => {
      showError('Disconnected from server');
      showTroubleshootingTip();
    };
    return new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = (err) => {
        showTroubleshootingTip();
        reject(err);
      };
    });
  }

  function handleMessage(msg) {
    switch (msg.type) {
      case 'roomCreated':
        isHost = true;
        myPlayerId = msg.playerId;
        showWaitingRoom(msg.roomCode, msg.players);
        break;
      case 'roomJoined':
        myPlayerId = msg.playerId;
        showWaitingRoom(msg.roomCode, msg.players);
        break;
      case 'playerJoined':
        updatePlayersList(msg.players);
        showToast('A new player joined!', 'success');
        break;
      case 'gameStarted':
      case 'gameState':
        // Store data and redirect
        sessionStorage.setItem('monopoly_playerId', myPlayerId);
        sessionStorage.setItem('monopoly_isHost', isHost);
        sessionStorage.setItem('monopoly_roomCode', document.getElementById('displayRoomCode').textContent);
        sessionStorage.setItem('monopoly_playerName', document.getElementById('playerName').value.trim());
        sessionStorage.setItem('monopoly_token', selectedToken);
        window.location.href = 'game.html';
        break;
      case 'error':
        showError(msg.message);
        break;
    }
  }

  function showWaitingRoom(code, players) {
    document.getElementById('lobby-form').style.display = 'none';
    document.getElementById('waiting-room').style.display = 'block';
    document.getElementById('displayRoomCode').textContent = code;
    updatePlayersList(players);

    if (isHost) {
      document.getElementById('startBtn').style.display = 'block';
      document.getElementById('waitMsg').style.display = 'none';
    }
  }

  function updatePlayersList(players) {
    const list = document.getElementById('playersList');
    list.innerHTML = '';
    players.forEach((p, i) => {
      const item = document.createElement('div');
      item.className = 'player-item';
      item.innerHTML = `
        <span class="player-item-icon">${TOKEN_EMOJIS[p.token] || '🎮'}</span>
        <span class="player-item-name">${p.name}</span>
        ${i === 0 ? '<span class="player-item-host">Host</span>' : ''}
      `;
      list.appendChild(item);
    });

    // Update start button state
    if (isHost) {
      document.getElementById('startBtn').disabled = players.length < 2;
    }
  }

  // Create room
  document.getElementById('createBtn').addEventListener('click', async () => {
    const name = document.getElementById('playerName').value.trim();
    if (!name) { showError('Please enter your name'); return; }
    await connectWS();
    ws.send(JSON.stringify({ type: 'createRoom', playerName: name, token: selectedToken }));
  });

  // Join room
  document.getElementById('joinBtn').addEventListener('click', async () => {
    const name = document.getElementById('playerName').value.trim();
    const code = document.getElementById('roomCode').value.trim().toUpperCase();
    if (!name) { showError('Please enter your name'); return; }
    if (!code || code.length < 4) { showError('Please enter a valid room code'); return; }
    await connectWS();
    ws.send(JSON.stringify({ type: 'joinRoom', roomCode: code, playerName: name, token: selectedToken }));
  });

  // Start game
  document.getElementById('startBtn').addEventListener('click', () => {
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({ type: 'startGame' }));
    }
  });

  // Enter key on room code
  document.getElementById('roomCode').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('joinBtn').click();
  });
  document.getElementById('playerName').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('createBtn').click();
  });

  // Settings modal controls
  const settingsModal = document.getElementById('settingsModal');
  const serverUrlInput = document.getElementById('serverUrlInput');
  const openSettingsBtn = document.getElementById('openSettingsBtn');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const setupServerBtn = document.getElementById('setupServerBtn');

  function openSettings() {
    serverUrlInput.value = localStorage.getItem('monopoly_server_url') || '';
    settingsModal.style.display = 'flex';
  }

  function closeSettings() {
    settingsModal.style.display = 'none';
  }

  openSettingsBtn.addEventListener('click', openSettings);
  closeSettingsBtn.addEventListener('click', closeSettings);
  if (setupServerBtn) {
    setupServerBtn.addEventListener('click', openSettings);
  }

  saveSettingsBtn.addEventListener('click', () => {
    let url = serverUrlInput.value.trim();
    if (url) {
      // Basic validation and protocol correction
      if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
        if (url.startsWith('https://')) {
          url = url.replace('https://', 'wss://');
        } else if (url.startsWith('http://')) {
          url = url.replace('http://', 'ws://');
        } else {
          const isIp = /^[0-9.]+$/.test(url.split(':')[0]);
          const protocol = (isIp || url.includes('localhost')) ? 'ws://' : 'wss://';
          url = protocol + url;
        }
      }
      localStorage.setItem('monopoly_server_url', url);
      showToast('Configuration saved successfully!', 'success');
      const troubleBanner = document.getElementById('troubleBanner');
      if (troubleBanner) troubleBanner.style.display = 'none';
    } else {
      localStorage.removeItem('monopoly_server_url');
      showToast('Reset to default local server configuration', 'info');
    }
    closeSettings();
  });

  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) closeSettings();
  });
})();
