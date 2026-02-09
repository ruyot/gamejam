'use strict';

const blessed = require('blessed');
const { loadScores, saveScore } = require('../lib/highscore');

const MAZE_TEMPLATE = [
  '###########################',
  '#o....#.........#....#...o#',
  '#.##.#.#####.#.#.#####.#..#',
  '#....#.....#.#.#.....#....#',
  '####.###.#.#.#.#.#.###.####',
  '#......#.#.....#.#......#.#',
  '#.######.#### ####.######.#',
  '#...........   ...........#',
  '###.###.### ##### ###.###.#',
  '#.#.#.#.# ### ### #.#.#.#.#',
  '#...#...#   G G   #...#...#',
  '#.#.#.#.# ####### #.#.#.#.#',
  '#...........   ...........#',
  '#.######.#### ###.######..#',
  '#o....#...P...#.......#..o#',
  '###.#.#.#####.#.#####.#.###',
  '#...#.#.....#.#.#.....#...#',
  '#.###.#####.#.#.#.#####.###',
  '###########################',
];

const DIRECTIONS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE_DIRECTION = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

const MODE_SEQUENCE = [
  { name: 'scatter', duration: 7000 },
  { name: 'chase', duration: 20000 },
  { name: 'scatter', duration: 7000 },
  { name: 'chase', duration: 20000 },
  { name: 'random', duration: Number.POSITIVE_INFINITY },
];

const GHOST_COLORS = ['#ff5f5f', '#ff87d7', '#5fd7ff', '#ffaf5f'];

const FRAME_WIDTH = 82;
const FRAME_HEIGHT = 32;
const MIN_TERMINAL_WIDTH = 72;
const MIN_TERMINAL_HEIGHT = 30;

class ChompyGame {
  constructor(screen, { onExit }) {
    this.screen = screen;
    this.onExit = onExit;

    this.active = false;
    this.loop = null;
    this.pendingTimer = null;
    this.frameCounter = 0;
    this.lastTick = 0;

    this.level = 1;
    this.score = 0;
    this.lives = 3;

    const scores = loadScores();
    this.highScore = Number(scores.chompy || 0);

    this.state = 'running';
    this.statusText = 'Collect all pellets and avoid ghosts.';

    this.modeIndex = 0;
    this.modeElapsed = 0;
    this.powerTimer = 0;
    this.invulnerableTimer = 0;
    this.respawnTimer = 0;
    this.ghostCombo = 0;
    this.playerAccumulator = 0;
    this.ghostAccumulator = 0;

    this.maze = parseMaze(MAZE_TEMPLATE);
    this.mazeWidth = this.maze.width;
    this.mazeHeight = this.maze.height;

    this.onKeypress = this.onKeypress.bind(this);
  }

  mount() {
    this.active = true;
    this.createLayout();
    this.loadLevel();
    this.lastTick = Date.now();

    this.screen.on('keypress', this.onKeypress);
    this.loop = setInterval(() => this.tick(), 33);
    this.render();
  }

