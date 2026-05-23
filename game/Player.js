// game/Player.js - Player state management

class Player {
  constructor(id, name, token) {
    this.id = id;
    this.name = name;
    this.token = token;
    this.position = 0;
    this.money = 1500;
    this.properties = [];
    this.inJail = false;
    this.jailTurns = 0;
    this.jailCards = 0; // Get Out of Jail Free cards
    this.bankrupt = false;
    this.doublesCount = 0;
    this.hasRolled = false;
    this.connected = true;
  }

  pay(amount) {
    this.money -= amount;
    return this.money >= 0;
  }

  receive(amount) {
    this.money += amount;
  }

  moveTo(position) {
    const oldPos = this.position;
    this.position = position;
    // Check if passed GO
    if (position < oldPos && position !== 0) {
      return true; // passed GO
    }
    return position === 0 && oldPos !== 0;
  }

  moveForward(spaces) {
    const oldPos = this.position;
    this.position = (this.position + spaces) % 40;
    return this.position < oldPos; // passed GO
  }

  goToJail() {
    this.position = 10;
    this.inJail = true;
    this.jailTurns = 0;
  }

  getOutOfJail() {
    this.inJail = false;
    this.jailTurns = 0;
  }

  addProperty(propertyId) {
    this.properties.push(propertyId);
  }

  removeProperty(propertyId) {
    this.properties = this.properties.filter(p => p !== propertyId);
  }

  totalAssets(board, propertyStates) {
    let total = this.money;
    for (const pid of this.properties) {
      const space = board[pid];
      const state = propertyStates[pid];
      if (state && !state.mortgaged) {
        total += space.mortgage || 0;
      }
      if (state && state.houses > 0) {
        total += state.houses * (space.houseCost / 2);
      }
    }
    return total;
  }

  serialize() {
    return {
      id: this.id,
      name: this.name,
      token: this.token,
      position: this.position,
      money: this.money,
      properties: [...this.properties],
      inJail: this.inJail,
      jailTurns: this.jailTurns,
      jailCards: this.jailCards,
      bankrupt: this.bankrupt,
      hasRolled: this.hasRolled,
      connected: this.connected,
    };
  }
}

module.exports = Player;
