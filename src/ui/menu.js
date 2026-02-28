'use strict';

const blessed = require('blessed');
const { loadDesignSystem, colorize } = require('../design/system');

const GAME_ITEMS = [
  { id: 'chompy', label: 'Chompy' },
  { id: 'snake', label: 'Snake', comingSoon: true },
  { id: 'tetris', label: 'Tetris', comingSoon: true },
  { id: 'space-invaders', label: 'Space Invaders', comingSoon: true },
];

const UTIL_ITEMS = [
  { id: 'settings', label: 'Settings' },
  { id: 'quit', label: 'Quit' },
];

const ALL_ITEMS = [...GAME_ITEMS, ...UTIL_ITEMS];

class MenuView {
  constructor(screen, actions) {
    this.screen = screen;
    this.actions = actions;
    this.selectedIndex = 0;
    this.titleFrame = 0;
    this.titleTimer = null;
    this.design = loadDesignSystem().menu;
    this.onKeypress = this.onKeypress.bind(this);
    this.inSettings = false;
    this.settingsIndex = 0;
    this.soundEnabled = true;
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

    this.menuBoxLeft = blessed.box({
      parent: this.frame,
      top: 14,
      left: 11,
      width: 28,
      height: GAME_ITEMS.length + 1,
      tags: true,
      transparent: true,
      align: 'left',
    });

    this.menuBoxRight = blessed.box({
      parent: this.frame,
      top: 14,
      right: 3,
      width: 20,
      height: UTIL_ITEMS.length + 1,
      tags: true,
      transparent: true,
      align: 'left',
    });

    this.hintBox = blessed.box({
      parent: this.frame,
      bottom: 1,
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

    const renderItems = (items, startIndex, dimUnselected) => {
      return items.map((item, i) => {
        const globalIndex = startIndex + i;
        const isSelected = globalIndex === this.selectedIndex;
        const cursor = isSelected
          ? this.design.selectedCursor
          : dimUnselected ? ' ' : this.design.unselectedCursor;
        const labelColor = isSelected
          ? colors.selected
          : item.comingSoon
            ? colors.comingSoon
            : dimUnselected ? colors.comingSoon : colors.default;
        const suffix = item.comingSoon
          ? `  ${colorize(this.design.comingSoonSuffix, colors.comingSoonSuffix)}`
          : '';
        return `${colorize(cursor, colors.selected)} ${colorize(item.label, labelColor)}${suffix}`;
      });
    };

    this.menuBoxLeft.setContent(renderItems(GAME_ITEMS, 0, false).join('\n'));
    this.menuBoxRight.setContent(renderItems(UTIL_ITEMS, GAME_ITEMS.length, true).join('\n'));
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
    if (this.inSettings) {
      this.handleSettingsKey(input);
      return;
    }
    if (input === 'up' || input === 'w') {
      this.selectedIndex = (this.selectedIndex - 1 + ALL_ITEMS.length) % ALL_ITEMS.length;
      this.render();
      return;
    }
    if (input === 'down' || input === 's') {
      this.selectedIndex = (this.selectedIndex + 1) % ALL_ITEMS.length;
      this.render();
      return;
    }
    if (input === 'left') {
      if (this.selectedIndex >= GAME_ITEMS.length) {
        this.selectedIndex = 0;
        this.render();
      }
      return;
    }
    if (input === 'right') {
      if (this.selectedIndex < GAME_ITEMS.length) {
        this.selectedIndex = GAME_ITEMS.length;
        this.render();
      }
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
    const selected = ALL_ITEMS[this.selectedIndex];
    if (selected.id === 'chompy') {
      this.actions.onStartChompy();
      return;
    }
    if (selected.id === 'quit') {
      this.actions.onQuit();
      return;
    }
    if (selected.id === 'settings') {
      this.openSettings();
      return;
    }
    this.actions.onComingSoon(selected.label);
  }

  openSettings() {
    this.inSettings = true;
    this.settingsIndex = 0;

    const colors = this.design.colors;
    this.settingsOverlay = blessed.box({
      parent: this.frame,
      top: 1,
      left: 1,
      width: '100%-2',
      height: '100%-2',
      tags: true,
      style: { bg: colors.frameBg },
    });

    this.settingsHeader = blessed.box({
      parent: this.settingsOverlay,
      top: 2,
      left: 0,
      width: '100%',
      height: 3,
      tags: true,
      transparent: true,
      align: 'center',
    });

    this.settingsItems = blessed.box({
      parent: this.settingsOverlay,
      top: 6,
      left: 'center',
      width: 24,
      height: 4,
      tags: true,
      transparent: true,
      align: 'left',
    });

    this.settingsHint = blessed.box({
      parent: this.settingsOverlay,
      bottom: 1,
      left: 0,
      width: '100%',
      height: 1,
      tags: true,
      transparent: true,
      align: 'center',
    });

    this.renderSettings();
    this.screen.render();
  }

  closeSettings() {
    this.inSettings = false;
    if (this.settingsOverlay) {
      this.settingsOverlay.destroy();
      this.settingsOverlay = null;
      this.settingsHeader = null;
      this.settingsItems = null;
      this.settingsHint = null;
    }
    this.render();
  }

  renderSettings() {
    if (!this.settingsOverlay) return;
    const colors = this.design.colors;

    const header = colorize('Settings', colors.selected);
    const separator = colorize('─'.repeat(20), colors.frameBorder);
    this.settingsHeader.setContent(`${header}\n${separator}`);

    const items = [
      { label: `Sound: ${this.soundEnabled ? 'ON' : 'OFF'}` },
      { label: 'Back' },
    ];
    const lines = items.map((item, i) => {
      const cursor = i === this.settingsIndex ? '▶' : ' ';
      const color = i === this.settingsIndex ? colors.selected : colors.default;
      return `${colorize(cursor, colors.selected)} ${colorize(item.label, color)}`;
    });
    this.settingsItems.setContent(lines.join('\n'));

    this.settingsHint.setContent(
      colorize('[↑↓] Navigate  [Enter] Toggle  [Esc] Back', colors.hintNavigate),
    );
  }

  handleSettingsKey(input) {
    const itemCount = 2; // sound + back
    if (input === 'up' || input === 'w') {
      this.settingsIndex = (this.settingsIndex - 1 + itemCount) % itemCount;
      this.renderSettings();
      this.screen.render();
      return;
    }
    if (input === 'down' || input === 's') {
      this.settingsIndex = (this.settingsIndex + 1) % itemCount;
      this.renderSettings();
      this.screen.render();
      return;
    }
    if (input === 'enter') {
      if (this.settingsIndex === 0) {
        this.soundEnabled = !this.soundEnabled;
        this.renderSettings();
        this.screen.render();
      } else {
        this.closeSettings();
      }
      return;
    }
    if (input === 'escape' || input === 'q') {
      this.closeSettings();
    }
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
  MENU_ITEMS: ALL_ITEMS,
};
