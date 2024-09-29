let isMacOS = false;
const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

let iDevice = false;
if (isBrowser && navigator.platform) {
  iDevice = navigator.platform.match(/^iP/); 
}

if (isBrowser) {
  const os = navigator.platform.toLowerCase();
  isMacOS = os.includes('mac');
  console.log(isMacOS ? "Running on macOS or iOS." : "Running in a browser environment.");
}

const numbers = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣'];

let feedback;
if (isBrowser) {
  feedback = document.querySelector('.feedback');
}

class Game {
  constructor(cols, rows, number_of_bombs, set) {
    this.cols = Number(cols);
    this.rows = Number(rows);
    this.number_of_bombs = Number(number_of_bombs);
    this.number_of_cells = this.cols * this.rows;

    this.map = isBrowser ? document.getElementById('map') : null;

    if (this.number_of_cells > 2500 || this.number_of_bombs >= this.number_of_cells) {
      alert('Invalid game size or bomb count');
      return;
    }

    this.emojiset = set;
    this.numbermoji = [this.emojiset[0]].concat(numbers);
    this.usetwemoji = false;
    this.init();
  }

  init() {
    if (!isBrowser) return;

    this.prepareEmoji();
    this.map.innerHTML = '';
    const grid_data = this.bomb_array();

    let row = document.createElement('div');
    row.classList.add('row');

    grid_data.forEach((isBomb, i) => {
      const cell = this.createCell(i, isBomb, grid_data);
      row.appendChild(cell);

      if ((i + 1) % this.cols === 0) {
        this.map.appendChild(row);
        row = document.createElement('div');
        row.classList.add('row');
      }
    });

    this.resetMetadata();
    this.bindEvents();
    this.updateBombsLeft();
  }

  createCell(i, isBomb, grid_data) {
    const cellWrapper = document.createElement('span');
    cellWrapper.classList.add('cell-wrapper');

    const x = (i % this.cols) + 1;
    const y = Math.ceil((i + 1) / this.cols);
    const neighbors_coords = this.getNeighbors(x, y);

    const mine = this.mine(isBomb, neighbors_coords, grid_data, x, y);
    cellWrapper.appendChild(mine);

    return cellWrapper;
  }

  getNeighbors(x, y) {
    return [
      [x, y - 1], [x, y + 1],
      [x - 1, y - 1], [x - 1, y], [x - 1, y + 1],
      [x + 1, y - 1], [x + 1, y], [x + 1, y + 1]
    ];
  }

  mine(isBomb, neighbors_coords, grid_data, x, y) {
    const mine = document.createElement('button');
    mine.type = 'button';
    mine.className = `cell x${x} y${y}`;
    mine.isMasked = true;
    mine.isBomb = isBomb;
    mine.isFlagged = false;

    if (!isBomb) {
      const neighbors = neighbors_coords.map(([nx, ny]) => this.getIndex(nx, ny) !== -1 ? grid_data[this.getIndex(nx, ny)] : false);
      mine.mine_count = neighbors.filter(Boolean).length;
    }

    mine.reveal = this.reveal.bind(this, mine);
    mine.appendChild(document.createTextNode(this.emojiset[3]));

    return mine;
  }

  reveal(mine, won = false) {
    const emoji = mine.isBomb ? (won ? this.emojiset[2] : this.emojiset[1]) : this.numbermoji[mine.mine_count];
    const text = mine.isBomb ? (won ? "Bomb discovered" : "Boom!") : (mine.mine_count === 0 ? "Empty field" : `${mine.mine_count} bombs nearby`);

    mine.innerHTML = emoji;
    mine.setAttribute('aria-label', text);
    mine.isMasked = false;
    mine.classList.add('unmasked');

    if (mine.mine_count === 0 && !mine.isBomb) {
      this.revealNeighbors(mine);
    }
  }

  getIndex(x, y) {
    return x > this.cols || x <= 0 || y > this.rows || y <= 0 ? -1 : this.cols * (y - 1) + (x - 1);
  }

  revealNeighbors(mine) {
    const x = parseInt(mine.classList[1].substring(1));  
    const y = parseInt(mine.classList[2].substring(1));  

    const neighbors_coords = this.getNeighbors(x, y);

    neighbors_coords.forEach(([nx, ny]) => {
      const neighbor = document.querySelector(`.x${nx}.y${ny}`);
      if (neighbor && neighbor.isMasked && !neighbor.isFlagged) {
        neighbor.reveal();
      }
    });
  }

