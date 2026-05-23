// game/Cards.js - Chance and Community Chest card decks

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const CHANCE_CARDS = [
  { id: 'ch1', text: 'Advance to Boardwalk', action: 'moveTo', destination: 39 },
  { id: 'ch2', text: 'Advance to GO – Collect $200', action: 'moveTo', destination: 0 },
  { id: 'ch3', text: 'Advance to Illinois Avenue', action: 'moveTo', destination: 24 },
  { id: 'ch4', text: 'Advance to St. Charles Place', action: 'moveTo', destination: 11 },
  { id: 'ch5', text: 'Advance to nearest Railroad – Pay double rent', action: 'nearestRailroad' },
  { id: 'ch6', text: 'Advance to nearest Railroad – Pay double rent', action: 'nearestRailroad' },
  { id: 'ch7', text: 'Advance to nearest Utility – Pay 10× dice roll', action: 'nearestUtility' },
  { id: 'ch8', text: 'Bank pays you dividend of $50', action: 'collect', amount: 50 },
  { id: 'ch9', text: 'Get Out of Jail Free', action: 'jailCard' },
  { id: 'ch10', text: 'Go Back 3 Spaces', action: 'moveBack', spaces: 3 },
  { id: 'ch11', text: 'Go to Jail – Do not pass GO', action: 'goToJail' },
  { id: 'ch12', text: 'Make general repairs – $25 per house, $100 per hotel', action: 'repairs', perHouse: 25, perHotel: 100 },
  { id: 'ch13', text: 'Speeding fine – Pay $15', action: 'pay', amount: 15 },
  { id: 'ch14', text: 'Take a trip to Reading Railroad', action: 'moveTo', destination: 5 },
  { id: 'ch15', text: 'You have been elected Chairman – Pay each player $50', action: 'payEach', amount: 50 },
  { id: 'ch16', text: 'Your building loan matures – Collect $150', action: 'collect', amount: 150 },
];

const COMMUNITY_CHEST_CARDS = [
  { id: 'cc1', text: 'Advance to GO – Collect $200', action: 'moveTo', destination: 0 },
  { id: 'cc2', text: 'Bank error in your favor – Collect $200', action: 'collect', amount: 200 },
  { id: 'cc3', text: "Doctor's fee – Pay $50", action: 'pay', amount: 50 },
  { id: 'cc4', text: 'From sale of stock you get $50', action: 'collect', amount: 50 },
  { id: 'cc5', text: 'Get Out of Jail Free', action: 'jailCard' },
  { id: 'cc6', text: 'Go to Jail – Do not pass GO', action: 'goToJail' },
  { id: 'cc7', text: 'Holiday fund matures – Receive $100', action: 'collect', amount: 100 },
  { id: 'cc8', text: 'Income tax refund – Collect $20', action: 'collect', amount: 20 },
  { id: 'cc9', text: 'It is your birthday – Collect $10 from each player', action: 'collectEach', amount: 10 },
  { id: 'cc10', text: 'Life insurance matures – Collect $100', action: 'collect', amount: 100 },
  { id: 'cc11', text: 'Pay hospital fees of $100', action: 'pay', amount: 100 },
  { id: 'cc12', text: 'Pay school fees of $50', action: 'pay', amount: 50 },
  { id: 'cc13', text: 'Receive $25 consultancy fee', action: 'collect', amount: 25 },
  { id: 'cc14', text: 'Assessed for street repair – $40 per house, $115 per hotel', action: 'repairs', perHouse: 40, perHotel: 115 },
  { id: 'cc15', text: 'You have won second prize in a beauty contest – Collect $10', action: 'collect', amount: 10 },
  { id: 'cc16', text: 'You inherit $100', action: 'collect', amount: 100 },
];

class CardDeck {
  constructor(cards) {
    this.original = cards;
    this.deck = shuffle(cards);
    this.jailCardsOut = 0;
  }

  draw() {
    if (this.deck.length === 0) {
      this.deck = shuffle(this.original.filter(c => c.action !== 'jailCard' || this.jailCardsOut === 0));
    }
    const card = this.deck.shift();
    if (card.action === 'jailCard') this.jailCardsOut++;
    return card;
  }

  returnJailCard() {
    this.jailCardsOut--;
  }
}

module.exports = { CHANCE_CARDS, COMMUNITY_CHEST_CARDS, CardDeck };