  createLayout() {
    this.root = blessed.box({
      parent: this.screen,
      width: '100%',
      height: '100%',
      style: { bg: 16 },
    });

    this.frame = blessed.box({
      parent: this.root,
      top: 'center',
      left: 'center',
      width: FRAME_WIDTH,
      height: FRAME_HEIGHT,
      border: 'line',
      tags: true,
      style: {
        fg: 230,
        bg: 17,
        border: { fg: 45 },
      },
    });

    this.titleBox = blessed.box({
      parent: this.frame,
      top: 1,
      left: 2,
      width: '100%-4',
      height: 1,
      tags: true,
      align: 'center',
      content: '{#93c5fd-fg}█ CHOMPY █{/}',
    });

    this.hudBox = blessed.box({
      parent: this.frame,
      top: 3,
      left: 2,
      width: '100%-4',
      height: 2,
      tags: true,
    });

    this.boardBox = blessed.box({
      parent: this.frame,
      top: 7,
      left: 'center',
      width: this.mazeWidth + 2,
      height: this.mazeHeight + 2,
      border: 'line',
      tags: true,
      style: {
        border: { fg: 38 },
      },
    });

    this.statusBox = blessed.box({
      parent: this.frame,
      top: 28,
      left: 2,
      width: '100%-4',
      height: 2,
      tags: true,
      align: 'center',
    });

    this.footerBox = blessed.box({
      parent: this.frame,
      bottom: 1,
      left: 2,
      width: '100%-4',
      height: 1,
      tags: true,
      align: 'center',
      content:
        '{#7dd3fc-fg}[Arrows/WASD]{/} Move  {#fde68a-fg}[P/Space]{/} Pause  {#fda4af-fg}[R]{/} Restart  {#fecaca-fg}[Q/Esc]{/} Menu',
    });

    this.resizeBox = blessed.box({
      parent: this.root,
      top: 'center',
      left: 'center',
      width: 58,
      height: 6,
      border: 'line',
      tags: true,
      hidden: true,
      style: {
        bg: 17,
        border: { fg: 197 },
      },
      align: 'center',
      valign: 'middle',
      content:
        '{#fecaca-fg}Terminal too small for GameJam{/}\nResize to at least {#fde68a-fg}72x30{/}.',
    });
  }

  loadLevel() {
    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }

    this.maze = parseMaze(MAZE_TEMPLATE);
    this.grid = this.maze.grid;
    this.pellets = new Set(this.maze.pellets);
    this.powerPellets = new Set(this.maze.powerPellets);

    this.playerStart = { ...this.maze.playerStart };
    this.player = {
      x: this.playerStart.x,
      y: this.playerStart.y,
      dir: 'left',
      nextDir: 'left',
    };

    const corners = [
      { x: 1, y: 1 },
      { x: this.mazeWidth - 2, y: 1 },
      { x: 1, y: this.mazeHeight - 2 },
      { x: this.mazeWidth - 2, y: this.mazeHeight - 2 },
    ];

    const ghostStarts = expandGhostStarts(this.maze.ghostStarts, this.grid);
    this.ghosts = ghostStarts.map((start, index) => ({
      id: index + 1,
      x: start.x,
      y: start.y,
      startX: start.x,
      startY: start.y,
      dir: index % 2 === 0 ? 'left' : 'right',
      color: GHOST_COLORS[index % GHOST_COLORS.length],
      scatterTarget: corners[index % corners.length],
      releaseDelay: index * 350,
    }));

    this.playerStepMs = Math.max(70, 130 - (this.level - 1) * 5);
    this.ghostStepMs = Math.max(80, 155 - (this.level - 1) * 6);