  bindEvents() {
    if (!isBrowser) return;

    Array.from(document.getElementsByClassName('cell')).forEach(cell => {
      cell.addEventListener('click', evt => this.onClick(cell, evt));
      cell.addEventListener('dblclick', () => this.onDoubleClick(cell));
      cell.addEventListener('contextmenu', evt => this.onRightClick(cell, evt));

      if (iDevice) {
        cell.addEventListener('touchstart', () => {
          this.holding = setTimeout(() => cell.dispatchEvent(new Event('contextmenu')), 500);
        });
        cell.addEventListener('touchend', () => clearTimeout(this.holding));
      }
    });

    window.addEventListener('keydown', evt => {
      if (evt.key === 'r' || evt.key === 'R') {
        this.restart();
      }
    });
  }

  onClick(cell, evt) {
    if (!cell.isMasked || cell.isFlagged) return;
    if (document.getElementsByClassName('unmasked').length === 0) {
      this.startTimer();
    }

    if (cell.isBomb) {
      this.reveal(cell);
      this.checkGameStatus();
      return;
    }

    cell.reveal();
    this.updateFeedback(cell.getAttribute('aria-label'));
    if (cell.mine_count === 0 && !cell.isBomb) this.revealNeighbors(cell);
    this.checkGameStatus();
  }

  onDoubleClick(cell) {
    if (cell.isFlagged) return;
    this.moveIt();
    cell.reveal();
    this.revealNeighbors(cell);
    this.checkGameStatus();
  }

  onRightClick(cell, evt) {
    evt.preventDefault();
    if (!cell.isMasked) return;
    cell.isFlagged = !cell.isFlagged;
    const emoji = cell.isFlagged ? this.emojiset[2] : this.emojiset[3];
    const label = cell.isFlagged ? 'Flagged as potential bomb' : 'Field';

    cell.innerHTML = emoji;
    cell.setAttribute('aria-label', label);
    this.updateFeedback(cell.isFlagged ? 'Flagged as potential bomb' : 'Unflagged as potential bomb');
    this.updateBombsLeft();
  }

  checkGameStatus() {
    const cells = document.getElementsByClassName('cell');
    const masked = Array.from(cells).filter(cell => cell.isMasked);
    const bombs = Array.from(cells).filter(cell => cell.isBomb && !cell.isMasked);

    if (bombs.length > 0) {
      masked.forEach(cell => cell.reveal());
      this.endGame('lost');
    } else if (masked.length === this.number_of_bombs) {
      masked.forEach(cell => cell.reveal(true));
      this.endGame('won');
    }
  }

  endGame(result) {
    this.result = result;
    this.showMessage();
    clearInterval(this.timer);
  }

  bomb_array() {
    const data = Array(this.number_of_cells).fill(false);
    for (let i = 0; i < this.number_of_bombs; i++) data[i] = true;
    return data.sort(() => Math.random() - 0.5);
  }

  resetMetadata() {
    document.getElementById('timer').textContent = '0.00';
    document.getElementById('bombs').textContent = this.number_of_bombs;
    document.getElementById('moves').textContent = '0';
    document.querySelector('.wrapper').classList.remove('won', 'lost');
    document.querySelector('.result-emoji').textContent = '';
    document.querySelector('.default-emoji').textContent = 'Cuckoosweepers ';
    document.querySelector('.js-settings').style.display = 'none';
  }

  updateBombsLeft() {
    const bombsLeft = this.number_of_bombs - document.querySelectorAll('.cell[aria-label="Flagged as potential bomb"]').length;
    document.getElementById('bombs').textContent = bombsLeft;
  }

  updateFeedback(text) {
    if (feedback) {
      feedback.textContent = text;
    }
  }

  prepareEmoji() {
  }

  restart() {
    clearInterval(this.timer);
    this.timer = null;
    this.result = null;
    this.init();
  }

  showMessage() {
    const wrapper = document.querySelector('.wrapper');
    const resultEmoji = document.querySelector('.result-emoji');
    wrapper.classList.add(this.result);
    resultEmoji.textContent = this.result === 'won' ? 'You won!!! 😎' : 'You lost... 😵';
  }

  moveIt() {
    this.moves = (this.moves || 0) + 1;
    document.getElementById('moves').textContent = this.moves;
  }

  startTimer() {
    if (this.timer) return;
    this.startTime = new Date();
    this.timer = setInterval(() => {
      const elapsed = ((new Date() - this.startTime) / 1000).toFixed(2);
      document.getElementById('timer').textContent = elapsed;
    }, 100);
  }
}

// document.addEventListener('DOMContentLoaded', () => {
//   const emojiSet = ['🐣', '🐦‍⬛', '🧹', '⬜']; 
//   const game = new Game(10, 10, 10, emojiSet); 
// });
