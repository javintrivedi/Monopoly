// game/GameEngine.js - Core Monopoly game logic
const { BOARD, COLOR_GROUPS, RAILROADS, UTILITIES } = require('./Board');
const { CardDeck, CHANCE_CARDS, COMMUNITY_CHEST_CARDS } = require('./Cards');
const Player = require('./Player');

class GameEngine {
  constructor(roomCode) {
    this.roomCode = roomCode;
    this.players = [];
    this.currentPlayerIndex = 0;
    this.propertyStates = {};
    this.chanceDeck = new CardDeck(CHANCE_CARDS);
    this.communityDeck = new CardDeck(COMMUNITY_CHEST_CARDS);
    this.started = false;
    this.gameOver = false;
    this.winnerId = null;
    this.lastDice = [0, 0];
    this.pendingAction = null; // 'buyOrAuction', 'auction', etc.
    this.auction = null;
    this.trades = [];
    this.log = [];
  }

  addPlayer(id, name, token) {
    if (this.players.length >= 4) return null;
    const player = new Player(id, name, token);
    this.players.push(player);
    return player;
  }

  removePlayer(id) {
    const idx = this.players.findIndex(p => p.id === id);
    if (idx !== -1) this.players.splice(idx, 1);
  }

  getPlayer(id) { return this.players.find(p => p.id === id); }
  get currentPlayer() { return this.players[this.currentPlayerIndex]; }

  startGame() {
    if (this.players.length < 2) return false;
    this.started = true;
    this.currentPlayerIndex = 0;
    this.addLog(`Game started! ${this.currentPlayer.name}'s turn.`);
    return true;
  }

  rollDice(playerId) {
    const player = this.currentPlayer;
    if (player.id !== playerId || player.hasRolled) return null;
    
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    const doubles = d1 === d2;
    this.lastDice = [d1, d2];
    player.hasRolled = true;

    const events = [{ type: 'diceRolled', dice: [d1, d2], doubles }];

    if (player.inJail) {
      player.jailTurns++;
      if (doubles) {
        player.getOutOfJail();
        events.push({ type: 'notification', message: `${player.name} rolled doubles and is free from jail!` });
        const moveEvents = this._movePlayer(player, d1 + d2);
        events.push(...moveEvents);
      } else if (player.jailTurns >= 3) {
        player.pay(50);
        player.getOutOfJail();
        events.push({ type: 'notification', message: `${player.name} paid $50 after 3 turns in jail.` });
        const moveEvents = this._movePlayer(player, d1 + d2);
        events.push(...moveEvents);
      } else {
        events.push({ type: 'notification', message: `${player.name} didn't roll doubles. Still in jail. (Turn ${player.jailTurns}/3)` });
        this.pendingAction = null;
      }
      return events;
    }

    if (doubles) {
      player.doublesCount++;
      if (player.doublesCount >= 3) {
        player.goToJail();
        player.hasRolled = true;
        events.push({ type: 'playerJailed', playerId: player.id, message: `${player.name} rolled 3 doubles - Go to Jail!` });
        return events;
      }
      player.hasRolled = false; // Can roll again
    } else {
      player.doublesCount = 0;
    }

    const moveEvents = this._movePlayer(player, d1 + d2);
    events.push(...moveEvents);
    return events;
  }

  _movePlayer(player, spaces) {
    const events = [];
    const passedGo = player.moveForward(spaces);
    if (passedGo) {
      player.receive(200);
      events.push({ type: 'notification', message: `${player.name} passed GO and collected $200!` });
    }
    events.push({ type: 'playerMoved', playerId: player.id, position: player.position });
    const landEvents = this._resolveSpace(player);
    events.push(...landEvents);
    return events;
  }

