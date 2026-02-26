'use strict';

const blessed = require('blessed');
const { loadDesignSystem, colorize } = require('../design/system');

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
    this.startTitleAnimation();
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
