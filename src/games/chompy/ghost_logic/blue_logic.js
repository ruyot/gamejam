'use strict';

const { chooseFarthestOption, chooseClosestOption, findPath } = require('../pathing');

const RECALC_INTERVAL = 4;
const CLOSE_RANGE = 15;

function chooseMove(ghost, { player, mode, options, grid }) {
    if (options.length === 0) return null;

    if (mode === 'frightened') {
        ghost._cachedPath = null;
        return chooseFarthestOption(options, player.x, player.y);
    }
    if (mode === 'random') {
        ghost._cachedPath = null;
        return options[Math.floor(Math.random() * options.length)];
    }
    if (mode === 'scatter') {
        ghost._cachedPath = null;
        return chooseClosestOption(options, ghost.scatterTarget.x, ghost.scatterTarget.y);
    }

    const targetX = ghost._lastPlayerX != null ? ghost._lastPlayerX : player.x;
    const targetY = ghost._lastPlayerY != null ? ghost._lastPlayerY : player.y;
    ghost._lastPlayerX = player.x;
    ghost._lastPlayerY = player.y;

    const distToTarget = Math.abs(ghost.x - targetX) + Math.abs(ghost.y - targetY);

    if (distToTarget <= CLOSE_RANGE) {
        ghost._cachedPath = null;
        ghost._pathStep = 0;
        const path = findPath(grid, ghost.x, ghost.y, targetX, targetY);
        if (path.length > 0) {
            const move = pickMoveFromPath(path[0], options);
            if (move) return move;
        }
        return chooseClosestOption(options, targetX, targetY);
    }

    if (!ghost._cachedPath || ghost._cachedPath.length === 0 ||
        !ghost._pathStep || ghost._pathStep >= RECALC_INTERVAL) {
        ghost._cachedPath = findPath(grid, ghost.x, ghost.y, targetX, targetY);
        ghost._pathStep = 0;
    }

    if (ghost._cachedPath && ghost._cachedPath.length > 0) {
        const nextPos = ghost._cachedPath.shift();
        ghost._pathStep = (ghost._pathStep || 0) + 1;
        const move = pickMoveFromPath(nextPos, options);
        if (move) return move;
    }

    ghost._cachedPath = null;
    return chooseClosestOption(options, targetX, targetY);
}

function pickMoveFromPath(nextPos, options) {
    return options.find(o => o.x === nextPos.x && o.y === nextPos.y) || null;
}

module.exports = { chooseMove };