  _resolveSpace(player) {
    const space = BOARD[player.position];
    const events = [];

    switch (space.type) {
      case 'property':
      case 'railroad':
      case 'utility': {
        const state = this.propertyStates[space.id];
        if (!state) {
          this.pendingAction = 'buyOrAuction';
          events.push({ type: 'landedProperty', property: space, canBuy: player.money >= space.price });
        } else if (state.ownerId !== player.id && !state.mortgaged) {
          const rent = this._calculateRent(space, state);
          player.pay(rent);
          const owner = this.getPlayer(state.ownerId);
          if (owner) owner.receive(rent);
          events.push({ type: 'rentPaid', from: player.id, to: state.ownerId, amount: rent, property: space.name });
          if (player.money < 0) events.push(...this._handleBankruptcy(player, state.ownerId));
        } else {
          events.push({ type: 'notification', message: `${player.name} landed on their own property.` });
        }
        break;
      }
      case 'tax':
        player.pay(space.amount);
        events.push({ type: 'notification', message: `${player.name} paid $${space.amount} in ${space.name}.` });
        if (player.money < 0) events.push(...this._handleBankruptcy(player, null));
        break;
      case 'chance': {
        const card = this.chanceDeck.draw();
        events.push({ type: 'cardDrawn', cardType: 'Chance', card });
        events.push(...this._executeCard(player, card, 'chance'));
        break;
      }
      case 'community-chest': {
        const card = this.communityDeck.draw();
        events.push({ type: 'cardDrawn', cardType: 'Community Chest', card });
        events.push(...this._executeCard(player, card, 'community'));
        break;
      }
      case 'go-to-jail':
        player.goToJail();
        events.push({ type: 'playerJailed', playerId: player.id, message: `${player.name} was sent to Jail!` });
        player.hasRolled = true;
        break;
      case 'go':
        events.push({ type: 'notification', message: `${player.name} landed on GO!` });
        break;
      case 'jail':
        events.push({ type: 'notification', message: `${player.name} is just visiting Jail.` });
        break;
      case 'free-parking':
        events.push({ type: 'notification', message: `${player.name} landed on Free Parking.` });
        break;
    }
    return events;
  }

  _calculateRent(space, state) {
    if (space.type === 'railroad') {
      const owner = this.getPlayer(state.ownerId);
      const rrCount = owner.properties.filter(p => RAILROADS.includes(p)).length;
      return 25 * Math.pow(2, rrCount - 1);
    }
    if (space.type === 'utility') {
      const owner = this.getPlayer(state.ownerId);
      const utilCount = owner.properties.filter(p => UTILITIES.includes(p)).length;
      const diceTotal = this.lastDice[0] + this.lastDice[1];
      return utilCount === 2 ? diceTotal * 10 : diceTotal * 4;
    }
    // Property
    if (state.houses > 0) return space.rent[state.houses];
    // Check for color set bonus (double rent with no houses)
    const owner = this.getPlayer(state.ownerId);
    const group = COLOR_GROUPS[space.color];
    const ownsAll = group && group.every(id => owner.properties.includes(id));
    return ownsAll ? space.rent[0] * 2 : space.rent[0];
  }

