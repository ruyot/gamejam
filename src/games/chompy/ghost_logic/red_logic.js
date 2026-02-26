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

    const distToPlayer = Math.abs(ghost.x - player.x) + Math.abs(ghost.y - player.y);

    if (distToPlayer <= CLOSE_RANGE) {
        ghost._cachedPath = null;
        ghost._pathStep = 0;
        const path = findPath(grid, ghost.x, ghost.y, player.x, player.y);
        if (path.length > 0) {
            return pickMoveFromPath(path[0], options) || chooseClosestOption(options, player.x, player.y);
        }
        return chooseClosestOption(options, player.x, player.y);
    }

    if (!ghost._cachedPath || ghost._cachedPath.length === 0 ||
        !ghost._pathStep || ghost._pathStep >= RECALC_INTERVAL) {
        ghost._cachedPath = findPath(grid, ghost.x, ghost.y, player.x, player.y);
        ghost._pathStep = 0;
    }

    if (ghost._cachedPath && ghost._cachedPath.length > 0) {
        const nextPos = ghost._cachedPath.shift();
        ghost._pathStep = (ghost._pathStep || 0) + 1;
        const move = pickMoveFromPath(nextPos, options);
        if (move) return move;
    }

    ghost._cachedPath = null;
    return chooseClosestOption(options, player.x, player.y);
}

function pickMoveFromPath(nextPos, options) {
    return options.find(o => o.x === nextPos.x && o.y === nextPos.y) || null;
}

module.exports = { chooseMove };
