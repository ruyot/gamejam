'use strict';

const { chooseFarthestOption, chooseClosestOption, findPath } = require('../pathing');

const ACTIVATION_RADIUS = 4;  // player must be this close to trigger chase
const CHASE_MOVES = 15;       // how many moves Pink chases before stopping
const RECALC_INTERVAL = 4;

function chooseMove(ghost, { player, mode, options, grid }) {
    if (options.length === 0) return null;

    if (!ghost._pinkState) {
        ghost._pinkState = 'roaming';
        ghost._campTarget = pickRandomWalkable(grid);
        ghost._chaseMoves = 0;
        ghost._cachedPath = null;
        ghost._pathStep = 0;
    }

    if (mode === 'frightened') {
        ghost._cachedPath = null;
        return chooseFarthestOption(options, player.x, player.y);
    }
    if (mode === 'scatter') {
        ghost._cachedPath = null;
        return chooseClosestOption(options, ghost.scatterTarget.x, ghost.scatterTarget.y);
    }
    if (mode === 'random') {
        ghost._cachedPath = null;
        return options[Math.floor(Math.random() * options.length)];
    }

    if (ghost._pinkState === 'roaming') {
        const camp = ghost._campTarget;
        if (!camp) {
            ghost._pinkState = 'camping';
            return null;
        }

        if (ghost.x === camp.x && ghost.y === camp.y) {
            ghost._pinkState = 'camping';
            ghost._cachedPath = null;
            return null;
        }

        return pathToward(ghost, camp.x, camp.y, options, grid);
    }
    if (ghost._pinkState === 'camping') {
        const dist = Math.abs(ghost.x - player.x) + Math.abs(ghost.y - player.y);
        if (dist <= ACTIVATION_RADIUS) {
            ghost._pinkState = 'chasing';
            ghost._chaseMoves = 0;
            ghost._cachedPath = null;
        }
        return null;
    }

    if (ghost._pinkState === 'chasing') {
        ghost._chaseMoves++;

        if (ghost._chaseMoves >= CHASE_MOVES) {
            ghost._campTarget = { x: ghost.x, y: ghost.y };
            ghost._pinkState = 'camping';
            ghost._cachedPath = null;
            return null;
        }

        return pathToward(ghost, player.x, player.y, options, grid);
    }

    return null;
}
function pathToward(ghost, targetX, targetY, options, grid) {
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
    return chooseClosestOption(options, targetX, targetY);
}

function pickRandomWalkable(grid) {
    const walkable = [];
    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[y].length; x++) {
            if (grid[y][x] !== '#') {
                walkable.push({ x, y });
            }
        }
    }
    if (walkable.length === 0) return null;
    return walkable[Math.floor(Math.random() * walkable.length)];
}

module.exports = { chooseMove };