  _executeCard(player, card, deckType) {
    const events = [];
    switch (card.action) {
      case 'moveTo': {
        const passedGo = player.moveTo(card.destination);
        if (passedGo) { player.receive(200); events.push({ type: 'notification', message: `${player.name} passed GO!` }); }
        events.push({ type: 'playerMoved', playerId: player.id, position: player.position });
        events.push(...this._resolveSpace(player));
        break;
      }
      case 'moveBack': {
        player.position = (player.position - card.spaces + 40) % 40;
        events.push({ type: 'playerMoved', playerId: player.id, position: player.position });
        events.push(...this._resolveSpace(player));
        break;
      }
      case 'collect': player.receive(card.amount); events.push({ type: 'notification', message: `${player.name} collected $${card.amount}` }); break;
      case 'pay': player.pay(card.amount); events.push({ type: 'notification', message: `${player.name} paid $${card.amount}` }); if (player.money < 0) events.push(...this._handleBankruptcy(player, null)); break;
      case 'goToJail': player.goToJail(); events.push({ type: 'playerJailed', playerId: player.id, message: `${player.name} goes to Jail!` }); player.hasRolled = true; break;
      case 'jailCard': player.jailCards++; events.push({ type: 'notification', message: `${player.name} got a Get Out of Jail Free card!` }); break;
      case 'nearestRailroad': {
        const rrs = [5,15,25,35];
        let nearest = rrs.find(r => r > player.position) || rrs[0];
        const passedGo = player.moveTo(nearest);
        if (passedGo) { player.receive(200); }
        events.push({ type: 'playerMoved', playerId: player.id, position: player.position });
        const state = this.propertyStates[nearest];
        if (state && state.ownerId !== player.id) {
          const rent = 25 * Math.pow(2, this.getPlayer(state.ownerId).properties.filter(p => RAILROADS.includes(p)).length - 1) * 2;
          player.pay(rent); this.getPlayer(state.ownerId).receive(rent);
          events.push({ type: 'rentPaid', from: player.id, to: state.ownerId, amount: rent, property: BOARD[nearest].name });
          if (player.money < 0) events.push(...this._handleBankruptcy(player, state.ownerId));
        } else if (!state) { this.pendingAction = 'buyOrAuction'; events.push({ type: 'landedProperty', property: BOARD[nearest], canBuy: player.money >= 200 }); }
        break;
      }
      case 'nearestUtility': {
        const utils = [12,28];
        let nearest = utils.find(u => u > player.position) || utils[0];
        const passedGo = player.moveTo(nearest);
        if (passedGo) { player.receive(200); }
        events.push({ type: 'playerMoved', playerId: player.id, position: player.position });
        const state = this.propertyStates[nearest];
        if (state && state.ownerId !== player.id) {
          const d1 = Math.floor(Math.random()*6)+1, d2 = Math.floor(Math.random()*6)+1;
          const rent = (d1+d2) * 10;
          player.pay(rent); this.getPlayer(state.ownerId).receive(rent);
          events.push({ type: 'rentPaid', from: player.id, to: state.ownerId, amount: rent, property: BOARD[nearest].name });
          if (player.money < 0) events.push(...this._handleBankruptcy(player, state.ownerId));
        } else if (!state) { this.pendingAction = 'buyOrAuction'; events.push({ type: 'landedProperty', property: BOARD[nearest], canBuy: player.money >= 150 }); }
        break;
      }
      case 'repairs': {
        let total = 0;
        for (const pid of player.properties) {
          const ps = this.propertyStates[pid];
          if (ps && ps.houses > 0 && ps.houses < 5) total += ps.houses * card.perHouse;
          if (ps && ps.houses === 5) total += card.perHotel;
        }
        player.pay(total);
        events.push({ type: 'notification', message: `${player.name} paid $${total} in repairs.` });
        if (player.money < 0) events.push(...this._handleBankruptcy(player, null));
        break;
      }
      case 'payEach': {
        const amt = card.amount * (this.activePlayers().length - 1);
        player.pay(amt);
        this.activePlayers().filter(p => p.id !== player.id).forEach(p => p.receive(card.amount));
        events.push({ type: 'notification', message: `${player.name} paid $${card.amount} to each player.` });
        if (player.money < 0) events.push(...this._handleBankruptcy(player, null));
        break;
      }
      case 'collectEach': {
        this.activePlayers().filter(p => p.id !== player.id).forEach(p => { p.pay(card.amount); player.receive(card.amount); });
        events.push({ type: 'notification', message: `${player.name} collected $${card.amount} from each player.` });
        break;
      }
    }
    return events;
  }

  buyProperty(playerId) {
    const player = this.currentPlayer;
    if (player.id !== playerId || this.pendingAction !== 'buyOrAuction') return null;
    const space = BOARD[player.position];
    if (player.money < space.price) return [{ type: 'error', message: 'Not enough money!' }];
    
    player.pay(space.price);
    player.addProperty(space.id);
    this.propertyStates[space.id] = { ownerId: player.id, houses: 0, mortgaged: false };
    this.pendingAction = null;
    this.addLog(`${player.name} bought ${space.name} for $${space.price}`);
    return [{ type: 'propertyBought', playerId: player.id, propertyId: space.id, price: space.price }];
  }

  declineBuy(playerId) {
    if (this.currentPlayer.id !== playerId || this.pendingAction !== 'buyOrAuction') return null;
    this.pendingAction = null;
    this.addLog(`${this.currentPlayer.name} declined to buy ${BOARD[this.currentPlayer.position].name}`);
    return [{ type: 'notification', message: `${this.currentPlayer.name} declined to buy.` }];
  }

