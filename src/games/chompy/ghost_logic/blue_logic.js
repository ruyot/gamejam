'use strict';

const { findPath } = require('../pathing');

const RECALC_INTERVAL = 4;
const ROW_SKIP = 3;

function chooseMove(ghost, { player, mode, options, grid }) {
    if (options.length === 0) return null;

    if (mode === 'frightened') {
        ghost._cachedPath = null;
        return options[Math.floor(Math.random() * options.length)];
    }
    if (mode === 'random') {
        ghost._cachedPath = null;
        return options[Math.floor(Math.random() * options.length)];
    }

    if (!ghost._patrolDir) {
        ghost._patrolDir = 'right';
        ghost._targetRow = ghost.y;
        ghost._cachedPath = null;
        ghost._pathStep = 0;
    }

    const mazeW = grid[0].length;
    const mazeH = grid.length;

    let targetX = ghost._patrolDir === 'right' ? mazeW - 2 : 1;
    let targetY = ghost._targetRow;

    if (grid[targetY] && grid[targetY][targetX] === '#') {
        targetY = findNearestWalkableInCol(grid, targetX, ghost._targetRow, mazeH);
    }
    if (Math.abs(ghost.x - targetX) <= 1 && Math.abs(ghost.y - ghost._targetRow) <= 1) {
        ghost._patrolDir = ghost._patrolDir === 'right' ? 'left' : 'right';
        ghost._targetRow += ROW_SKIP;
        if (ghost._targetRow >= mazeH - 1) {
            ghost._targetRow = 1;
        }
        while (ghost._targetRow < mazeH - 1 && isRowBlocked(grid, ghost._targetRow)) {
            ghost._targetRow++;
        }
        ghost._cachedPath = null;
        ghost._pathStep = 0;
    }

    targetX = ghost._patrolDir === 'right' ? mazeW - 2 : 1;
    targetY = ghost._targetRow;
    if (grid[targetY] && grid[targetY][targetX] === '#') {
        targetY = findNearestWalkableInCol(grid, targetX, ghost._targetRow, mazeH);
    }

    if (!ghost._cachedPath || ghost._cachedPath.length === 0 ||
        !ghost._pathStep || ghost._pathStep >= RECALC_INTERVAL) {
        ghost._cachedPath = findPath(grid, ghost.x, ghost.y, targetX, targetY);
        ghost._pathStep = 0;
    }

    if (ghost._cachedPath && ghost._cachedPath.length > 0) {
        const nextPos = ghost._cachedPath.shift();
        ghost._pathStep = (ghost._pathStep || 0) + 1;
        const move = options.find(o => o.x === nextPos.x && o.y === nextPos.y);
        if (move) return move;
    }

    ghost._cachedPath = null;
    return options[Math.floor(Math.random() * options.length)];
}

function findNearestWalkableInCol(grid, col, startY, height) {
    for (let offset = 0; offset < height; offset++) {
        const up = startY - offset;
        const down = startY + offset;
        if (up >= 0 && grid[up] && grid[up][col] !== '#') return up;
        if (down < height && grid[down] && grid[down][col] !== '#') return down;
    }
    return startY;
}

function isRowBlocked(grid, row) {
    if (!grid[row]) return true;
    for (let x = 0; x < grid[row].length; x++) {
        if (grid[row][x] !== '#') return false;
    }
    return true;
}

module.exports = { chooseMove };