    this.modeIndex = 0;
    this.modeElapsed = 0;
    this.powerTimer = 0;
    this.invulnerableTimer = 1000;
    this.respawnTimer = 900;
    this.ghostCombo = 0;
    this.playerAccumulator = 0;
    this.ghostAccumulator = 0;
    this.state = 'running';
    this.statusText = `Level ${this.level} begins.`;
  }

  tick() {
    if (!this.active) {
      return;
    }

    const now = Date.now();
    const dt = Math.min(120, now - this.lastTick);
    this.lastTick = now;
    this.frameCounter += 1;

    if (this.state === 'running') {
      this.updateRunning(dt);
    }

    this.render();
  }

  updateRunning(dt) {
    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer = Math.max(0, this.invulnerableTimer - dt);
    }

    if (this.respawnTimer > 0) {
      this.respawnTimer = Math.max(0, this.respawnTimer - dt);
      return;
    }

    if (this.powerTimer > 0) {
      this.powerTimer = Math.max(0, this.powerTimer - dt);
      if (this.powerTimer === 0) {
        this.ghostCombo = 0;
        this.statusText = 'Power mode faded.';
      }
    } else {
      this.modeElapsed += dt;
      while (
        this.modeIndex < MODE_SEQUENCE.length - 1 &&
        this.modeElapsed >= MODE_SEQUENCE[this.modeIndex].duration
      ) {
        this.modeElapsed -= MODE_SEQUENCE[this.modeIndex].duration;
        this.modeIndex += 1;
      }
    }

    for (const ghost of this.ghosts) {
      if (ghost.releaseDelay > 0) {
        ghost.releaseDelay = Math.max(0, ghost.releaseDelay - dt);
      }
    }

    this.playerAccumulator += dt;
    while (this.playerAccumulator >= this.playerStepMs) {
      this.playerAccumulator -= this.playerStepMs;
      this.stepPlayer();
      if (this.state !== 'running') {
        return;
      }
    }

    this.ghostAccumulator += dt;
    while (this.ghostAccumulator >= this.ghostStepMs) {
      this.ghostAccumulator -= this.ghostStepMs;
      this.stepGhosts();
      if (this.state !== 'running') {
        return;
      }
    }
  }

  stepPlayer() {
    if (this.player.nextDir && this.canMove(this.player.x, this.player.y, this.player.nextDir)) {
      this.player.dir = this.player.nextDir;
    }
    if (this.canMove(this.player.x, this.player.y, this.player.dir)) {
      const next = this.getNextPosition(this.player.x, this.player.y, this.player.dir);
      this.player.x = next.x;
      this.player.y = next.y;
    }

    this.consumeAtPlayer();
    if (this.state !== 'running') {
      return;
    }
    this.handleCollisions();
  }

  stepGhosts() {
    for (const ghost of this.ghosts) {
      if (ghost.releaseDelay > 0) {
        continue;
      }
      this.moveGhost(ghost);
    }
    this.handleCollisions();
  }

  moveGhost(ghost) {
    const options = this.getMoveOptions(ghost);
    if (options.length === 0) {
      return;
    }

    const mode = this.getCurrentGhostMode();
    let selected;

    if (mode === 'frightened') {
      selected = chooseFarthestOption(options, this.player.x, this.player.y);
    } else if (mode === 'random') {
      selected = options[Math.floor(Math.random() * options.length)];
    } else {
      const target =
        mode === 'chase'
          ? { x: this.player.x, y: this.player.y }
          : { x: ghost.scatterTarget.x, y: ghost.scatterTarget.y };
      selected = chooseClosestOption(options, target.x, target.y);
    }

    ghost.x = selected.x;
    ghost.y = selected.y;
    ghost.dir = selected.dir;
  }

  consumeAtPlayer() {
    const key = pointKey(this.player.x, this.player.y);
    let consumed = false;

    if (this.pellets.delete(key)) {
      this.score += 10;
      consumed = true;
    }
    if (this.powerPellets.delete(key)) {
      this.score += 50;
      this.powerTimer = 8000;
      this.ghostCombo = 0;
      this.statusText = 'Power mode active.';
      this.ringBell();
      consumed = true;
    }

    if (consumed) {
      this.bumpHighScore();
    }

    if (this.pellets.size === 0 && this.powerPellets.size === 0) {
      this.finishLevel();
    }
  }

  handleCollisions() {
    for (const ghost of this.ghosts) {
      if (ghost.releaseDelay > 0) {
        continue;
      }
      if (ghost.x !== this.player.x || ghost.y !== this.player.y) {
        continue;
      }

      if (this.powerTimer > 0) {
        const points = 200 * 2 ** Math.min(this.ghostCombo, 3);
        this.ghostCombo += 1;
        this.score += points;
        this.bumpHighScore();
        ghost.x = ghost.startX;
        ghost.y = ghost.startY;
        ghost.dir = 'up';
        ghost.releaseDelay = 700;
        this.statusText = `Ghost chomped for ${points} points.`;
        continue;
      }

      if (this.invulnerableTimer > 0) {
        continue;
      }

      this.loseLife();
      return;
    }
  }

  loseLife() {
    this.lives -= 1;
    this.powerTimer = 0;
    this.ghostCombo = 0;

    if (this.lives <= 0) {
      this.state = 'gameover';
      this.statusText = 'Game over.';
      this.persistHighScore();
      this.ringBell();
      return;
    }

    this.resetActorsAfterHit();
    this.respawnTimer = 1000;
    this.invulnerableTimer = 1200;
    this.statusText = 'Life lost. Re-centering...';
  }

  resetActorsAfterHit() {
    this.player.x = this.playerStart.x;
    this.player.y = this.playerStart.y;
    this.player.dir = 'left';
    this.player.nextDir = 'left';

    this.ghosts.forEach((ghost, index) => {
      ghost.x = ghost.startX;
      ghost.y = ghost.startY;
      ghost.dir = index % 2 === 0 ? 'left' : 'right';
      ghost.releaseDelay = index * 300;
    });
  }

  finishLevel() {
    this.score += 500;
    this.bumpHighScore();
    this.level += 1;
    this.state = 'level-clear';
    this.statusText = `Level clear. Bonus +500. Loading level ${this.level}...`;

    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer);
    }

    this.pendingTimer = setTimeout(() => {
      this.pendingTimer = null;
      if (!this.active) {
        return;
      }
      this.loadLevel();
    }, 1400);
  }

  restartGame() {
    this.level = 1;
    this.score = 0;
    this.lives = 3;
    this.statusText = 'Fresh run.';
    this.loadLevel();
  }

  onKeypress(ch, key) {
    const input = (key && key.name) || ch;

    if (input === 'q' || input === 'escape') {
      this.onExit();
      return;
    }

    if (input === 'r') {
      this.restartGame();
      return;
    }

    if ((input === 'p' || input === 'space') && this.state !== 'gameover' && this.state !== 'level-clear') {
      if (this.state === 'paused') {
        this.state = 'running';
        this.statusText = 'Resumed.';
      } else {
        this.state = 'paused';
        this.statusText = 'Paused.';
      }
      return;
    }

    if (this.state === 'gameover' && (input === 'enter' || input === 'r')) {
      this.restartGame();
      return;
    }

    if (this.state !== 'running') {
      return;
    }

    if (input === 'up' || input === 'w') {
      this.player.nextDir = 'up';
      return;
    }
    if (input === 'down' || input === 's') {
      this.player.nextDir = 'down';
      return;
    }
    if (input === 'left' || input === 'a') {
      this.player.nextDir = 'left';
      return;
    }
    if (input === 'right' || input === 'd') {
      this.player.nextDir = 'right';
    }
  }

  canMove(x, y, dir) {
    return Boolean(this.getNextPosition(x, y, dir));
  }

  getNextPosition(x, y, dir) {
    const delta = DIRECTIONS[dir];
    if (!delta) {
      return null;
    }

    let nextX = x + delta.x;
    let nextY = y + delta.y;

    if (nextX < 0) {
      nextX = this.mazeWidth - 1;
    } else if (nextX >= this.mazeWidth) {
      nextX = 0;
    }
    if (nextY < 0 || nextY >= this.mazeHeight) {
      return null;
    }
    if (!this.isWalkable(nextX, nextY)) {
      return null;
    }
    return { x: nextX, y: nextY };
  }

  getMoveOptions(entity) {
    const options = [];
    for (const [dir] of Object.entries(DIRECTIONS)) {
      const next = this.getNextPosition(entity.x, entity.y, dir);
      if (!next) {
        continue;
      }
      options.push({ dir, x: next.x, y: next.y });
    }

    if (options.length > 1 && entity.dir) {
      const reverse = OPPOSITE_DIRECTION[entity.dir];
      const withoutReverse = options.filter((option) => option.dir !== reverse);
      if (withoutReverse.length > 0) {
        return withoutReverse;
      }
    }
    return options;
  }

  isWalkable(x, y) {
    return this.grid[y] && this.grid[y][x] !== '#';
  }

  getCurrentGhostMode() {
    if (this.powerTimer > 0) {
      return 'frightened';
    }
    return MODE_SEQUENCE[this.modeIndex].name;
  }

  render() {
    const tooSmall =
      this.screen.width < MIN_TERMINAL_WIDTH || this.screen.height < MIN_TERMINAL_HEIGHT;

    if (tooSmall) {
      this.frame.hide();
      this.resizeBox.show();
      this.screen.render();
      return;
    }

    this.resizeBox.hide();
    this.frame.show();

    this.hudBox.setContent(this.renderHud());
    this.boardBox.setContent(this.renderBoard());
    this.statusBox.setContent(this.renderStatusLine());

    this.screen.render();
  }

  renderHud() {
    const mode = this.state === 'paused' ? 'PAUSED' : this.getCurrentGhostMode().toUpperCase();
    const livesText = '●'.repeat(this.lives).padEnd(3, '○');
    const pelletsLeft = this.pellets.size + this.powerPellets.size;
    const powerSeconds = this.powerTimer > 0 ? (this.powerTimer / 1000).toFixed(1) : '--';

    return [
      `{#dbeafe-fg}SCORE{/} {#facc15-fg}${this.score}{/}   {#dbeafe-fg}HIGH{/} {#facc15-fg}${this.highScore}{/}   {#dbeafe-fg}LEVEL{/} {#7dd3fc-fg}${this.level}{/}`,
      `{#dbeafe-fg}LIVES{/} {#fb7185-fg}${livesText}{/}   {#dbeafe-fg}MODE{/} {#86efac-fg}${mode}{/}   {#dbeafe-fg}PELLETS{/} ${pelletsLeft}   {#dbeafe-fg}POWER{/} ${powerSeconds}s`,
    ].join('\n');
  }

  renderStatusLine() {
    if (this.state === 'gameover') {
      return '{#f87171-fg}Game Over{/}  Press {#fde68a-fg}[Enter]{/} or {#fde68a-fg}[R]{/} to restart.';
    }
    if (this.state === 'paused') {
      return '{#fef08a-fg}Paused{/}  Press {#fde68a-fg}[P]{/} or {#fde68a-fg}[Space]{/} to continue.';
    }
    if (this.state === 'level-clear') {
      return `{#86efac-fg}${this.statusText}{/}`;
    }
    if (this.respawnTimer > 0) {
      return '{#fbbf24-fg}Get ready...{/}';
    }
    return `{#a5f3fc-fg}${this.statusText}{/}`;
  }

  renderBoard() {
    const ghostMap = new Map();
    for (const ghost of this.ghosts) {
      ghostMap.set(pointKey(ghost.x, ghost.y), ghost);
    }

    const rows = [];
    for (let y = 0; y < this.mazeHeight; y += 1) {
      let row = '';
      for (let x = 0; x < this.mazeWidth; x += 1) {
        const key = pointKey(x, y);

        if (this.player.x === x && this.player.y === y) {
          row += '{#fbbf24-fg}◉{/}';
          continue;
        }

        if (ghostMap.has(key)) {
          row += this.renderGhost(ghostMap.get(key));
          continue;
        }

        if (!this.isWalkable(x, y)) {
          row += (x + y) % 2 === 0 ? '{#1d4ed8-fg}█{/}' : '{#2563eb-fg}▓{/}';
          continue;
        }

        if (this.powerPellets.has(key)) {
          const glyph = this.frameCounter % 16 < 8 ? '●' : '○';
          row += `{#fde047-fg}${glyph}{/}`;
          continue;
        }

        if (this.pellets.has(key)) {
          row += '{#f8fafc-fg}·{/}';
          continue;
        }

        row += ' ';
      }
      rows.push(row);
    }

    return rows.join('\n');
  }

  renderGhost(ghost) {
    if (this.powerTimer > 0) {
      return this.frameCounter % 10 < 5 ? '{#60a5fa-fg}◆{/}' : '{#bfdbfe-fg}◇{/}';
    }
    if (ghost.releaseDelay > 0) {
      return '{#64748b-fg}◇{/}';
    }
    return `{${ghost.color}-fg}◆{/}`;
  }

  bumpHighScore() {
    if (this.score > this.highScore) {
      this.highScore = this.score;
    }
  }

  persistHighScore() {
    saveScore('chompy', Math.max(this.score, this.highScore));
  }

  ringBell() {
    try {
      this.screen.program.bell();
    } catch (_err) {
      // Terminal bell is optional.
    }
  }

  destroy() {
    if (!this.active) {
      return;
    }
    this.active = false;

    if (this.loop) {
      clearInterval(this.loop);
      this.loop = null;
    }
    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }

    this.persistHighScore();
    this.screen.off('keypress', this.onKeypress);

    if (this.root) {
      this.root.destroy();
      this.root = null;
    }
  }
}

