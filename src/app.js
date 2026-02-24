'use strict';

const blessed = require('blessed');
const { MenuView } = require('./ui/menu');
const { ChompyGame } = require('./games/chompy');

class App {
  constructor(screen) {
    this.screen = screen;
    this.activeView = null;
    this.toast = null;
    this.toastTimer = null;
    this.exiting = false;
  }

  start() {
    this.showMenu();
  }

  showMenu() {
    this.setView(
      new MenuView(this.screen, {
        onStartChompy: () => this.startChompy(),
        onComingSoon: () => this.showToast('Coming Soon'),
        onQuit: () => this.exit(0),
      }),
    );
  }

  startChompy() {
    this.setView(
      new ChompyGame(this.screen, {
        onExit: () => this.showMenu(),
      }),
    );
  }

  showToast(message) {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
    if (this.toast) {
      this.toast.destroy();
      this.toast = null;
    }

    const width = Math.max(28, Math.min(58, message.length + 8));
    this.toast = blessed.box({
      parent: this.screen,
      top: 2,
      left: 'center',
      width,
      height: 3,
      align: 'center',
      valign: 'middle',
      border: 'line',
      tags: true,
      style: {
        fg: 15,
        bg: 16,
        border: { fg: 15, bg: 16 },
      },
      content: `{#ffffff-fg}${message}{/}`,
    });

    this.screen.render();

    this.toastTimer = setTimeout(() => {
      if (this.toast) {
        this.toast.destroy();
        this.toast = null;
      }
      this.toastTimer = null;
      this.screen.render();
    }, 1300);
  }

  setView(nextView) {
    if (this.activeView) {
      this.activeView.destroy();
    }
    this.activeView = nextView;
    this.activeView.mount();
  }

  exit(code = 0) {
    if (this.exiting) {
      return;
    }
    this.exiting = true;

    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
    if (this.toast) {
      this.toast.destroy();
      this.toast = null;
    }
    if (this.activeView) {
      this.activeView.destroy();
      this.activeView = null;
    }

    this.screen.program.showCursor();
    this.screen.destroy();
    process.exit(code);
  }
}

module.exports = { App };
