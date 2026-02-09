'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SCORE_DIR = path.join(os.homedir(), '.gamejam');
const SCORE_FILE = path.join(SCORE_DIR, 'highscores.json');

function loadScores() {
  try {
    const raw = fs.readFileSync(SCORE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
  } catch (_err) {
    // Missing or malformed file falls back to defaults.
  }
  return { chompy: 0 };
}

function saveScore(game, score) {
  const previous = loadScores();
  const next = {
    ...previous,
    [game]: Math.max(Number(previous[game] || 0), Number(score || 0)),
  };

  try {
    fs.mkdirSync(SCORE_DIR, { recursive: true });
    fs.writeFileSync(SCORE_FILE, JSON.stringify(next, null, 2));
    return next;
  } catch (_err) {
    return previous;
  }
}

module.exports = {
  SCORE_FILE,
  loadScores,
  saveScore,
};
