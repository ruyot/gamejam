'use strict';

const { chooseFarthestOption, dijkstraChoose, chooseClosestOption } = require('../pathing');

/**
 * Red ghost (Blinky) — aggressive chaser.
 * Uses Dijkstra's shortest-path algorithm during chase mode
 * to always take the optimal route to the player.
 *
 * @param {object} ghost      - The ghost entity { x, y, dir, scatterTarget, ... }
 * @param {object} gameState  - { player, mode, options, grid }
 *   player  – { x, y, dir }
 *   mode    – current ghost mode: 'chase' | 'scatter' | 'frightened' | 'random'
 *   options – array of { dir, x, y } valid moves
 *   grid    – the maze grid (2D array, '#' = wall)
 * @returns {object|null} The chosen move { dir, x, y } or null
 */
function chooseMove(ghost, { player, mode, options, grid }) {
    if (options.length === 0) return null;

    if (mode === 'frightened') {
        return chooseFarthestOption(options, player.x, player.y);
    }
    if (mode === 'random') {
        return options[Math.floor(Math.random() * options.length)];
    }

    if (mode === 'chase') {
        // Dijkstra — always finds the true shortest path to the player
        return dijkstraChoose(options, player.x, player.y, grid);
    }

    // Scatter — head toward assigned corner using manhattan
    return chooseClosestOption(options, ghost.scatterTarget.x, ghost.scatterTarget.y);
}

module.exports = { chooseMove };