function parseMaze(template) {
  const width = template.reduce((max, line) => Math.max(max, line.length), 0);
  const rows = template.map((line) => line.padEnd(width, ' '));

  const grid = [];
  const pellets = new Set();
  const powerPellets = new Set();
  const ghostStarts = [];
  let playerStart = null;

  for (let y = 0; y < rows.length; y += 1) {
    grid[y] = [];
    for (let x = 0; x < width; x += 1) {
      const char = rows[y][x];
      if (char === '#') {
        grid[y][x] = '#';
        continue;
      }

      grid[y][x] = ' ';
      const key = pointKey(x, y);
      if (char === '.') {
        pellets.add(key);
      } else if (char === 'o') {
        powerPellets.add(key);
      } else if (char === 'P') {
        playerStart = { x, y };
      } else if (char === 'G') {
        ghostStarts.push({ x, y });
      }
    }
  }

  if (!playerStart) {
    playerStart = findFirstWalkable(grid);
  }

  return {
    width,
    height: rows.length,
    grid,
    pellets,
    powerPellets,
    playerStart,
    ghostStarts,
  };
}

function findFirstWalkable(grid) {
  for (let y = 0; y < grid.length; y += 1) {
    for (let x = 0; x < grid[y].length; x += 1) {
      if (grid[y][x] !== '#') {
        return { x, y };
      }
    }
  }
  return { x: 1, y: 1 };
}

