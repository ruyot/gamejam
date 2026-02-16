'use strict';

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

module.exports = {
  chooseClosestOption,
  chooseFarthestOption,
};
