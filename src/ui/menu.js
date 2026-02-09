'use strict';

const blessed = require('blessed');

const MENU_ITEMS = [
  { id: 'chompy', label: 'Chompy' },
  { id: 'snake', label: 'Snake', comingSoon: true },
  { id: 'tetris', label: 'Tetris', comingSoon: true },
  { id: 'space-invaders', label: 'Space Invaders', comingSoon: true },
  { id: 'quit', label: 'Quit' },
];

const TITLE_ART = [
  ' ██████╗  █████╗ ███╗   ███╗███████╗     ██╗ █████╗ ███╗   ███╗ ',
  '██╔════╝ ██╔══██╗████╗ ████║██╔════╝     ██║██╔══██╗████╗ ████║ ',
  '██║  ███╗███████║██╔████╔██║█████╗       ██║███████║██╔████╔██║ ',
  '██║   ██║██╔══██║██║╚██╔╝██║██╔══╝  ██   ██║██╔══██║██║╚██╔╝██║ ',
  '╚██████╔╝██║  ██║██║ ╚═╝ ██║███████╗╚█████╔╝██║  ██║██║ ╚═╝ ██║ ',
  ' ╚═════╝ ╚═╝  ╚═╝╚═╝     ╚═╝╚══════╝ ╚════╝ ╚═╝  ╚═╝╚═╝     ╚═╝ ',
];

class MenuView {
  constructor(screen, actions) {
    this.screen = screen;
    this.actions = actions;
    this.selectedIndex = 0;
    this.onKeypress = this.onKeypress.bind(this);
  }

  mount() {
    this.createLayout();
    this.render();
    this.screen.on('keypress', this.onKeypress);
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
      width: 71,
      height: 26,
      border: 'line',
      tags: true,
      style: {
        fg: 255,
        bg: 17,
        border: { fg: 39 },
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
      content: TITLE_ART.map((line) => `{#93c5fd-fg}${line}{/}`).join('\n'),
    });

    this.subtitleBox = blessed.box({
      parent: this.frame,
      top: 9,
      left: 2,
      width: '100%-4',
      height: 2,
      tags: true,
      align: 'center',
      content: '{#7dd3fc-fg}Terminal Arcade{/}',
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
      content:
        '{#bae6fd-fg}[↑↓] Navigate{/}  {#fde68a-fg}[ENTER] Select{/}  {#fecaca-fg}[Q] Quit{/}',
    });

    this.bottomBorder = blessed.box({
      parent: this.frame,
      bottom: 1,
      left: 0,
      width: '100%',
      height: 1,
      tags: true,
      align: 'center',
      content: '{#334155-fg}─────────────────────────────────────────────────────────────────────{/}',
    });
  }

  render() {
    const lines = MENU_ITEMS.map((item, index) => {
      const isSelected = index === this.selectedIndex;
      const cursor = isSelected ? '▸' : ' ';
      const label = item.comingSoon ? `${item.label}  {#64748b-fg}(soon){/}` : item.label;
      const color = isSelected ? '#fef08a' : item.comingSoon ? '#94a3b8' : '#e2e8f0';
      return `${cursor} {${color}-fg}${label}{/}`;
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
