// tradeUI.js - Trading interface
class TradeUI {
  constructor(uiManager, socket) {
    this.ui = uiManager;
    this.socket = socket;
  }

  openTradeModal(fromPlayer, toPlayer, propertyStates) {
    const myProps = (fromPlayer.properties || []).map(pid => {
      const s = BOARD_DATA[pid];
      return s ? `<div class="trade-prop-chip" data-pid="${pid}" data-side="offer">${s.name}</div>` : '';
    }).join('');

    const theirProps = (toPlayer.properties || []).map(pid => {
      const s = BOARD_DATA[pid];
      return s ? `<div class="trade-prop-chip" data-pid="${pid}" data-side="request">${s.name}</div>` : '';
    }).join('');

    const overlay = this.ui.showModal(`
      <h2>Trade with ${toPlayer.name}</h2>
      <div class="trade-section">
        <h4>Your Offer</h4>
        <div class="trade-props" id="tradeOfferProps">${myProps || '<span style="color:var(--text-muted);font-size:0.8rem">No properties</span>'}</div>
        <input type="number" class="trade-money-input" id="tradeOfferMoney" placeholder="$0" min="0" max="${fromPlayer.money}">
      </div>
      <div class="trade-section">
        <h4>You Request</h4>
        <div class="trade-props" id="tradeRequestProps">${theirProps || '<span style="color:var(--text-muted);font-size:0.8rem">No properties</span>'}</div>
        <input type="number" class="trade-money-input" id="tradeRequestMoney" placeholder="$0" min="0" max="${toPlayer.money}">
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="tradeCancelBtn">Cancel</button>
        <button class="btn btn-primary" id="tradeSubmitBtn">Propose Trade</button>
      </div>
    `);

    // Toggle selection
    overlay.querySelectorAll('.trade-prop-chip').forEach(chip => {
      chip.addEventListener('click', () => chip.classList.toggle('selected'));
    });

    overlay.querySelector('#tradeCancelBtn').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#tradeSubmitBtn').addEventListener('click', () => {
      const offerProps = [...overlay.querySelectorAll('.trade-prop-chip.selected[data-side="offer"]')].map(c => parseInt(c.dataset.pid));
      const requestProps = [...overlay.querySelectorAll('.trade-prop-chip.selected[data-side="request"]')].map(c => parseInt(c.dataset.pid));
      const offerMoney = parseInt(overlay.querySelector('#tradeOfferMoney').value) || 0;
      const requestMoney = parseInt(overlay.querySelector('#tradeRequestMoney').value) || 0;

      this.socket.send('proposeTrade', {
        toId: toPlayer.id,
        offer: { properties: offerProps, money: offerMoney },
        request: { properties: requestProps, money: requestMoney }
      });
      overlay.remove();
      this.ui.toast('Trade proposed!', 'info');
    });
  }

  showTradeProposal(trade, players) {
    const from = players.find(p => p.id === trade.fromId);
    if (!from) return;

    const offerPropsText = (trade.offer.properties || []).map(pid => BOARD_DATA[pid]?.name || pid).join(', ') || 'None';
    const requestPropsText = (trade.request.properties || []).map(pid => BOARD_DATA[pid]?.name || pid).join(', ') || 'None';

    const overlay = this.ui.showModal(`
      <h2>Trade Proposal from ${from.name}</h2>
      <div class="trade-section">
        <h4>They Offer</h4>
        <p style="font-size:0.9rem">${offerPropsText}${trade.offer.money ? ` + $${trade.offer.money}` : ''}</p>
      </div>
      <div class="trade-section">
        <h4>They Request</h4>
        <p style="font-size:0.9rem">${requestPropsText}${trade.request.money ? ` + $${trade.request.money}` : ''}</p>
      </div>
      <div class="modal-actions">
        <button class="btn btn-danger" id="tradeRejectBtn">Reject</button>
        <button class="btn btn-success" id="tradeAcceptBtn">Accept</button>
      </div>
    `);

    overlay.querySelector('#tradeRejectBtn').addEventListener('click', () => {
      this.socket.send('respondTrade', { tradeId: trade.id, accept: false });
      overlay.remove();
    });
    overlay.querySelector('#tradeAcceptBtn').addEventListener('click', () => {
      this.socket.send('respondTrade', { tradeId: trade.id, accept: true });
      overlay.remove();
    });
  }
}
