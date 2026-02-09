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
    this.design = loadDesignSystem().menu;
    this.onKeypress = this.onKeypress.bind(this);
  }

  mount() {
    this.createLayout();
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
        border: { fg: colors.frameBorder },
      },
    });

    this.titleBox = blessed.box({
      parent: this.frame,
      top: 1,
      left: 2,
      width: '100%-4',
      height: 8,
      tags: true,
      align: 'center',
      content: this.design.titleArtLines
        .map((line) => colorize(line, colors.title))
        .join('\n'),
    });

    this.subtitleBox = blessed.box({
      parent: this.frame,
      top: 9,
      left: 2,
      width: '100%-4',
      height: 2,
      tags: true,
      align: 'center',
      content: colorize(this.design.subtitle, colors.subtitle),
    });

    this.menuBox = blessed.box({
      parent: this.frame,
      top: 12,
      left: 'center',
      width: 30,
      height: 7,
      tags: true,
      align: 'left',
    });

    this.hintBox = blessed.box({
      parent: this.frame,
      bottom: 3,
      left: 2,
      width: '100%-4',
      height: 2,
      tags: true,
      align: 'center',
      content: [
        colorize(this.design.hints.navigate, colors.hintNavigate),
        colorize(this.design.hints.select, colors.hintSelect),
        colorize(this.design.hints.quit, colors.hintQuit),
      ].join('  '),
    });

    this.bottomBorder = blessed.box({
      parent: this.frame,
      bottom: 1,
      left: 0,
      width: '100%',
      height: 1,
      tags: true,
      align: 'center',
      content: colorize(this.design.bottomRule, colors.bottomRule),
    });
  }

  render() {
    const colors = this.design.colors;

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
    if (this.root) {
      this.root.destroy();
      this.root = null;
    }
  }
}

module.exports = {
  MenuView,
  MENU_ITEMS,
};