  buildHouse(playerId, propertyId) {
    const player = this.getPlayer(playerId);
    if (!player || player.id !== this.currentPlayer.id) return null;
    const space = BOARD[propertyId];
    if (!space || space.type !== 'property') return [{ type: 'error', message: 'Invalid property' }];
    const state = this.propertyStates[propertyId];
    if (!state || state.ownerId !== playerId) return [{ type: 'error', message: 'You don\'t own this' }];
    if (state.mortgaged) return [{ type: 'error', message: 'Property is mortgaged' }];
    
    const group = COLOR_GROUPS[space.color];
    if (!group.every(id => player.properties.includes(id))) return [{ type: 'error', message: 'Need full color set' }];
    if (state.houses >= 5) return [{ type: 'error', message: 'Max development reached' }];
    
    // Even build rule
    const minHouses = Math.min(...group.map(id => (this.propertyStates[id]?.houses || 0)));
    if (state.houses > minHouses) return [{ type: 'error', message: 'Must build evenly' }];
    if (player.money < space.houseCost) return [{ type: 'error', message: 'Not enough money' }];
    
    player.pay(space.houseCost);
    state.houses++;
    const label = state.houses === 5 ? 'a hotel' : `house #${state.houses}`;
    return [{ type: 'houseBuilt', playerId, propertyId, houses: state.houses, message: `${player.name} built ${label} on ${space.name}` }];
  }

  sellHouse(playerId, propertyId) {
    const player = this.getPlayer(playerId);
    if (!player || player.id !== this.currentPlayer.id) return null;
    const space = BOARD[propertyId];
    const state = this.propertyStates[propertyId];
    if (!state || state.ownerId !== playerId || state.houses <= 0) return [{ type: 'error', message: 'Cannot sell' }];
    
    const group = COLOR_GROUPS[space.color];
    const maxHouses = Math.max(...group.map(id => (this.propertyStates[id]?.houses || 0)));
    if (state.houses < maxHouses) return [{ type: 'error', message: 'Must sell evenly' }];
    
    state.houses--;
    player.receive(Math.floor(space.houseCost / 2));
    return [{ type: 'houseSold', playerId, propertyId, houses: state.houses }];
  }

  mortgageProperty(playerId, propertyId) {
    const player = this.getPlayer(playerId);
    if (!player || player.id !== this.currentPlayer.id) return null;
    const space = BOARD[propertyId];
    const state = this.propertyStates[propertyId];
    if (!state || state.ownerId !== playerId || state.mortgaged) return [{ type: 'error', message: 'Cannot mortgage' }];
    if (state.houses > 0) return [{ type: 'error', message: 'Sell houses first' }];
    
    state.mortgaged = true;
    player.receive(space.mortgage);
    return [{ type: 'propertyMortgaged', playerId, propertyId, message: `${player.name} mortgaged ${space.name} for $${space.mortgage}` }];
  }

  unmortgageProperty(playerId, propertyId) {
    const player = this.getPlayer(playerId);
    if (!player || player.id !== this.currentPlayer.id) return null;
    const space = BOARD[propertyId];
    const state = this.propertyStates[propertyId];
    if (!state || state.ownerId !== playerId || !state.mortgaged) return [{ type: 'error', message: 'Cannot unmortgage' }];
    
    const cost = Math.floor(space.mortgage * 1.1);
    if (player.money < cost) return [{ type: 'error', message: 'Not enough money' }];
    
    state.mortgaged = false;
    player.pay(cost);
    return [{ type: 'propertyUnmortgaged', playerId, propertyId, message: `${player.name} unmortgaged ${space.name}` }];
  }

  payJailFine(playerId) {
    const player = this.currentPlayer;
    if (player.id !== playerId || !player.inJail) return null;
    if (player.money < 50) return [{ type: 'error', message: 'Not enough money' }];
    player.pay(50);
    player.getOutOfJail();
    player.hasRolled = false;
    return [{ type: 'notification', message: `${player.name} paid $50 to get out of jail.` }];
  }

  useJailCard(playerId) {
    const player = this.currentPlayer;
    if (player.id !== playerId || !player.inJail || player.jailCards <= 0) return null;
    player.jailCards--;
    player.getOutOfJail();
    player.hasRolled = false;
    return [{ type: 'notification', message: `${player.name} used a Get Out of Jail Free card!` }];
  }

