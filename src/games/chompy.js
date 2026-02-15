'use strict';

const blessed = require('blessed');
const { loadDesignSystem, colorize } = require('../design/system');
const { loadScores, saveScore } = require('../lib/highscore');

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

class ChompyGame {
  constructor(screen, { onExit }) {
    this.screen = screen;
    this.onExit = onExit;
    this.design = loadDesignSystem().chompy;
    this.colors = this.design.colors;
    this.glyphs = this.design.glyphs;
    this.mazeLegend = this.design.maze.legend;
    this.tileWidth = Math.max(1, Number(this.design.tileWidth || 1));
    this.spriteSet = buildSpriteSet(this.glyphs, this.tileWidth);

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

    this.maze = parseMaze(this.design.maze.lines, this.mazeLegend);
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
    const colors = this.colors;
    const frame = this.design.frame;

    this.root = blessed.box({
      parent: this.screen,
      width: '100%',
      height: '100%',
      style: { bg: colors.screenBg },
    });

    this.frame = blessed.box({
      parent: this.root,
      top: 'center',
      left: 'center',
      width: frame.width,
      height: frame.height,
      border: 'line',
      tags: true,
      style: {
        fg: colors.frameFg,
        bg: colors.frameBg,
        border: { fg: colors.frameBorder },
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
      content: colorize(this.design.title, colors.title),
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
      width: this.mazeWidth * this.tileWidth + 2,
      height: this.mazeHeight + 2,
      border: 'line',
      tags: true,
      style: {
        border: { fg: colors.boardBorder },
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
      content: this.renderControlsHint(),
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
        bg: colors.resizeBg,
        border: { fg: colors.resizeBorder },
      },
      align: 'center',
      valign: 'middle',
      content: `${colorize(this.design.status.tooSmall, colors.resizeTitle)}\n${colorize(this.design.status.resizeHint, colors.resizeHint)}`,
    });
  }

  loadLevel() {
    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }

    this.maze = parseMaze(this.design.maze.lines, this.mazeLegend);
    this.grid = this.maze.grid;
    this.wallGrid = this.maze.wallGrid;
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

    const ghostPalette =
      Array.isArray(this.design.ghostPalette) && this.design.ghostPalette.length > 0
        ? this.design.ghostPalette
        : ['#ff5f5f', '#ff87d7', '#5fd7ff', '#ffaf5f'];
    const ghostStarts = expandGhostStarts(this.maze.ghostStarts, this.grid);
    this.ghosts = ghostStarts.map((start, index) => ({
      id: index + 1,
      x: start.x,
      y: start.y,
      startX: start.x,
      startY: start.y,
      dir: index % 2 === 0 ? 'left' : 'right',
      color: ghostPalette[index % ghostPalette.length],
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

  renderControlsHint() {
    return this.design.controlsHint
      .replace(
        '[Arrows/WASD]',
        colorize('[Arrows/WASD]', this.colors.controls),
      )
      .replace('[P/Space]', colorize('[P/Space]', this.colors.controlsPause))
      .replace('[R]', colorize('[R]', this.colors.controlsRestart))
      .replace('[Q/Esc]', colorize('[Q/Esc]', this.colors.controlsQuit));
  }

  render() {
    const frame = this.design.frame;
    const tooSmall =
      this.screen.width < frame.minTerminalWidth ||
      this.screen.height < frame.minTerminalHeight;

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
    const colors = this.colors;
    const mode = this.state === 'paused' ? 'PAUSED' : this.getCurrentGhostMode().toUpperCase();
    const livesText = this.glyphs.lifeFull.repeat(this.lives).padEnd(3, this.glyphs.lifeEmpty);
    const pelletsLeft = this.pellets.size + this.powerPellets.size;
    const powerSeconds = this.powerTimer > 0 ? (this.powerTimer / 1000).toFixed(1) : '--';

    return [
      `${colorize('SCORE', colors.hudLabel)} ${colorize(String(this.score), colors.hudScore)}   ${colorize('HIGH', colors.hudLabel)} ${colorize(String(this.highScore), colors.hudScore)}   ${colorize('LEVEL', colors.hudLabel)} ${colorize(String(this.level), colors.hudLevel)}`,
      `${colorize('LIVES', colors.hudLabel)} ${colorize(livesText, colors.hudLives)}   ${colorize('MODE', colors.hudLabel)} ${colorize(mode, colors.hudMode)}   ${colorize('PELLETS', colors.hudLabel)} ${pelletsLeft}   ${colorize('POWER', colors.hudLabel)} ${powerSeconds}s`,
    ].join('\n');
  }

  renderStatusLine() {
    if (this.state === 'gameover') {
      return `${colorize('Game Over', this.colors.statusGameOver)}  Press ${colorize('[Enter]', this.colors.controlsPause)} or ${colorize('[R]', this.colors.controlsPause)} to restart.`;
    }
    if (this.state === 'paused') {
      return `${colorize('Paused', this.colors.statusPaused)}  Press ${colorize('[P]', this.colors.controlsPause)} or ${colorize('[Space]', this.colors.controlsPause)} to continue.`;
    }
    if (this.state === 'level-clear') {
      return colorize(this.statusText, this.colors.statusLevelClear);
    }
    if (this.respawnTimer > 0) {
      return colorize('Get ready...', this.colors.statusReady);
    }
    return colorize(this.statusText, this.colors.statusInfo);
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
          row += colorize(
            pickDirectionalFrame(
              this.spriteSet.player,
              this.player.dir,
              this.frameCounter,
              7,
            ),
            this.colors.player,
          );
          continue;
        }

        if (ghostMap.has(key)) {
          row += this.renderGhost(ghostMap.get(key));
          continue;
        }

        if (!this.isWalkable(x, y)) {
          row += this.renderWallTile(x, y);
          continue;
        }

        if (this.powerPellets.has(key)) {
          row += colorize(
            pickDirectionalFrame(
              this.spriteSet.powerPellet,
              this.player.dir,
              this.frameCounter,
              9,
            ),
            this.colors.powerPellet,
          );
          continue;
        }

        if (this.pellets.has(key)) {
          row += colorize(
            pickDirectionalFrame(this.spriteSet.pellet, this.player.dir, this.frameCounter, 9),
            this.colors.pellet,
          );
          continue;
        }

        row += ' '.repeat(this.tileWidth);
      }
      rows.push(row);
    }

    return rows.join('\n');
  }

  renderGhost(ghost) {
    if (this.powerTimer > 0) {
      return colorize(
        pickDirectionalFrame(this.spriteSet.ghostFrightened, ghost.dir, this.frameCounter, 5),
        this.frameCounter % 10 < 5 ? this.colors.ghostFrightenedA : this.colors.ghostFrightenedB,
      );
    }
    if (ghost.releaseDelay > 0) {
      return colorize(
        pickDirectionalFrame(this.spriteSet.ghostReleased, ghost.dir, this.frameCounter, 8),
        this.colors.ghostReleased,
      );
    }
    return colorize(
      pickDirectionalFrame(this.spriteSet.ghostNormal, ghost.dir, this.frameCounter, 8),
      ghost.color,
    );
  }

  renderWallTile(x, y) {
    const wallToken = this.getWallToken(x, y);
    return colorize(
      tileGlyph(this.resolveWallGlyph(wallToken, x, y), this.tileWidth),
      this.resolveWallColor(wallToken, x, y),
    );
  }

  getWallToken(x, y) {
    if (!this.wallGrid || !this.wallGrid[y]) {
      return '#';
    }
    return this.wallGrid[y][x] || '#';
  }

  resolveWallGlyph(token, x, y) {
    if (token === '#') {
      return (x + y) % 2 === 0 ? this.glyphs.wallEven : this.glyphs.wallOdd;
    }
    const glyph = typeof token === 'string' && token.length > 0 ? token : '#';
    return glyph.length === 1 ? glyph.repeat(this.tileWidth) : glyph;
  }

  resolveWallColor(token, x, y) {
    const tokenPalette = this.colors.wallByToken;
    if (tokenPalette && typeof tokenPalette === 'object') {
      const tokenColor = tokenPalette[token];
      if (tokenColor !== undefined && tokenColor !== null && tokenColor !== '') {
        return tokenColor;
      }
    }
    if (token === '#') {
      return (x + y) % 2 === 0 ? this.colors.wallEven : this.colors.wallOdd;
    }
    return this.colors.wallOdd;
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

function parseMaze(template, legend) {
  const wallTokens = new Set(asArray(legend.wall, ['#']));
  const pelletToken = asString(legend.pellet, '.');
  const powerPelletToken = asString(legend.powerPellet, 'o');
  const playerToken = asString(legend.playerStart, 'P');
  const ghostToken = asString(legend.ghostStart, 'G');
  const width = template.reduce((max, line) => Math.max(max, line.length), 0);
  const rows = template.map((line) => line.padEnd(width, ' '));

  const grid = [];
  const wallGrid = [];
  const pellets = new Set();
  const powerPellets = new Set();
  const ghostStarts = [];
  let playerStart = null;

  for (let y = 0; y < rows.length; y += 1) {
    grid[y] = [];
    wallGrid[y] = [];
    for (let x = 0; x < width; x += 1) {
      const char = rows[y][x];
      if (wallTokens.has(char)) {
        grid[y][x] = '#';
        wallGrid[y][x] = char;
        continue;
      }

      grid[y][x] = ' ';
      wallGrid[y][x] = null;
      const key = pointKey(x, y);
      if (char === pelletToken) {
        pellets.add(key);
      } else if (char === powerPelletToken) {
        powerPellets.add(key);
      } else if (char === playerToken) {
        playerStart = { x, y };
      } else if (char === ghostToken) {
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
    wallGrid,
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

function pickDirectionalFrame(sprite, direction, frameCounter, divisor) {
  if (!sprite) {
    return '?';
  }
  const frames = sprite[direction] || sprite.right;
  if (!Array.isArray(frames) || frames.length === 0) {
    return '?';
  }
  if (frames.length === 1) {
    return frames[0];
  }
  const index = Math.floor(frameCounter / divisor) % frames.length;
  return frames[index];
}

function buildSpriteSet(glyphs, tileWidth) {
  return {
    player: buildDirectionalSprite(glyphs.playerFrames, tileWidth, glyphs.playerDirectional),
    ghostNormal: buildDirectionalSprite(
      glyphs.ghostNormal,
      tileWidth,
      glyphs.ghostNormalDirectional,
    ),
    ghostReleased: buildDirectionalSprite(glyphs.ghostReleased, tileWidth),
    ghostFrightened: buildDirectionalSprite(glyphs.ghostFrightenedFrames, tileWidth),
    pellet: buildDirectionalSprite(glyphs.pellet, tileWidth),
    powerPellet: buildDirectionalSprite(glyphs.powerPelletFrames, tileWidth),
  };
}

function buildDirectionalSprite(lines, tileWidth, overrides) {
  const frames = splitArtFrames(lines);
  const rightFrames = frames.map((frame) => artToTile(frame, tileWidth, 'horizontal'));
  const leftFrames = frames.map((frame) =>
    artToTile(mirrorArt(frame), tileWidth, 'horizontal'),
  );
  const upFrames = frames.map((frame) => artToTile(flipArt(frame), tileWidth, 'vertical'));
  const downFrames = frames.map((frame) =>
    artToTile(mirrorArt(flipArt(frame)), tileWidth, 'vertical'),
  );

  const overrideRight = compileOverrideFrames(overrides && overrides.right, tileWidth);
  const overrideLeft = compileOverrideFrames(overrides && overrides.left, tileWidth);
  const overrideUp = compileOverrideFrames(overrides && overrides.up, tileWidth);
  const overrideDown = compileOverrideFrames(overrides && overrides.down, tileWidth);

  return {
    right: overrideRight || rightFrames,
    left: overrideLeft || leftFrames,
    up: overrideUp || upFrames,
    down: overrideDown || downFrames,
  };
}

function compileOverrideFrames(lines, tileWidth) {
  if (!Array.isArray(lines) || lines.length === 0) {
    return null;
  }
  return splitArtFrames(lines).map((frame) => artToTile(frame, tileWidth, 'horizontal'));
}

function splitArtFrames(lines) {
  if (!Array.isArray(lines) || lines.length === 0) {
    return [['?']];
  }
  const normalized = lines.map((line) => String(line));
  const isSingleCharFrameList = normalized.every(
    (line) => line.length > 0 && line.length <= 3 && !/\s/.test(line),
  );
  if (isSingleCharFrameList && normalized.length > 1) {
    return normalized.map((line) => [line]);
  }
  return [normalized];
}

function artToTile(lines, tileWidth, mode) {
  const matrix = normalizeArt(lines);
  if (matrix.length === 0 || matrix[0].length === 0) {
    return tileGlyph(' ', tileWidth);
  }
  if (mode === 'vertical' && tileWidth >= 2) {
    const topDensity = regionDensity(matrix, 0, matrix[0].length, 0, Math.ceil(matrix.length / 2));
    const bottomDensity = regionDensity(
      matrix,
      0,
      matrix[0].length,
      Math.floor(matrix.length / 2),
      matrix.length,
    );
    const pair = [densityToGlyph(topDensity), densityToGlyph(bottomDensity)].join('');
    return tileGlyph(pair, tileWidth);
  }

  const chunkWidth = matrix[0].length / tileWidth;
  let output = '';
  for (let index = 0; index < tileWidth; index += 1) {
    const startX = Math.floor(index * chunkWidth);
    const endX = Math.floor((index + 1) * chunkWidth);
    const density = regionDensity(matrix, startX, Math.max(startX + 1, endX), 0, matrix.length);
    output += densityToGlyph(density);
  }
  return tileGlyph(output, tileWidth);
}

function normalizeArt(lines) {
  const withoutTopBottomBlanks = trimVertical(lines.map((line) => String(line)));
  if (withoutTopBottomBlanks.length === 0) {
    return [];
  }

  const charRows = withoutTopBottomBlanks.map((line) => Array.from(line));
  let minX = Number.POSITIVE_INFINITY;
  let maxX = -1;

  for (const row of charRows) {
    for (let index = 0; index < row.length; index += 1) {
      if (isInk(row[index])) {
        minX = Math.min(minX, index);
        maxX = Math.max(maxX, index);
      }
    }
  }

  if (maxX < minX) {
    return [];
  }

  const width = maxX - minX + 1;
  return charRows.map((row) => {
    const cropped = row.slice(minX, maxX + 1);
    while (cropped.length < width) {
      cropped.push(' ');
    }
    return cropped;
  });
}

function trimVertical(lines) {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start].trim().length === 0) {
    start += 1;
  }
  while (end > start && lines[end - 1].trim().length === 0) {
    end -= 1;
  }
  return lines.slice(start, end);
}

function mirrorArt(lines) {
  return lines.map((line) => Array.from(line).reverse().join(''));
}

function flipArt(lines) {
  return lines.slice().reverse();
}

function regionDensity(matrix, startX, endX, startY, endY) {
  let filled = 0;
  let total = 0;
  for (let y = Math.max(0, startY); y < Math.min(matrix.length, endY); y += 1) {
    for (let x = Math.max(0, startX); x < Math.min(matrix[y].length, endX); x += 1) {
      total += 1;
      if (isInk(matrix[y][x])) {
        filled += 1;
      }
    }
  }
  return total > 0 ? filled / total : 0;
}

function isInk(char) {
  return char !== ' ' && char !== '\t';
}

function densityToGlyph(value) {
  if (value <= 0.05) return ' ';
  if (value <= 0.2) return '.';
  if (value <= 0.35) return ':';
  if (value <= 0.5) return '=';
  if (value <= 0.7) return '+';
  if (value <= 0.85) return '*';
  return '#';
}

function tileGlyph(value, width) {
  const text = String(value || '');
  if (text.length >= width) {
    return text.slice(0, width);
  }
  return text.padEnd(width, ' ');
}

function asArray(value, fallback) {
  if (Array.isArray(value) && value.length > 0) {
    return value;
  }
  return fallback;
}

function asString(value, fallback) {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  return fallback;
}

module.exports = {
  ChompyGame,
};
