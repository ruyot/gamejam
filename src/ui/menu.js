'use strict';

const blessed = require('blessed');
const { loadDesignSystem, colorize } = require('../design/system');
const { loadChaseSprites } = require('./chase_sprites');

const MENU_ITEMS = [
  { id: 'chompy', label: 'Chompy' },
  { id: 'snake', label: 'Snake', comingSoon: true },
  { id: 'tetris', label: 'Tetris', comingSoon: true },
  { id: 'space-invaders', label: 'Space Invaders', comingSoon: true },
  { id: 'quit', label: 'Quit' },
];

class MenuView {
  constructor(screen, actions) {
    this.screen = screen;
    this.actions = actions;
    this.selectedIndex = 0;
    this.titleFrame = 0;
    this.titleTimer = null;
    this.design = loadDesignSystem().menu;
    this.onKeypress = this.onKeypress.bind(this);
  }

  mount() {
    this.createLayout();
    this.createChaseLayer();
    this.startTitleAnimation();
    this.startChaseAnimation();
    this.render();
    this.screen.on('keypress', this.onKeypress);
  }

  createLayout() {
    const colors = this.design.colors;

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
      width: this.design.frame.width,
      height: this.design.frame.height,
      border: 'line',
      tags: true,
      style: {
        fg: colors.frameFg,
        bg: colors.frameBg,
        border: { fg: colors.frameBorder, bg: colors.frameBg },
      },
    });

    this.titleBox = blessed.box({
      parent: this.frame,
      top: 3,
      left: 2,
      width: '100%-4',
      height: 8,
      tags: true,
      transparent: true,
      align: 'center',
      content: '',
    });

    this.subtitleBox = blessed.box({
      parent: this.frame,
      top: 11,
      left: 2,
      width: '100%-4',
      height: 2,
      tags: true,
      transparent: true,
      align: 'center',
      content: colorize(this.design.subtitle, colors.subtitle),
    });

    this.menuBox = blessed.box({
      parent: this.frame,
      top: 14,
      left: 'center',
      width: 30,
      height: 7,
      tags: true,
      transparent: true,
      align: 'left',
    });

    this.hintBox = blessed.box({
      parent: this.frame,
      bottom: 2,
      left: 2,
      width: '100%-4',
      height: 2,
      tags: true,
      transparent: true,
      align: 'center',
      content: [
        colorize(this.design.hints.navigate, colors.hintNavigate),
        colorize(this.design.hints.select, colors.hintSelect),
        colorize(this.design.hints.quit, colors.hintQuit),
      ].join('  '),
    });
  }

  createChaseLayer() {
    const SPRITE_ROWS = 5;
    const SPRITE_COLS = 12;
    this.chaseSprites = loadChaseSprites(SPRITE_ROWS, SPRITE_COLS);

    const termH = this.screen.rows;
    const frameH = this.design.frame.height;
    const frameTop = Math.floor((termH - frameH) / 2);
    const laneHeight = SPRITE_ROWS;

    // Bottom lane (scene 1: ghosts chasing Chompy right)
    const bottomTop = frameTop + frameH + 1;
    this.chaseLaneBottom = blessed.box({
      parent: this.root,
      top: bottomTop,
      left: 0,
      width: '100%',
      height: laneHeight,
      tags: true,
      style: { bg: 16 },
    });

    // Top lane (scene 2: Chompy chasing frightened ghosts left)
    const topTop = Math.max(0, frameTop - laneHeight - 1);
    this.chaseLaneTop = blessed.box({
      parent: this.root,
      top: topTop,
      left: 0,
      width: '100%',
      height: laneHeight,
      tags: true,
      style: { bg: 16 },
    });

    this.chaseState = {
      scene: 0,
      x: 0,
      termW: this.screen.cols,
      spriteRows: SPRITE_ROWS,
      spriteCols: SPRITE_COLS,
      pauseCounter: 0,
    };
  }

  startChaseAnimation() {
    this.stopChaseAnimation();
    const s = this.chaseState;
    s.termW = this.screen.cols;
    s.scene = 0;
    s.x = -60;
    s.pauseCounter = 0;

    this.chaseTimer = setInterval(() => {
      this.tickChase();
      this.screen.render();
    }, 80);
  }

  stopChaseAnimation() {
    if (this.chaseTimer) {
      clearInterval(this.chaseTimer);
      this.chaseTimer = null;
    }
  }

  tickChase() {
    const s = this.chaseState;
    s.termW = this.screen.cols;
    const sp = this.chaseSprites;
    const gap = 2;

    if (s.scene === 0) {
      // Scene 1: moving right across bottom
      s.x += 1;
      if (s.x > s.termW + 10) {
        s.scene = 1;
        s.pauseCounter = 0;
        this.chaseLaneBottom.setContent('');
        return;
      }
      this.renderChaseScene1(s.x);
    } else if (s.scene === 1) {
      s.pauseCounter++;
      if (s.pauseCounter > 40) {
        s.scene = 2;
        s.x = s.termW + 10;
      }
    } else if (s.scene === 2) {
      // Scene 2: moving left across top
      s.x -= 1;
      const totalWidth = (sp.ghostFrightened.width + gap) * 3 + sp.playerLeft.width;
      if (s.x < -totalWidth - 10) {
        s.scene = 3;
        s.pauseCounter = 0;
        this.chaseLaneTop.setContent('');
        return;
      }
      this.renderChaseScene2(s.x);
    } else if (s.scene === 3) {
      s.pauseCounter++;
      if (s.pauseCounter > 40) {
        s.scene = 0;
        s.x = -60;
      }
    }
  }

  renderChaseScene1(baseX) {
    const sp = this.chaseSprites;
    const gap = 2;
    const colors = ['#ffea00', '#ff4d6d', '#ff7edb', '#00e5ff'];
    // Ghosts chasing from behind, Chompy in front
    const sprites = [
      { sprite: sp.ghostRight, color: colors[1] },
      { sprite: sp.ghostRight, color: colors[2] },
      { sprite: sp.ghostRight, color: colors[3] },
      { sprite: sp.playerRight, color: colors[0] },
    ];
    this.renderSpriteRow(sprites, baseX, gap, this.chaseLaneBottom);
  }

  renderChaseScene2(baseX) {
    const sp = this.chaseSprites;
    const gap = 2;
    const playerColor = '#ffea00';
    const frightenedColor = '#4169ff';
    // Frightened ghosts fleeing in front, Chompy chasing from behind (last)
    const sprites = [
      { sprite: sp.ghostFrightened, color: frightenedColor },
      { sprite: sp.ghostFrightened, color: frightenedColor },
      { sprite: sp.ghostFrightened, color: frightenedColor },
      { sprite: sp.playerLeft, color: playerColor },
    ];
    this.renderSpriteRow(sprites, baseX, gap, this.chaseLaneTop);
  }

  renderSpriteRow(sprites, baseX, gap, lane) {
    const s = this.chaseState;
    const rows = [];
    for (let r = 0; r < s.spriteRows; r++) {
      rows.push(new Array(s.termW).fill(' '));
    }

    let offsetX = 0;
    for (const { sprite, color } of sprites) {
      for (let r = 0; r < sprite.lines.length; r++) {
        const line = sprite.lines[r];
        for (let c = 0; c < line.length; c++) {
          const screenX = baseX + offsetX + c;
          if (screenX >= 0 && screenX < s.termW && line[c] !== ' ') {
            rows[r][screenX] = `{${color}-fg}${escapeTagChar(line[c])}{/}`;
          }
        }
      }
      offsetX += sprite.width + gap;
    }

    const content = rows.map((row) => row.join('')).join('\n');
    lane.setContent(content);
  }

  render() {
    const colors = this.design.colors;
    this.updateTitleArt();

    const lines = MENU_ITEMS.map((item, index) => {
      const isSelected = index === this.selectedIndex;
      const cursor = isSelected
        ? this.design.selectedCursor
        : this.design.unselectedCursor;
      const labelColor = isSelected
        ? colors.selected
        : item.comingSoon
          ? colors.comingSoon
          : colors.default;
      const suffix = item.comingSoon
        ? `  ${colorize(this.design.comingSoonSuffix, colors.comingSoonSuffix)}`
        : '';
      return `${colorize(cursor, colors.selected)} ${colorize(item.label, labelColor)}${suffix}`;
    });

    this.menuBox.setContent(lines.join('\n'));
    this.screen.render();
  }

  startTitleAnimation() {
    this.stopTitleAnimation();
    this.updateTitleArt();

    const animation = this.design.titleAnimation || {};
    const speedMs = clampNumber(animation.speedMs, 170, 40, 2000);
    const step = clampNumber(animation.step, 1, 1, 100);

    this.titleTimer = setInterval(() => {
      this.titleFrame = (this.titleFrame + step) % 10000;
      this.updateTitleArt();
      this.screen.render();
    }, speedMs);
  }

  stopTitleAnimation() {
    if (!this.titleTimer) {
      return;
    }
    clearInterval(this.titleTimer);
    this.titleTimer = null;
  }

  updateTitleArt() {
    if (!this.titleBox) {
      return;
    }
    this.titleBox.setContent(this.renderAnimatedTitle());
  }

  renderAnimatedTitle() {
    const lines = this.design.titleArtLines || [];
    return lines
      .map((line, y) =>
        Array.from(line)
          .map((char, x) => this.colorizeTitleChar(char, x, y))
          .join(''),
      )
      .join('\n');
  }

  renderFrameArt() {
    const lines = Array.isArray(this.design.frameArtLines) ? this.design.frameArtLines : [];
    if (lines.length === 0) {
      return '';
    }

    const color = (this.design.colors && this.design.colors.frameArt) || this.design.colors.frameBorder;
    return lines.map((line) => colorize(line, color)).join('\n');
  }

  colorizeTitleChar(char, x, y) {
    if (char === ' ') {
      return ' ';
    }

    const rgbPalette = [
      '#ff004d',
      '#ff8a00',
      '#ffe600',
      '#39ff14',
      '#00e5ff',
      '#0078ff',
      '#b400ff',
    ];
    const matrixPalette = ['#00ff41', '#7dff7a', '#d4ffd2'];

    const rgbIndex = (x + y + this.titleFrame) % rgbPalette.length;
    const matrixPulse = ((x * 3 + y * 5 + this.titleFrame) % 17) < 2;
    const color = matrixPulse
      ? matrixPalette[(x + y + this.titleFrame) % matrixPalette.length]
      : rgbPalette[rgbIndex];
    const weight = matrixPulse ? 'bold,' : '';

    return `{${weight}${color}-fg}${escapeTagChar(char)}{/}`;
  }

  onKeypress(ch, key) {
    const input = (key && key.name) || ch;
    if (input === 'up' || input === 'w') {
      this.selectedIndex = (this.selectedIndex - 1 + MENU_ITEMS.length) % MENU_ITEMS.length;
      this.render();
      return;
    }
    if (input === 'down' || input === 's') {
      this.selectedIndex = (this.selectedIndex + 1) % MENU_ITEMS.length;
      this.render();
      return;
    }
    if (input === 'enter') {
      this.activateSelected();
      return;
    }
    if (input === 'q' || input === 'escape') {
      this.actions.onQuit();
    }
  }

  activateSelected() {
    const selected = MENU_ITEMS[this.selectedIndex];
    if (selected.id === 'chompy') {
      this.actions.onStartChompy();
      return;
    }
    if (selected.id === 'quit') {
      this.actions.onQuit();
      return;
    }
    this.actions.onComingSoon(selected.label);
  }

  destroy() {
    this.screen.off('keypress', this.onKeypress);
    this.stopTitleAnimation();
    this.stopChaseAnimation();
    if (this.root) {
      this.root.destroy();
      this.root = null;
    }
  }
}

function escapeTagChar(char) {
  if (char === '{') {
    return '\\{';
  }
  if (char === '}') {
    return '\\}';
  }
  return char;
}

function clampNumber(value, fallback, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(numeric)));
}

module.exports = {
  MenuView,
  MENU_ITEMS,
};