  endTurn(playerId) {
    const player = this.currentPlayer;
    if (player.id !== playerId) return null;
    if (!player.hasRolled) return [{ type: 'error', message: 'Must roll dice first' }];
    if (this.pendingAction === 'buyOrAuction') return [{ type: 'error', message: 'Must buy or decline property first' }];
    
    player.hasRolled = false;
    player.doublesCount = 0;
    this.pendingAction = null;

    // Next player
    do {
      this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    } while (this.currentPlayer.bankrupt && this.activePlayers().length > 1);

    // Check win
    const active = this.activePlayers();
    if (active.length === 1) {
      this.gameOver = true;
      this.winnerId = active[0].id;
      return [{ type: 'gameOver', winnerId: this.winnerId, winnerName: active[0].name }];
    }

    this.addLog(`${this.currentPlayer.name}'s turn.`);
    return [{ type: 'turnChanged', currentPlayer: this.currentPlayer.id }];
  }

  proposeTrade(fromId, toId, offer, request) {
    const from = this.getPlayer(fromId);
    const to = this.getPlayer(toId);
    if (!from || !to) return null;
    const tradeId = Date.now().toString(36);
    const trade = { id: tradeId, fromId, toId, offer, request, status: 'pending' };
    this.trades.push(trade);
    return [{ type: 'tradeProposed', trade }];
  }

  respondTrade(playerId, tradeId, accept) {
    const trade = this.trades.find(t => t.id === tradeId && t.status === 'pending');
    if (!trade || trade.toId !== playerId) return null;
    
    if (!accept) {
      trade.status = 'rejected';
      return [{ type: 'tradeRejected', tradeId }];
    }

    const from = this.getPlayer(trade.fromId);
    const to = this.getPlayer(trade.toId);
    
    // Transfer money
    if (trade.offer.money) { from.pay(trade.offer.money); to.receive(trade.offer.money); }
    if (trade.request.money) { to.pay(trade.request.money); from.receive(trade.request.money); }
    
    // Transfer properties
    if (trade.offer.properties) {
      trade.offer.properties.forEach(pid => {
        from.removeProperty(pid); to.addProperty(pid);
        this.propertyStates[pid].ownerId = to.id;
      });
    }
    if (trade.request.properties) {
      trade.request.properties.forEach(pid => {
        to.removeProperty(pid); from.addProperty(pid);
        this.propertyStates[pid].ownerId = from.id;
      });
    }
    
    trade.status = 'accepted';
    return [{ type: 'tradeCompleted', tradeId, fromName: from.name, toName: to.name }];
  }

  _handleBankruptcy(player, creditorId) {
    const events = [];
    // Simple bankruptcy - player loses everything
    player.bankrupt = true;
    if (creditorId) {
      const creditor = this.getPlayer(creditorId);
      if (creditor) {
        player.properties.forEach(pid => {
          creditor.addProperty(pid);
          this.propertyStates[pid].ownerId = creditor.id;
        });
        if (player.money > 0) creditor.receive(player.money);
      }
    } else {
      player.properties.forEach(pid => { delete this.propertyStates[pid]; });
    }
    player.properties = [];
    player.money = 0;
    events.push({ type: 'playerBankrupt', playerId: player.id, playerName: player.name });
    
    const active = this.activePlayers();
    if (active.length === 1) {
      this.gameOver = true;
      this.winnerId = active[0].id;
      events.push({ type: 'gameOver', winnerId: this.winnerId, winnerName: active[0].name });
    }
    return events;
  }

  activePlayers() { return this.players.filter(p => !p.bankrupt); }

  addLog(msg) { this.log.push({ time: Date.now(), message: msg }); }

  getState() {
    return {
      roomCode: this.roomCode,
      started: this.started,
      gameOver: this.gameOver,
      winnerId: this.winnerId,
      currentPlayerIndex: this.currentPlayerIndex,
      currentPlayerId: this.currentPlayer?.id,
      players: this.players.map(p => p.serialize()),
      propertyStates: { ...this.propertyStates },
      lastDice: this.lastDice,
      pendingAction: this.pendingAction,
      log: this.log.slice(-20),
    };
  }
}

module.exports = GameEngine;
