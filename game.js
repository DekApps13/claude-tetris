'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
  '#9e9e9e', // N - tuerca (gris metálico)
];

const SKINS = {
  retro: {
    name: 'Retro',
    colors: COLORS,
    draw(ctx, x, y, colorIndex, size, alpha) {
      const color = this.colors[colorIndex];
      ctx.globalAlpha = alpha ?? 1;
      ctx.fillStyle = color;
      ctx.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(x * size + 1, y * size + 1, size - 2, 4);
      ctx.globalAlpha = 1;
    },
  },
  neon: {
    name: 'Neón',
    colors: [null, '#18ffff', '#ffea00', '#e040fb', '#00e676', '#ff1744', '#2979ff', '#ff9100', '#9e9e9e'],
    draw(ctx, x, y, colorIndex, size, alpha) {
      const color = this.colors[colorIndex];
      ctx.globalAlpha = alpha ?? 1;
      ctx.shadowBlur = 8;
      ctx.shadowColor = color;
      ctx.fillStyle = color;
      ctx.fillRect(x * size + 3, y * size + 3, size - 6, size - 6);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    },
  },
  pastel: {
    name: 'Pastel',
    colors: [null, '#a7e0e6', '#f5e6a8', '#d9b8e0', '#b6d9b8', '#e8b6b6', '#b8cde8', '#f0d0a8', '#9e9e9e'],
    draw(ctx, x, y, colorIndex, size, alpha) {
      const color = this.colors[colorIndex];
      ctx.globalAlpha = alpha ?? 1;
      ctx.fillStyle = color;
      const px = x * size + 1, py = y * size + 1, s = size - 2, r = Math.min(6, s / 3);
      if (typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(px, py, s, s, r);
        ctx.fill();
      } else {
        ctx.fillRect(px, py, s, s);
      }
      ctx.globalAlpha = 1;
    },
  },
  pixel: {
    name: 'Pixel',
    colors: COLORS,
    draw(ctx, x, y, colorIndex, size, alpha) {
      const color = this.colors[colorIndex];
      ctx.globalAlpha = alpha ?? 1;
      ctx.fillStyle = color;
      ctx.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      const q = (size - 2) / 4;
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          ctx.fillStyle = ((x + y + i + j) % 2)
            ? 'rgba(255,255,255,0.18)'
            : 'rgba(0,0,0,0.18)';
          ctx.fillRect(x * size + 1 + i * q, y * size + 1 + j * q, q, q);
        }
      }
      ctx.globalAlpha = 1;
    },
  },
};

let currentSkin = 'retro';

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // N (tuerca)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const pauseMenu = document.getElementById('pause-menu');
const pauseControls = document.getElementById('pause-controls');
const resumeBtn = document.getElementById('resume-btn');
const menuRestartBtn = document.getElementById('menu-restart-btn');
const controlsBtn = document.getElementById('controls-btn');
const startLevelSelect = document.getElementById('start-level');
const saveScoreBox = document.getElementById('save-score');
const playerNameInput = document.getElementById('player-name');
const saveScoreBtn = document.getElementById('save-score-btn');
const overlayScoresTable = document.getElementById('overlay-scores');
const startScreen = document.getElementById('start-screen');
const startScoresTable = document.getElementById('start-scores');
const playBtn = document.getElementById('play-btn');
const clearScoresBtn = document.getElementById('clear-scores-btn');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId, combo, bestCombo;
let started = false;

/* ---- Tabla de records local ---- */
const HISCORE_KEY = 'tetris-highscores';
const MAX_SCORES = 5;

function loadScores() {
  try {
    const raw = localStorage.getItem(HISCORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(e => e && typeof e.score === 'number')
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_SCORES);
  } catch (e) {
    return [];
  }
}

function saveScore(entry) {
  try {
    const scores = loadScores();
    scores.push(entry);
    scores.sort((a, b) => b.score - a.score);
    const top = scores.slice(0, MAX_SCORES);
    localStorage.setItem(HISCORE_KEY, JSON.stringify(top));
    return top;
  } catch (e) {
    return loadScores();
  }
}

function resetScores() {
  try {
    localStorage.removeItem(HISCORE_KEY);
  } catch (e) {
    /* ignora */
  }
}

function qualifies(s) {
  if (s <= 0) return false;
  const scores = loadScores();
  if (scores.length < MAX_SCORES) return true;
  return s > scores[scores.length - 1].score;
}

