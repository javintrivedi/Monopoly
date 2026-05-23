// boardRenderer.js - Renders the Monopoly board
const BOARD_DATA = [
  { id: 0, name: 'GO', type: 'go', icon: '➡️' },
  { id: 1, name: 'Mediterranean Ave', type: 'property', color: 'brown', price: 60 },
  { id: 2, name: 'Community Chest', type: 'community-chest', icon: '📦' },
  { id: 3, name: 'Baltic Ave', type: 'property', color: 'brown', price: 60 },
  { id: 4, name: 'Income Tax', type: 'tax', icon: '💰', price: 200 },
  { id: 5, name: 'Reading Railroad', type: 'railroad', icon: '🚂', price: 200 },
  { id: 6, name: 'Oriental Ave', type: 'property', color: 'lightblue', price: 100 },
  { id: 7, name: 'Chance', type: 'chance', icon: '❓' },
  { id: 8, name: 'Vermont Ave', type: 'property', color: 'lightblue', price: 100 },
  { id: 9, name: 'Connecticut Ave', type: 'property', color: 'lightblue', price: 120 },
  { id: 10, name: 'Jail', type: 'jail', icon: '🔒' },
  { id: 11, name: 'St. Charles Place', type: 'property', color: 'pink', price: 140 },
  { id: 12, name: 'Electric Co.', type: 'utility', icon: '💡', price: 150 },
  { id: 13, name: 'States Ave', type: 'property', color: 'pink', price: 140 },
  { id: 14, name: 'Virginia Ave', type: 'property', color: 'pink', price: 160 },
  { id: 15, name: 'Pennsylvania RR', type: 'railroad', icon: '🚂', price: 200 },
  { id: 16, name: 'St. James Place', type: 'property', color: 'orange', price: 180 },
  { id: 17, name: 'Community Chest', type: 'community-chest', icon: '📦' },
  { id: 18, name: 'Tennessee Ave', type: 'property', color: 'orange', price: 180 },
  { id: 19, name: 'New York Ave', type: 'property', color: 'orange', price: 200 },
  { id: 20, name: 'Free Parking', type: 'free-parking', icon: '🅿️' },
  { id: 21, name: 'Kentucky Ave', type: 'property', color: 'red', price: 220 },
  { id: 22, name: 'Chance', type: 'chance', icon: '❓' },
  { id: 23, name: 'Indiana Ave', type: 'property', color: 'red', price: 220 },
  { id: 24, name: 'Illinois Ave', type: 'property', color: 'red', price: 240 },
  { id: 25, name: 'B&O Railroad', type: 'railroad', icon: '🚂', price: 200 },
  { id: 26, name: 'Atlantic Ave', type: 'property', color: 'yellow', price: 260 },
  { id: 27, name: 'Ventnor Ave', type: 'property', color: 'yellow', price: 260 },
  { id: 28, name: 'Water Works', type: 'utility', icon: '🚰', price: 150 },
  { id: 29, name: 'Marvin Gardens', type: 'property', color: 'yellow', price: 280 },
  { id: 30, name: 'Go To Jail', type: 'go-to-jail', icon: '👮' },
  { id: 31, name: 'Pacific Ave', type: 'property', color: 'green', price: 300 },
  { id: 32, name: 'N. Carolina Ave', type: 'property', color: 'green', price: 300 },
  { id: 33, name: 'Community Chest', type: 'community-chest', icon: '📦' },
  { id: 34, name: 'Pennsylvania Ave', type: 'property', color: 'green', price: 320 },
  { id: 35, name: 'Short Line', type: 'railroad', icon: '🚂', price: 200 },
  { id: 36, name: 'Chance', type: 'chance', icon: '❓' },
  { id: 37, name: 'Park Place', type: 'property', color: 'darkblue', price: 350 },
  { id: 38, name: 'Luxury Tax', type: 'tax', icon: '💎', price: 100 },
  { id: 39, name: 'Boardwalk', type: 'property', color: 'darkblue', price: 400 },
];

const COLOR_MAP = {
  brown: '#8B4513', lightblue: '#87CEEB', pink: '#DB2777',
  orange: '#F97316', red: '#EF4444', yellow: '#FACC15',
  green: '#22C55E', darkblue: '#2563EB'
};

const TOKEN_EMOJIS = { car: '🚗', hat: '🎩', dog: '🐕', ship: '🚢' };
const TOKEN_COLORS = { car: '#ef4444', hat: '#3b82f6', dog: '#22c55e', ship: '#a855f7' };

