'use strict';

const blessed = require('blessed');
const { loadDesignSystem, colorize } = require('../design/system');
const { loadScores, saveScore } = require('../lib/highscore');
const {
  DIRECTIONS,
  OPPOSITE_DIRECTION,
  MODE_SEQUENCE,
  DEFAULT_GHOST_PALETTE,
} = require('./chompy/constants');
const { getLayoutMetrics, renderResizeHint } = require('./chompy/layout');
const { parseMaze, expandGhostStarts, pointKey } = require('./chompy/maze');
const redPath = require('./chompy/ghost_logic/red_logic');
const pinkPath = require('./chompy/ghost_logic/pink_logic');
const bluePath = require('./chompy/ghost_logic/blue_logic');
const yellowPath = require('./chompy/ghost_logic/yellow_logic');
const { buildSpriteSet, pickDirectionalFrame } = require('./chompy/sprites');
const { getWallToken, resolveWallGlyph, resolveWallColor } = require('./chompy/walls');

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
    this._nextLifeScore = 10000;

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
    const layout = getLayoutMetrics(
      this.design.frame,
      this.mazeWidth,
      this.mazeHeight,
      this.tileWidth,
    );
    this.layout = layout;

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
      width: layout.frameWidth,
      height: layout.frameHeight,
      tags: true,
      style: {
        fg: colors.frameFg,
        bg: colors.frameBg,
      },
    });

    this.titleBox = blessed.box({
      parent: this.frame,
      top: 1,
      left: 2,
      width: '100%-4',
      height: 1,
      tags: true,
      transparent: true,
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
      transparent: true,
      align: 'center',
    });

    this.boardBox = blessed.box({
      parent: this.frame,
      top: layout.boardTop,
      left: 'center',
      width: layout.boardWidth,
      height: layout.boardHeight,
      tags: true,
      style: {
        bg: colors.frameBg,
      },
    });

    this.statusBox = blessed.box({
      parent: this.frame,
      top: layout.statusTop,
      left: 2,
      width: '100%-4',
      height: 2,
      tags: true,
      transparent: true,
      align: 'center',
    });

    this.footerBox = blessed.box({
      parent: this.frame,
      bottom: 1,
      left: 2,
      width: '100%-4',
      height: 1,
      tags: true,
      transparent: true,
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
      content: `${colorize(this.design.status.tooSmall, colors.resizeTitle)}\n${colorize(renderResizeHint(this.design.status.resizeHint, layout.minTerminalWidth, layout.minTerminalHeight), colors.resizeHint)}`,
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
        : DEFAULT_GHOST_PALETTE;
    const ghostStarts = expandGhostStarts(this.maze.ghostStarts, this.grid);
    const GHOST_AI = [redPath, bluePath, pinkPath, yellowPath];
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
      ai: GHOST_AI[index % GHOST_AI.length],
    }));

    this.playerStepMs = Math.max(70, 130 - (this.level - 1) * 5);
    this.playerStepMsH = Math.round(this.playerStepMs * 0.55);
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

    const isHorizontal = this.player.dir === 'left' || this.player.dir === 'right';
    const stepMs = isHorizontal ? this.playerStepMsH : Math.round(this.playerStepMsH * 1.8);
    this.playerAccumulator += dt;
    while (this.playerAccumulator >= stepMs) {
      this.playerAccumulator -= stepMs;
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
    const selected = ghost.ai.chooseMove(ghost, {
      player: this.player,
      mode,
      options,
      grid: this.grid,
    });

    if (selected) {
      ghost.x = selected.x;
      ghost.y = selected.y;
      ghost.dir = selected.dir;
    }
  }

  consumeAtPlayer() {
    const key = pointKey(this.player.x, this.player.y);
    let consumed = false;

    if (this.pellets.delete(key)) {
      this.addScore(10);
      consumed = true;
    }
    if (this.powerPellets.delete(key)) {
      this.addScore(50);
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
        this.addScore(points);
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
    this.addScore(500);
    this.bumpHighScore();
    this.level += 1;
    this.lives += 1;
    this.state = 'level-clear';
    this.statusText = `level ${this.level}`;

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

  addScore(points) {
    this.score += points;
    if (this.score >= this._nextLifeScore) {
      this.lives += 1;
      this._nextLifeScore += 10000;
      this.statusText = 'Extra life!';
      this.ringBell();
    }
  }

  restartGame() {
    this.level = 1;
    this.score = 0;
    this.lives = 3;
    this._nextLifeScore = 10000;
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
    const layout =
      this.layout ||
      getLayoutMetrics(this.design.frame, this.mazeWidth, this.mazeHeight, this.tileWidth);
    const tooSmall =
      this.screen.width < layout.minTerminalWidth ||
      this.screen.height < layout.minTerminalHeight;

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
    const wallToken = getWallToken(this.wallGrid, x, y);
    return colorize(
      resolveWallGlyph({
        grid: this.grid,
        tileWidth: this.tileWidth,
        glyphs: this.glyphs,
        wallToken,
        x,
        y,
      }),
      resolveWallColor({ colors: this.colors, wallToken, x, y }),
    );
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

module.exports = {
  ChompyGame,
};
