'use strict';

const blessed = require('blessed');
const { App } = require('./app');

const screen = blessed.screen({
  smartCSR: true,
  fullUnicode: true,
  dockBorders: true,
  autoPadding: false,
  title: 'GameJam - Terminal Arcade',
});

screen.program.hideCursor();

const app = new App(screen);
app.start();

screen.key(['C-c'], () => {
  app.exit(0);
});

process.on('SIGTERM', () => {
  app.exit(0);
});

process.on('uncaughtException', (error) => {
  try {
    screen.program.showCursor();
    screen.destroy();
  } catch (_err) {
    // Ignore cleanup failures and print original error below.
  }
  console.error('Unexpected GameJam error:', error);
  process.exit(1);
});
