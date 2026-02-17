'use strict';

function getWallToken(wallGrid, x, y) {
  if (!wallGrid || !wallGrid[y]) {
    return '#';
  }
  return wallGrid[y][x] || '#';
}

function resolveWallGlyph({ grid, tileWidth, glyphs, wallToken, x, y }) {
  const connectedGlyph = getConnectedWallGlyph(grid, x, y, tileWidth);
  if (connectedGlyph) {
    return connectedGlyph;
  }

  if (wallToken === '#') {
    const fallbackGlyph = (x + y) % 2 === 0 ? glyphs.wallEven : glyphs.wallOdd;
    return padGlyph(fallbackGlyph, tileWidth);
  }

  const glyph = typeof wallToken === 'string' && wallToken.length > 0 ? wallToken : '#';
  if (glyph.length === 1) {
    return padGlyph(glyph.repeat(tileWidth), tileWidth);
  }
  return padGlyph(glyph, tileWidth);
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

function getConnectedWallGlyph(grid, x, y, tileWidth) {
  if (!isWallCell(grid, x, y)) {
    return null;
  }

  const up = isWallCell(grid, x, y - 1);
  const right = isWallCell(grid, x + 1, y);
  const down = isWallCell(grid, x, y + 1);
  const left = isWallCell(grid, x - 1, y);

  return expandWallConnectorGlyph(wallConnectorGlyph(up, right, down, left), tileWidth);
}

function isWallCell(grid, x, y) {
  return Boolean(grid[y] && grid[y][x] === '#');
}

function wallConnectorGlyph(up, right, down, left) {
  const mask = (up ? 1 : 0) | (right ? 2 : 0) | (down ? 4 : 0) | (left ? 8 : 0);
  switch (mask) {
    case 1:
    case 4:
    case 5:
      return '┃';
    case 2:
    case 8:
    case 10:
      return '━';
    case 3:
      return '┗';
    case 6:
      return '┏';
    case 12:
      return '┓';
    case 9:
      return '┛';
    case 7:
      return '┣';
    case 11:
      return '┻';
    case 14:
      return '┳';
    case 13:
      return '┫';
    case 15:
      return '╋';
    default:
      return '■';
  }
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
    return '┃'.repeat(width);
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
  return connector.repeat(width);
}

function padGlyph(value, width) {
  const text = String(value || '');
  if (text.length >= width) {
    return text.slice(0, width);
  }
  return text.padEnd(width, ' ');
}

module.exports = {
  getWallToken,
  resolveWallGlyph,
  resolveWallColor,
};
