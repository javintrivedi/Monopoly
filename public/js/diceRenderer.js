// diceRenderer.js - Dice animation
class DiceRenderer {
  constructor() {
    this.die1 = document.getElementById('die1');
    this.die2 = document.getElementById('die2');
  }

  getRotation(number) {
    // We add multiple of 360deg for extra spins to make it look realistic when it settles
    const extraSpinsX = 360 * 2;
    const extraSpinsY = 360 * 2;
    switch (number) {
      case 1: return `rotateX(${extraSpinsX}deg) rotateY(${extraSpinsY}deg)`;
      case 2: return `rotateX(${extraSpinsX}deg) rotateY(${180 + extraSpinsY}deg)`;
      case 3: return `rotateX(${extraSpinsX}deg) rotateY(${-90 + extraSpinsY}deg)`;
      case 4: return `rotateX(${extraSpinsX}deg) rotateY(${90 + extraSpinsY}deg)`;
      case 5: return `rotateX(${-90 + extraSpinsX}deg) rotateY(${extraSpinsY}deg)`;
      case 6: return `rotateX(${90 + extraSpinsX}deg) rotateY(${extraSpinsY}deg)`;
      default: return 'rotateX(0deg) rotateY(0deg)';
    }
  }

  roll(d1, d2) {
    return new Promise(resolve => {
      // First, remove inline transform to let the rolling animation run
      this.die1.style.transform = '';
      this.die2.style.transform = '';
      
      this.die1.classList.add('rolling');
      this.die2.classList.add('rolling');

      setTimeout(() => {
        this.die1.classList.remove('rolling');
        this.die2.classList.remove('rolling');
        
        // Apply final rotation
        this.die1.style.transform = this.getRotation(d1);
        this.die2.style.transform = this.getRotation(d2);
        
        // Wait for final CSS transition to finish settling
        setTimeout(resolve, 1000);
      }, 600); // 0.6s rolling animation duration
    });
  }

  reset() {
    this.die1.style.transform = 'rotateX(0deg) rotateY(0deg)';
    this.die2.style.transform = 'rotateX(0deg) rotateY(0deg)';
  }
}
