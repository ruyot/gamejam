'use strict';

// All box-drawing characters that are treated as walls
const WALL_CHARS = new Set([
  '━', '┃', '┏', '┓', '┗', '┛', '┣', '┫', '┳', '┻', '╋', '■', '#',
]);

function isWallChar(char) {
  return WALL_CHARS.has(char);
}

function getWallToken(wallGrid, x, y) {
  if (!wallGrid || !wallGrid[y]) {
    return '#';
  }
  return wallGrid[y][x] || '#';
}

function resolveWallGlyph({ tileWidth, wallToken }) {
  // Render the wall character directly — no auto-connector logic.
  // expandWallConnectorGlyph handles doubling horizontal chars for tileWidth > 1.
  return expandWallConnectorGlyph(wallToken, tileWidth);
}

function resolveWallColor({ colors, wallToken, x, y }) {
  const tokenPalette = colors.wallByToken;
  if (tokenPalette && typeof tokenPalette === 'object') {
    const tokenColor = tokenPalette[wallToken];
    if (tokenColor !== undefined && tokenColor !== null && tokenColor !== '') {
      return tokenColor;
    }
  }

  if (wallToken === '#') {
    return (x + y) % 2 === 0 ? colors.wallEven : colors.wallOdd;
  }
  return colors.wallOdd;
}

function expandWallConnectorGlyph(char, width) {
  const connector = String(char || '■');
  if (width <= 1) {
    return connector;
  }

  if (connector === '━') {
    return '━'.repeat(width);
  }
  if (connector === '┃') {
    return '┃' + ' '.repeat(width - 1);
  }
  if (connector === '┓' || connector === '┛' || connector === '┫') {
    return `${'━'.repeat(width - 1)}${connector}`;
  }
  if (
    connector === '┏' ||
    connector === '┗' ||
    connector === '┣' ||
    connector === '┳' ||
    connector === '┻' ||
    connector === '╋'
  ) {
    return `${connector}${'━'.repeat(width - 1)}`;
  }
  // Vertical-only or unknown: pad with space
  return connector + ' '.repeat(width - 1);
}

module.exports = {
  isWallChar,
  getWallToken,
  resolveWallGlyph,
  resolveWallColor,
};