function renderScoresTable(table, highlightEntry) {
  const scores = loadScores();
  const tbody = table.querySelector('tbody');
  tbody.innerHTML = '';
  scores.forEach((e, i) => {
    const tr = document.createElement('tr');
    if (highlightEntry && e.name === highlightEntry.name && e.score === highlightEntry.score && e.date === highlightEntry.date) {
      tr.classList.add('highlight');
    }
    [i + 1, e.score.toLocaleString(), e.name, e.lines, e.combo].forEach(val => {
      const td = document.createElement('td');
      td.textContent = val;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

const START_LEVEL_KEY = 'tetris-start-level';
let startLevel = 1;

function getStartLevel() {
  return startLevel;
}

function setStartLevel(n) {
  const v = Math.min(15, Math.max(1, Math.floor(Number(n) || 1)));
  startLevel = v;
  try {
    localStorage.setItem(START_LEVEL_KEY, String(v));
  } catch (e) { /* ignore */ }
  if (startLevelSelect) startLevelSelect.value = String(v);
  return v;
}

(function loadStartLevel() {
  let stored = null;
  try {
    stored = localStorage.getItem(START_LEVEL_KEY);
  } catch (e) { /* ignore */ }
  const parsed = parseInt(stored, 10);
  if (!Number.isNaN(parsed)) startLevel = Math.min(15, Math.max(1, parsed));
})();

if (startLevelSelect) {
  for (let i = 1; i <= 15; i++) {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = 'Nivel ' + i;
    startLevelSelect.appendChild(opt);
  }
  startLevelSelect.value = String(startLevel);
  startLevelSelect.addEventListener('change', () => {
    setStartLevel(startLevelSelect.value);
  });
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.max(startLevel, Math.floor(lines / 10) + 1);
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    combo++;
    bestCombo = Math.max(bestCombo, combo);
    updateHUD();
  }
  return cleared;
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  const cleared = clearLines();
  if (!cleared) combo = 0;
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  (SKINS[currentSkin] || SKINS.retro).draw(context, x, y, colorIndex, size, alpha);
}

function drawGrid() {
  ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--grid-line').trim();
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  if (!board) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  if (!current) return;

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  if (!next) return;
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;

  let savedEntry = null;
  saveScoreBtn.disabled = false;

  if (qualifies(score)) {
    saveScoreBox.classList.remove('hidden');
    playerNameInput.value = '';
    saveScoreBtn.onclick = () => {
      if (savedEntry || saveScoreBtn.disabled) return;
      const name = playerNameInput.value.trim() || 'ANON';
      savedEntry = { name, score, lines, combo: bestCombo, date: Date.now() };
      saveScore(savedEntry);
      saveScoreBtn.disabled = true;
      playerNameInput.disabled = true;
      overlayScoresTable.classList.remove('hidden');
      renderScoresTable(overlayScoresTable, savedEntry);
    };
    playerNameInput.disabled = false;
  } else {
    saveScoreBox.classList.add('hidden');
  }

  overlayScoresTable.classList.remove('hidden');
  renderScoresTable(overlayScoresTable, null);
  overlay.classList.remove('hidden');
}

function showStartScreen() {
  renderScoresTable(startScoresTable, null);
  startScreen.classList.remove('hidden');
}

function togglePause() {
  if (gameOver || !started) return;
  paused = !paused;
  if (!paused) {
    pauseMenu.classList.add('hidden');
    pauseControls.classList.add('hidden');
    dropAccum = 0;
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    pauseMenu.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  if (gameOver) return;
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  started = true;
  board = createBoard();
  score = 0;
  lines = 0;
  level = startLevel;
  paused = false;
  gameOver = false;
  combo = 0;
  bestCombo = 0;
  dropInterval = Math.max(100, 1000 - (startLevel - 1) * 90);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  pauseMenu.classList.add('hidden');
  pauseControls.classList.add('hidden');
  saveScoreBox.classList.add('hidden');
  overlayScoresTable.classList.add('hidden');
  saveScoreBtn.disabled = false;
  playerNameInput.disabled = false;
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
  if (!started || paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

resumeBtn.addEventListener('click', togglePause);

menuRestartBtn.addEventListener('click', () => {
  pauseMenu.classList.add('hidden');
  pauseControls.classList.add('hidden');
  init();
});

controlsBtn.addEventListener('click', () => {
  pauseControls.classList.toggle('hidden');
});

playBtn.addEventListener('click', () => {
  startScreen.classList.add('hidden');
  init();
});

clearScoresBtn.addEventListener('click', () => {
  if (confirm('¿Borrar todos los records?')) {
    resetScores();
    renderScoresTable(startScoresTable, null);
  }
});

const themeToggle = document.getElementById('theme-toggle');
const toggleIcon = themeToggle.querySelector('.toggle-icon');
const toggleLabel = themeToggle.querySelector('.toggle-label');

function applyTheme(isLight) {
  if (isLight) {
    document.body.classList.add('light-mode');
    toggleIcon.textContent = '☀';
    toggleLabel.textContent = 'DARK';
  } else {
    document.body.classList.remove('light-mode');
    toggleIcon.textContent = '☾';
    toggleLabel.textContent = 'LIGHT';
  }
}

const savedTheme = localStorage.getItem('tetris-theme');
applyTheme(savedTheme === 'light');

themeToggle.addEventListener('click', () => {
  const isLight = !document.body.classList.contains('light-mode');
  applyTheme(isLight);
  localStorage.setItem('tetris-theme', isLight ? 'light' : 'dark');
});

const skinSelect = document.getElementById('skin-select');

function applySkin(skin) {
  if (!SKINS[skin]) skin = 'retro';
  currentSkin = skin;
  document.body.dataset.skin = skin;
  if (skinSelect) skinSelect.value = skin;
  draw();
  drawNext();
}

let savedSkin = 'retro';
try {
  savedSkin = localStorage.getItem('tetris-skin') || 'retro';
} catch (e) { /* ignore */ }
applySkin(savedSkin);

if (skinSelect) {
  skinSelect.addEventListener('change', () => {
    applySkin(skinSelect.value);
    try {
      localStorage.setItem('tetris-skin', currentSkin);
    } catch (e) { /* ignore */ }
  });
}

showStartScreen();
