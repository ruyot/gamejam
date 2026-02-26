'use strict';

const { DIRECTIONS } = require('./constants');

function chooseClosestOption(options, targetX, targetY) {
  return options.reduce((best, option) => {
    const distance = manhattan(option.x, option.y, targetX, targetY);
    if (!best || distance < best.distance || (distance === best.distance && Math.random() < 0.35)) {
      return { ...option, distance };
    }
    return best;
  }, null);
}

function chooseFarthestOption(options, targetX, targetY) {
  return options.reduce((best, option) => {
    const distance = manhattan(option.x, option.y, targetX, targetY);
    if (!best || distance > best.distance || (distance === best.distance && Math.random() < 0.35)) {
      return { ...option, distance };
    }
    return best;
  }, null);
}

function manhattan(ax, ay, bx, by) {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

/**
 * Dijkstra's shortest-path on the maze grid.
 * Returns a distance map: dist[y][x] = shortest distance from (startX, startY).
 * Walls are impassable. Supports horizontal wrap-around (tunnels).
 */
function dijkstra(grid, startX, startY) {
  const height = grid.length;
  const width = grid[0].length;

  const dist = Array.from({ length: height }, () =>
    new Array(width).fill(Infinity),
  );
  dist[startY][startX] = 0;

  // Simple BFS since all edge weights are 1
  const queue = [{ x: startX, y: startY }];
  let head = 0;

  while (head < queue.length) {
    const { x, y } = queue[head++];
    const d = dist[y][x];

    for (const [, delta] of Object.entries(DIRECTIONS)) {
      let nx = x + delta.x;
      const ny = y + delta.y;

      // Horizontal wrap-around (tunnels)
      if (nx < 0) nx = width - 1;
      else if (nx >= width) nx = 0;

      // Vertical bounds
      if (ny < 0 || ny >= height) continue;

      // Wall check
      if (grid[ny][nx] === '#') continue;

      if (d + 1 < dist[ny][nx]) {
        dist[ny][nx] = d + 1;
        queue.push({ x: nx, y: ny });
      }
    }
  }

  return dist;
}

/**
 * Find the full shortest path from (startX, startY) to (targetX, targetY).
 * Returns an array of {x, y} positions from start to target (inclusive).
 * Returns empty array if no path exists.
 */
function findPath(grid, startX, startY, targetX, targetY) {
  const height = grid.length;
  const width = grid[0].length;

  // BFS from target backwards so we can reconstruct the path forward
  const dist = Array.from({ length: height }, () =>
    new Array(width).fill(Infinity),
  );
  const prev = Array.from({ length: height }, () =>
    new Array(width).fill(null),
  );
  dist[targetY][targetX] = 0;

  const queue = [{ x: targetX, y: targetY }];
  let head = 0;

  while (head < queue.length) {
    const { x, y } = queue[head++];
    const d = dist[y][x];

    // Early exit if we reached the start
    if (x === startX && y === startY) break;

    for (const [, delta] of Object.entries(DIRECTIONS)) {
      let nx = x + delta.x;
      const ny = y + delta.y;

      if (nx < 0) nx = width - 1;
      else if (nx >= width) nx = 0;
      if (ny < 0 || ny >= height) continue;
      if (grid[ny][nx] === '#') continue;

      if (d + 1 < dist[ny][nx]) {
        dist[ny][nx] = d + 1;
        prev[ny][nx] = { x, y };
        queue.push({ x: nx, y: ny });
      }
    }
  }

  // No path
  if (dist[startY][startX] === Infinity) return [];

  // Reconstruct path forward: follow prev pointers from start to target
  const path = [];
  let cx = startX;
  let cy = startY;
  while (cx !== targetX || cy !== targetY) {
    const next = prev[cy][cx];
    if (!next) break;
    path.push({ x: next.x, y: next.y });
    cx = next.x;
    cy = next.y;
  }

  return path;
}

module.exports = {
  chooseClosestOption,
  chooseFarthestOption,
  dijkstra,
  dijkstraChoose,
  findPath,
};

