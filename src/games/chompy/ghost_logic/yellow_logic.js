'use strict';

const { chooseFarthestOption, findPath } = require('../pathing');

const RECALC_INTERVAL = 6;

function chooseMove(ghost, { player, mode, options, grid }) {
    if (options.length === 0) return null;

    if (mode === 'frightened') {
        ghost._cachedPath = null;
        return chooseFarthestOption(options, player.x, player.y);
    }

    if (!ghost._patrolDir) {
        ghost._patrolDir = 'down';
        ghost._cachedPath = null;
        ghost._pathStep = 0;
    }

    const mazeH = grid.length;
    const mazeW = grid[0].length;

    let targetY = ghost._patrolDir === 'down' ? mazeH - 2 : 1;
    let targetX = ghost.x;

    if (grid[targetY][targetX] === '#') {
        targetX = findNearestWalkableInRow(grid, targetY, ghost.x, mazeW);
    }

    if (Math.abs(ghost.y - targetY) <= 1) {
        ghost._patrolDir = ghost._patrolDir === 'down' ? 'up' : 'down';
        ghost._cachedPath = null;
        ghost._pathStep = 0;
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

function findNearestWalkableInRow(grid, row, startX, width) {
    for (let offset = 0; offset < width; offset++) {
        const left = startX - offset;
        const right = startX + offset;
        if (left >= 0 && grid[row][left] !== '#') return left;
        if (right < width && grid[row][right] !== '#') return right;
    }
    return startX;
}

module.exports = { chooseMove };
