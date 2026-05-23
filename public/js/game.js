// game.js - Main game controller
class GameController {
  constructor() {
    this.socket = new GameSocket();
    this.board = new BoardRenderer(document.getElementById('board'));
    this.dice = new DiceRenderer();
    this.ui = new UIManager();
    this.trade = null;
    this.chat = null;
    this.myPlayerId = sessionStorage.getItem('monopoly_playerId');
    this.state = null;

    // Audio setup
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    this.bgMusic = new Audio('assets/sounds/bg-music.mp3');
    this.bgMusic.loop = true;
    this.bgMusic.volume = 0.3; // Light background music
    this.musicStarted = false;
    
    // Audio settings
    this.soundEnabled = true;
    this.musicEnabled = true;

    this.init();
  }

  toggleMusic() {
    this.musicEnabled = !this.musicEnabled;
    const btn = document.getElementById('toggleMusicBtn');
    if (this.musicEnabled) {
      btn.classList.remove('disabled');
      if (this.musicStarted) this.bgMusic.play().catch(e => console.log('Audio autoplay prevented:', e));
    } else {
      btn.classList.add('disabled');
      this.bgMusic.pause();
    }
  }

  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    const btn = document.getElementById('toggleSoundBtn');
    if (this.soundEnabled) {
      btn.classList.remove('disabled');
    } else {
      btn.classList.add('disabled');
    }
  }

  playDiceSound() {
    if (!this.soundEnabled) return;
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
    // Synthesize a rattling dice sound using short noise bursts
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(150 + Math.random() * 500, this.audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, this.audioCtx.currentTime + 0.1);
        
        gain.gain.setValueAtTime(1, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.1);
        
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.1);
      }, i * 100 + (Math.random() * 50));
    }
  }

  ensureMusicPlaying() {
    if (!this.musicStarted && this.musicEnabled) {
      this.bgMusic.play().catch(e => console.log('Audio autoplay prevented:', e));
      this.musicStarted = true;
    }
  }

  async init() {
    // Render the board
    this.board.render();

    // Connect WebSocket
    await this.socket.connect();
    this.chat = new ChatUI(this.socket);
    this.trade = new TradeUI(this.ui, this.socket);

    // Register event handlers
    this.socket.on('gameState', (msg) => this.onGameState(msg.state));
    this.socket.on('diceRolled', (msg) => this.onDiceRolled(msg));
    this.socket.on('playerMoved', (msg) => this.onPlayerMoved(msg));
    this.socket.on('landedProperty', (msg) => this.onLandedProperty(msg));
    this.socket.on('propertyBought', (msg) => this.onPropertyBought(msg));
    this.socket.on('rentPaid', (msg) => this.onRentPaid(msg));
    this.socket.on('cardDrawn', (msg) => this.onCardDrawn(msg));
    this.socket.on('playerJailed', (msg) => this.onPlayerJailed(msg));
    this.socket.on('notification', (msg) => this.onNotification(msg));
    this.socket.on('turnChanged', (msg) => this.onTurnChanged(msg));
    this.socket.on('houseBuilt', (msg) => this.onHouseBuilt(msg));
    this.socket.on('houseSold', (msg) => this.onHouseSold(msg));
    this.socket.on('propertyMortgaged', (msg) => this.onNotification(msg));
    this.socket.on('propertyUnmortgaged', (msg) => this.onNotification(msg));
    this.socket.on('playerBankrupt', (msg) => this.onPlayerBankrupt(msg));
    this.socket.on('gameOver', (msg) => this.onGameOver(msg));
    this.socket.on('tradeProposed', (msg) => this.onTradeProposed(msg));
    this.socket.on('tradeCompleted', (msg) => this.ui.toast(`Trade completed!`, 'success'));
    this.socket.on('tradeRejected', () => this.ui.toast('Trade rejected', 'warning'));
    this.socket.on('chat', (msg) => this.chat.addMessage(msg.playerName, msg.message, TOKEN_COLORS[this.getPlayerById(msg.playerId)?.token]));
    this.socket.on('error', (msg) => this.ui.toast(msg.message, 'error'));
    this.socket.on('playerDisconnected', (msg) => this.ui.toast('A player disconnected', 'warning'));

    // Reconnect to room with existing player identity
    this.socket.send('reconnect', {
      roomCode: sessionStorage.getItem('monopoly_roomCode'),
      playerId: this.myPlayerId
    });

    // Button handlers
    document.getElementById('rollBtn').addEventListener('click', () => { this.ensureMusicPlaying(); this.rollDice(); });
    document.getElementById('endTurnBtn').addEventListener('click', () => { this.ensureMusicPlaying(); this.endTurn(); });
    document.getElementById('toggleMusicBtn').addEventListener('click', () => { this.toggleMusic(); });
    document.getElementById('toggleSoundBtn').addEventListener('click', () => { this.toggleSound(); });
    document.body.addEventListener('click', () => this.ensureMusicPlaying(), { once: true });
  }

  isMyTurn() {
    return this.state && this.state.currentPlayerId === this.myPlayerId;
  }

  getMe() {
    return this.state?.players?.find(p => p.id === this.myPlayerId);
  }

  getPlayerById(id) {
    return this.state?.players?.find(p => p.id === id);
  }

  onGameState(state) {
    this.state = state;
    this.updateUI();
  }

  updateUI() {
    if (!this.state) return;
    const s = this.state;

    // Update board tokens
    this.board.placeTokens(s.players);
    this.board.updateHouses(s.propertyStates);
    this.board.updateOwnership(s.propertyStates, s.players);

    // Highlight current player's position
    const currentPlayer = s.players.find(p => p.id === s.currentPlayerId);
    if (currentPlayer) this.board.highlightSpace(currentPlayer.position);

    // Update player panel
    this.ui.updatePlayersPanel(s.players, s.currentPlayerId, this.myPlayerId);

    // Update property management
    this.ui.updateMyProperties(s.players, this.myPlayerId, s.propertyStates, this.socket);

    // Update action buttons
    this.updateActionButtons();

    // Update dice display
    if (s.lastDice[0] > 0) {
      document.getElementById('die1').style.transform = this.dice.getRotation(s.lastDice[0]);
      document.getElementById('die2').style.transform = this.dice.getRotation(s.lastDice[1]);
    }
  }

  updateActionButtons() {
    const s = this.state;
    const me = this.getMe();
    const isMyTurn = this.isMyTurn();

    const rollBtn = document.getElementById('rollBtn');
    const endTurnBtn = document.getElementById('endTurnBtn');
    const specialActions = document.getElementById('specialActions');
    specialActions.innerHTML = '';

    rollBtn.disabled = !isMyTurn || me?.hasRolled;
    endTurnBtn.disabled = !isMyTurn || !me?.hasRolled || s.pendingAction === 'buyOrAuction';

    // Jail actions
    if (isMyTurn && me?.inJail && !me?.hasRolled) {
      rollBtn.disabled = false;
      if (me.money >= 50) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-secondary';
        btn.textContent = '💰 Pay $50 Fine';
        btn.addEventListener('click', () => { this.ensureMusicPlaying(); this.socket.send('payJailFine'); });
        specialActions.appendChild(btn);
      }
      if (me.jailCards > 0) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-secondary';
        btn.textContent = '🃏 Use GOOJF Card';
        btn.addEventListener('click', () => { this.ensureMusicPlaying(); this.socket.send('useJailCard'); });
        specialActions.appendChild(btn);
      }
    }

    // Buy/Decline property
    if (isMyTurn && s.pendingAction === 'buyOrAuction') {
      const buyBtn = document.createElement('button');
      buyBtn.className = 'btn btn-success';
      buyBtn.textContent = '🏠 Buy Property';
      buyBtn.addEventListener('click', () => { this.ensureMusicPlaying(); this.socket.send('buyProperty'); });
      specialActions.appendChild(buyBtn);

      const declineBtn = document.createElement('button');
      declineBtn.className = 'btn btn-secondary';
      declineBtn.textContent = '❌ Decline';
      declineBtn.addEventListener('click', () => { this.ensureMusicPlaying(); this.socket.send('declineBuy'); });
      specialActions.appendChild(declineBtn);
    }
  }

  rollDice() {
    if (!this.isMyTurn()) return;
    this.socket.send('rollDice');
  }

  endTurn() {
    if (!this.isMyTurn()) return;
    this.socket.send('endTurn');
  }

  buildHouse(propertyId) {
    this.socket.send('buildHouse', { propertyId });
  }

  sellHouse(propertyId) {
    this.socket.send('sellHouse', { propertyId });
  }

  mortgage(propertyId) {
    this.socket.send('mortgageProperty', { propertyId });
  }

  unmortgage(propertyId) {
    this.socket.send('unmortgageProperty', { propertyId });
  }

  openTrade(targetPlayerId) {
    if (!this.state) return;
    const me = this.getMe();
    const target = this.getPlayerById(targetPlayerId);
    if (me && target) {
      this.trade.openTradeModal(me, target, this.state.propertyStates);
    }
  }

  showPropertyDetail(spaceId) {
    if (this.state) {
      this.ui.showPropertyDetailModal(spaceId, this.state.propertyStates, this.state.players);
    }
  }

  // Event handlers
  async onDiceRolled(msg) {
    this.playDiceSound();
    await this.dice.roll(msg.dice[0], msg.dice[1]);
    if (msg.doubles) this.ui.toast('Doubles! Roll again!', 'warning');
  }

  onPlayerMoved(msg) {
    this.chat.addSystemMessage(`Player moved to position ${msg.position}`);
  }

  onLandedProperty(msg) {
    const prop = msg.property;
    if (this.isMyTurn()) {
      this.ui.toast(`You landed on ${prop.name} ($${prop.price})`, 'info');
    } else {
      this.ui.toast(`${prop.name} is available for purchase`, 'info');
    }
  }

  onPropertyBought(msg) {
    const space = BOARD_DATA[msg.propertyId];
    this.ui.toast(`${space?.name || 'Property'} was purchased for $${msg.price}`, 'success');
    this.chat.addSystemMessage(`${space?.name} purchased for $${msg.price}`);
  }

  onRentPaid(msg) {
    this.ui.toast(`$${msg.amount} rent paid for ${msg.property}`, 'warning');
    this.chat.addSystemMessage(`$${msg.amount} rent paid for ${msg.property}`);
  }

  onCardDrawn(msg) {
    this.ui.showModal(`
      <div style="text-align:center;">
        <h2 style="margin-bottom:8px;">${msg.cardType}</h2>
        <div style="padding:24px;background:var(--bg-glass);border-radius:var(--radius-md);margin:16px 0;font-size:1.1rem;animation:cardFlip 0.6s ease;">
          ${msg.card.text}
        </div>
        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">OK</button>
      </div>
    `);
    this.chat.addSystemMessage(`${msg.cardType}: ${msg.card.text}`);
  }

  onPlayerJailed(msg) {
    this.ui.toast(msg.message, 'error');
    this.chat.addSystemMessage(msg.message);
  }

  onNotification(msg) {
    this.ui.toast(msg.message, 'info');
    this.chat.addSystemMessage(msg.message);
  }

  onTurnChanged(msg) {
    const player = this.getPlayerById(msg.currentPlayer);
    const name = msg.currentPlayer === this.myPlayerId ? 'Your' : (player?.name || 'Unknown') + "'s";
    this.ui.toast(`${name} turn!`, 'info');
    this.chat.addSystemMessage(`--- ${name} turn ---`);
    this.dice.reset();
  }

  onHouseBuilt(msg) {
    this.ui.toast(msg.message, 'success');
    this.chat.addSystemMessage(msg.message);
  }

  onHouseSold(msg) {
    this.ui.toast('House sold', 'info');
  }

  onPlayerBankrupt(msg) {
    this.ui.toast(`${msg.playerName} went bankrupt!`, 'error');
    this.chat.addSystemMessage(`💀 ${msg.playerName} went bankrupt!`);
  }

  onGameOver(msg) {
    this.ui.closeModals();
    this.ui.showModal(`
      <div style="text-align:center;">
        <h1 style="font-size:2rem;margin-bottom:16px;">🏆 Game Over!</h1>
        <p style="font-size:1.2rem;margin-bottom:24px;">${msg.winnerName} wins!</p>
        <button class="btn btn-primary" onclick="window.location.href='/'">Back to Lobby</button>
      </div>
    `);
  }

  onTradeProposed(msg) {
    if (msg.trade.toId === this.myPlayerId) {
      this.trade.showTradeProposal(msg.trade, this.state.players);
    } else {
      this.ui.toast('A trade has been proposed', 'info');
    }
  }
}

// Initialize when page loads
window.addEventListener('DOMContentLoaded', () => {
  window.gameController = new GameController();
});