function expandGhostStarts(starts, grid) {
  const height = grid.length;
  const width = grid[0].length;
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);

  const result = starts.map((start) => ({ x: start.x, y: start.y }));
  const candidates = [
    { x: centerX - 1, y: centerY },
    { x: centerX + 1, y: centerY },
    { x: centerX, y: centerY - 1 },
    { x: centerX, y: centerY + 1 },
    { x: centerX, y: centerY },
  ];

  for (const candidate of candidates) {
    if (result.length >= 4) {
      break;
    }
    if (isWalkableInGrid(grid, candidate.x, candidate.y)) {
      result.push(candidate);
    }
  }

  if (result.length === 0) {
    result.push({ x: centerX, y: centerY });
  }

  while (result.length < 4) {
    result.push({ ...result[result.length - 1] });
  }

  return result.slice(0, 4);
}

function isWalkableInGrid(grid, x, y) {
  return grid[y] && grid[y][x] !== '#';
}

function chooseClosestOption(options, targetX, targetY) {
  return options.reduce((best, option) => {
    const distance = manhattan(option.x, option.y, targetX, targetY);
    if (!best || distance < best.distance || (distance === best.distance && Math.random() < 0.35)) {
      return { ...option, distance };
    }
    return best;
  }, null);
}

function chooseFarthestOption(options, targetX, targetY) {
  return options.reduce((best, option) => {
    const distance = manhattan(option.x, option.y, targetX, targetY);
    if (!best || distance > best.distance || (distance === best.distance && Math.random() < 0.35)) {
      return { ...option, distance };
    }
    return best;
  }, null);
}

function manhattan(ax, ay, bx, by) {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

function pointKey(x, y) {
  return `${x},${y}`;
}

module.exports = {
  ChompyGame,
};
