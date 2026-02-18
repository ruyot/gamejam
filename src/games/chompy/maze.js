'use strict';

const { isWallChar } = require('./walls');

function parseMaze(template, legend) {
  const pelletToken = asString(legend.pellet, '.');
  const powerPelletToken = asString(legend.powerPellet, 'o');
  const playerToken = asString(legend.playerStart, 'P');
  const ghostToken = asString(legend.ghostStart, 'G');
  const width = template.reduce((max, line) => Math.max(max, [...line].length), 0);
  const rows = template.map((line) => {
    const chars = [...line];
    while (chars.length < width) chars.push(' ');
    return chars;
  });

  const grid = [];
  const wallGrid = [];
  const pellets = new Set();
  const powerPellets = new Set();
  const ghostStarts = [];
  let playerStart = null;

  for (let y = 0; y < rows.length; y += 1) {
    grid[y] = [];
    wallGrid[y] = [];
    for (let x = 0; x < width; x += 1) {
      const char = rows[y][x];
      if (isWallChar(char)) {
        grid[y][x] = '#';
        wallGrid[y][x] = char;
        continue;
      }

      grid[y][x] = ' ';
      wallGrid[y][x] = null;
      const key = pointKey(x, y);
      if (char === pelletToken) {
        pellets.add(key);
      } else if (char === powerPelletToken) {
        powerPellets.add(key);
      } else if (char === playerToken) {
        playerStart = { x, y };
      } else if (char === ghostToken) {
        ghostStarts.push({ x, y });
      }
    }
  }

  if (!playerStart) {
    playerStart = findFirstWalkable(grid);
  }

  return {
    width,
    height: rows.length,
    grid,
    wallGrid,
    pellets,
    powerPellets,
    playerStart,
    ghostStarts,
  };
}

function expandGhostStarts(starts, grid) {
  const height = grid.length;
  const width = grid[0].length;
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);

  const result = starts.map((start) => ({ x: start.x, y: start.y }));
  const candidates = [
    { x: centerX - 1, y: centerY },
    { x: centerX + 1, y: centerY },
    { x: centerX, y: centerY - 1 },
    { x: centerX, y: centerY + 1 },
    { x: centerX, y: centerY },
  ];

  for (const candidate of candidates) {
    if (result.length >= 4) {
      break;
    }
    if (isWalkableInGrid(grid, candidate.x, candidate.y)) {
      result.push(candidate);
    }
  }

  if (result.length === 0) {
    result.push({ x: centerX, y: centerY });
  }

  while (result.length < 4) {
    result.push({ ...result[result.length - 1] });
  }

  return result.slice(0, 4);
}

function findFirstWalkable(grid) {
  for (let y = 0; y < grid.length; y += 1) {
    for (let x = 0; x < grid[y].length; x += 1) {
      if (grid[y][x] !== '#') {
        return { x, y };
      }
    }
  }
  return { x: 1, y: 1 };
}

function isWalkableInGrid(grid, x, y) {
  return grid[y] && grid[y][x] !== '#';
}

function pointKey(x, y) {
  return `${x},${y}`;
}

function asArray(value, fallback) {
  if (Array.isArray(value) && value.length > 0) {
    return value;
  }
  return fallback;
}

function asString(value, fallback) {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  return fallback;
}

module.exports = {
  parseMaze,
  expandGhostStarts,
  pointKey,
};
