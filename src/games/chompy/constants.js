'use strict';

const DIRECTIONS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE_DIRECTION = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

const MODE_SEQUENCE = [
  { name: 'scatter', duration: 7000 },
  { name: 'chase', duration: 20000 },
  { name: 'scatter', duration: 7000 },
  { name: 'chase', duration: 20000 },
  { name: 'random', duration: Number.POSITIVE_INFINITY },
];

const DEFAULT_GHOST_PALETTE = ['#ff5f5f', '#ff87d7', '#5fd7ff', '#ffaf5f'];

module.exports = {
  DIRECTIONS,
  OPPOSITE_DIRECTION,
  MODE_SEQUENCE,
  DEFAULT_GHOST_PALETTE,
};