function getSide(id) {
  if (id >= 0 && id <= 10) return 'bottom';
  if (id >= 11 && id <= 19) return 'left';
  if (id >= 20 && id <= 30) return 'top';
  return 'right';
}

function isCorner(id) { return [0, 10, 20, 30].includes(id); }

class BoardRenderer {
  constructor(boardEl) {
    this.boardEl = boardEl;
    this.spaces = {};
    this.tokens = {};
  }

  render() {
    // Clear existing spaces (keep center)
    const center = document.getElementById('boardCenter');
    this.boardEl.innerHTML = '';
    this.boardEl.appendChild(center);

    BOARD_DATA.forEach(space => {
      const el = document.createElement('div');
      el.className = `space ${getSide(space.id)}${isCorner(space.id) ? ' corner' : ''}`;
      el.dataset.pos = space.id;
      el.dataset.spaceId = space.id;

      let html = '';

      if (space.color) {
        html += `<div class="color-strip" style="--strip-color: ${COLOR_MAP[space.color]}; background: ${COLOR_MAP[space.color]};"></div>`;
      }

      if (isCorner(space.id)) {
        html += `<span class="corner-icon">${space.icon || ''}</span>`;
        html += `<span class="space-name">${space.name}</span>`;
      } else if (space.icon && !space.color) {
        html += `<span style="font-size:0.7rem;">${space.icon}</span>`;
        html += `<span class="space-name">${space.name}</span>`;
        if (space.price) html += `<span class="space-price">$${space.price}</span>`;
      } else {
        html += `<span class="space-name">${space.name}</span>`;
        if (space.price) html += `<span class="space-price">$${space.price}</span>`;
      }

      html += '<div class="houses-indicator" id="houses-' + space.id + '"></div>';
      el.innerHTML = html;

      // Click handler for property detail
      el.addEventListener('click', () => {
        if (window.gameController) window.gameController.showPropertyDetail(space.id);
      });

      this.boardEl.appendChild(el);
      this.spaces[space.id] = el;
    });
  }

  placeTokens(players) {
    // Remove old tokens
    Object.values(this.tokens).forEach(el => el.remove());
    this.tokens = {};

    // Group players by position
    const posMap = {};
    players.forEach(p => {
      if (p.bankrupt) return;
      if (!posMap[p.position]) posMap[p.position] = [];
      posMap[p.position].push(p);
    });

    players.forEach(p => {
      if (p.bankrupt) return;
      const spaceEl = this.spaces[p.position];
      if (!spaceEl) return;

      const tokenEl = document.createElement('div');
      tokenEl.className = `token pos-${posMap[p.position].indexOf(p)}`;
      tokenEl.dataset.token = p.token;
      tokenEl.dataset.playerId = p.id;
      tokenEl.textContent = TOKEN_EMOJIS[p.token] || '●';
      tokenEl.style.fontSize = '8px';

      spaceEl.appendChild(tokenEl);
      this.tokens[p.id] = tokenEl;
    });
  }

  updateHouses(propertyStates) {
    // Clear all houses
    BOARD_DATA.forEach(s => {
      const hEl = document.getElementById('houses-' + s.id);
      if (hEl) hEl.innerHTML = '';
    });

    Object.entries(propertyStates).forEach(([id, state]) => {
      const hEl = document.getElementById('houses-' + id);
      if (!hEl || !state.houses) return;

      if (state.houses === 5) {
        hEl.innerHTML = '<div class="hotel-dot"></div>';
      } else {
        hEl.innerHTML = Array(state.houses).fill('<div class="house-dot"></div>').join('');
      }

      // Mortgage visual
      const spaceEl = this.spaces[id];
      if (spaceEl) {
        spaceEl.classList.toggle('mortgaged', !!state.mortgaged);
      }
    });
  }

  updateOwnership(propertyStates, players) {
    // Remove existing owner dots
    document.querySelectorAll('.owner-dot').forEach(el => el.remove());

    Object.entries(propertyStates).forEach(([id, state]) => {
      const spaceEl = this.spaces[id];
      if (!spaceEl) return;

      const player = players.find(p => p.id === state.ownerId);
      if (!player) return;

      const dot = document.createElement('div');
      dot.className = 'owner-dot';
      dot.style.background = TOKEN_COLORS[player.token] || '#888';
      spaceEl.appendChild(dot);
    });
  }

  highlightSpace(spaceId) {
    Object.values(this.spaces).forEach(el => el.classList.remove('active-space'));
    if (this.spaces[spaceId]) this.spaces[spaceId].classList.add('active-space');
  }
}
