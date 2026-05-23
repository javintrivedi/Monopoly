// uiManager.js - UI management (toasts, modals, player panel)
class UIManager {
  constructor() {
    this.toastContainer = document.getElementById('toast-container');
    this.modalContainer = document.getElementById('modalContainer');
  }

  toast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    this.toastContainer.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3500);
  }

  showModal(html, onClose) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `<div class="modal">${html}</div>`;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) { overlay.remove(); if (onClose) onClose(); }
    });
    this.modalContainer.appendChild(overlay);
    return overlay;
  }

  closeModals() {
    this.modalContainer.innerHTML = '';
  }

  showPropertyDetailModal(spaceId, propertyStates, players) {
    const space = BOARD_DATA[spaceId];
    if (!space) return;
    const state = propertyStates?.[spaceId];
    const owner = state ? players.find(p => p.id === state.ownerId) : null;

    const rentLabels = ['Base Rent', '1 House', '2 Houses', '3 Houses', '4 Houses', 'Hotel'];
    const fullRent = {
      brown: { 1: [2,10,30,90,160,250], 3: [4,20,60,180,320,450] },
      lightblue: { 6: [6,30,90,270,400,550], 8: [6,30,90,270,400,550], 9: [8,40,100,300,450,600] },
      pink: { 11: [10,50,150,450,625,750], 13: [10,50,150,450,625,750], 14: [12,60,180,500,700,900] },
      orange: { 16: [14,70,200,550,750,950], 18: [14,70,200,550,750,950], 19: [16,80,220,600,800,1000] },
      red: { 21: [18,90,250,700,875,1050], 23: [18,90,250,700,875,1050], 24: [20,100,300,750,925,1100] },
      yellow: { 26: [22,110,330,800,975,1150], 27: [22,110,330,800,975,1150], 29: [24,120,360,850,1025,1200] },
      green: { 31: [26,130,390,900,1100,1275], 32: [26,130,390,900,1100,1275], 34: [28,150,450,1000,1200,1400] },
      darkblue: { 37: [35,175,500,1100,1300,1500], 39: [50,200,600,1400,1700,2000] }
    };

    let rentHtml = '';
    if (space.color && fullRent[space.color] && fullRent[space.color][spaceId]) {
      const rents = fullRent[space.color][spaceId];
      rentHtml = '<table class="rent-table">';
      rents.forEach((r, i) => { rentHtml += `<tr><td>${rentLabels[i]}</td><td>$${r}</td></tr>`; });
      rentHtml += '</table>';
    } else if (space.type === 'railroad') {
      rentHtml = '<table class="rent-table"><tr><td>1 Railroad</td><td>$25</td></tr><tr><td>2 Railroads</td><td>$50</td></tr><tr><td>3 Railroads</td><td>$100</td></tr><tr><td>4 Railroads</td><td>$200</td></tr></table>';
    } else if (space.type === 'utility') {
      rentHtml = '<table class="rent-table"><tr><td>1 Utility</td><td>4× dice</td></tr><tr><td>2 Utilities</td><td>10× dice</td></tr></table>';
    }

    const colorBar = space.color ? `<div class="property-detail-color" style="background:${COLOR_MAP[space.color]}"></div>` : '';
    const ownerText = owner ? `<p style="margin-top:8px;color:var(--text-secondary);">Owner: <strong>${owner.name}</strong></p>` : '';
    const mortgagedText = state?.mortgaged ? '<p style="color:var(--accent-red);margin-top:4px;">MORTGAGED</p>' : '';
    const housesText = state?.houses ? `<p style="margin-top:4px;">Houses: ${state.houses >= 5 ? '🏨 Hotel' : '🏠'.repeat(state.houses)}</p>` : '';

    this.showModal(`
      <div class="property-detail">
        ${colorBar}
        <h3>${space.name}</h3>
        ${space.price ? `<p style="font-size:1.1rem;font-weight:700;color:var(--accent-gold);">$${space.price}</p>` : ''}
        ${rentHtml}
        ${ownerText}
        ${mortgagedText}
        ${housesText}
        <div class="modal-actions"><button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Close</button></div>
      </div>
    `);
  }

  updatePlayersPanel(players, currentPlayerId, myPlayerId) {
    const panel = document.getElementById('playersPanel');
    panel.innerHTML = '';

    players.forEach(p => {
      const isActive = p.id === currentPlayerId;
      const card = document.createElement('div');
      card.className = `player-card${isActive ? ' active' : ''}${p.bankrupt ? ' bankrupt' : ''}`;

      const propDots = (p.properties || []).map(pid => {
        const space = BOARD_DATA[pid];
        const color = space?.color ? COLOR_MAP[space.color] : '#888';
        return `<div class="player-prop-dot" style="background:${color}"></div>`;
      }).join('');

      let statusText = '';
      if (p.bankrupt) statusText = '💀 Bankrupt';
      else if (p.inJail) statusText = '🔒 In Jail';
      else if (isActive) statusText = '🎲 Current Turn';

      card.innerHTML = `
        <div class="player-card-header">
          <div class="player-token-icon" style="background:${TOKEN_COLORS[p.token]}">${TOKEN_EMOJIS[p.token]}</div>
          <span class="player-name">${p.name}${p.id === myPlayerId ? ' (You)' : ''}</span>
          <span class="player-money">$${p.money}</span>
        </div>
        <div class="player-properties">${propDots}</div>
        ${statusText ? `<div class="player-status ${p.inJail ? 'in-jail' : ''}">${statusText}</div>` : ''}
      `;

      // Click to open trade (if not self)
      if (p.id !== myPlayerId && !p.bankrupt) {
        card.style.cursor = 'pointer';
        card.addEventListener('click', () => {
          if (window.gameController) window.gameController.openTrade(p.id);
        });
      }

      panel.appendChild(card);
    });
  }

  updateMyProperties(players, myPlayerId, propertyStates, socket) {
    const panel = document.getElementById('myProperties');
    const me = players.find(p => p.id === myPlayerId);
    if (!me) { panel.innerHTML = '<p style="font-size:0.8rem;color:var(--text-muted)">No properties</p>'; return; }

    if (!me.properties || me.properties.length === 0) {
      panel.innerHTML = '<p style="font-size:0.8rem;color:var(--text-muted)">No properties yet</p>';
      return;
    }

    panel.innerHTML = '';
    me.properties.forEach(pid => {
      const space = BOARD_DATA[pid];
      const state = propertyStates[pid];
      if (!space) return;

      const item = document.createElement('div');
      item.className = 'prop-mgmt-item';

      const colorDot = space.color ? `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${COLOR_MAP[space.color]};margin-right:6px;"></span>` : '';

      let actions = '';
      if (state && !state.mortgaged && space.color) {
        actions += `<button onclick="window.gameController.buildHouse(${pid})">+🏠</button>`;
        if (state.houses > 0) actions += `<button onclick="window.gameController.sellHouse(${pid})">-🏠</button>`;
      }
      if (state && !state.mortgaged && (!state.houses || state.houses === 0)) {
        actions += `<button onclick="window.gameController.mortgage(${pid})">Mortgage</button>`;
      }
      if (state && state.mortgaged) {
        actions += `<button onclick="window.gameController.unmortgage(${pid})">Unmortgage</button>`;
      }

      item.innerHTML = `
        <span>${colorDot}${space.name}${state?.mortgaged ? ' (M)' : ''}${state?.houses ? ' 🏠×'+state.houses : ''}</span>
        <div class="prop-mgmt-actions">${actions}</div>
      `;
      panel.appendChild(item);
    });
  }
}
