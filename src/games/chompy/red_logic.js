'use strict';

const { chooseClosestOption, chooseFarthestOption } = require('./pathing');

/**
 * Red ghost (Blinky) — aggressive chaser.
 * TODO: Implement unique targeting logic.
 *
 * @param {object} ghost      - The ghost entity { x, y, dir, scatterTarget, ... }
 * @param {object} gameState  - { player, mode, options }
 *   player  – { x, y, dir }
 *   mode    – current ghost mode: 'chase' | 'scatter' | 'frightened' | 'random'
 *   options – array of { dir, x, y } valid moves
 * @returns {object|null} The chosen move { dir, x, y } or null
 */
function chooseMove(ghost, { player, mode, options }) {
    if (options.length === 0) return null;

    if (mode === 'frightened') {
        return chooseFarthestOption(options, player.x, player.y);
    }
    if (mode === 'random') {
        return options[Math.floor(Math.random() * options.length)];
    }

    const target =
        mode === 'chase'
            ? { x: player.x, y: player.y }
            : { x: ghost.scatterTarget.x, y: ghost.scatterTarget.y };

    return chooseClosestOption(options, target.x, target.y);
}

module.exports = { chooseMove };
