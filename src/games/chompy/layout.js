'use strict';

function getLayoutMetrics(frame, mazeWidth, mazeHeight, tileWidth) {
  const boardWidth = mazeWidth * tileWidth + 2;
  const boardHeight = mazeHeight + 2;
  const boardTop = 7;
  const statusTop = boardTop + boardHeight;
  const frameWidth = Math.max(finiteNumber(frame && frame.width, 82), boardWidth + 4);
  const frameHeight = Math.max(finiteNumber(frame && frame.height, 32), statusTop + 4);
  const minTerminalWidth = Math.max(
    finiteNumber(frame && frame.minTerminalWidth, frameWidth),
    frameWidth,
  );
  const minTerminalHeight = Math.max(
    finiteNumber(frame && frame.minTerminalHeight, frameHeight),
    frameHeight,
  );

  return {
    frameWidth,
    frameHeight,
    boardWidth,
    boardHeight,
    boardTop,
    statusTop,
    minTerminalWidth,
    minTerminalHeight,
  };
}

function renderResizeHint(hintText, minWidth, minHeight) {
  const dims = `${minWidth}x${minHeight}`;
  const hint = String(hintText || '').trim();

  if (!hint) {
    return `Resize to at least ${dims}.`;
  }
  if (/\d+\s*x\s*\d+/i.test(hint)) {
    return hint.replace(/\d+\s*x\s*\d+/i, dims);
  }
  return `${hint} (at least ${dims})`;
}

function finiteNumber(value, fallback) {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return numeric;
  }
  return fallback;
}

module.exports = {
  getLayoutMetrics,
  renderResizeHint,
};
