'use strict';

const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '..', '..', 'assets');

/**
 * Load an art file and return its lines.
 */
function loadArtLines(filename) {
    const filepath = path.join(ASSETS_DIR, filename);
    if (!fs.existsSync(filepath)) return [];
    return fs.readFileSync(filepath, 'utf8').split('\n');
}

/**
 * Downsample ASCII art into a smaller grid.
 * Each output cell represents a block of the original art.
 * If the block has enough non-space characters, it becomes a filled cell.
 */
function downsampleArt(lines, targetRows, targetCols) {
    if (lines.length === 0) return [];

    // Trim trailing empty lines
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
        lines = lines.slice(0, -1);
    }

    const srcRows = lines.length;
    const srcCols = Math.max(...lines.map((l) => l.length));

    const blockH = Math.max(1, Math.floor(srcRows / targetRows));
    const blockW = Math.max(1, Math.floor(srcCols / targetCols));

    const result = [];
    for (let ty = 0; ty < targetRows; ty++) {
        let row = '';
        for (let tx = 0; tx < targetCols; tx++) {
            const startY = ty * blockH;
            const startX = tx * blockW;
            let filled = 0;
            let total = 0;
            const counts = {};
            for (let dy = 0; dy < blockH; dy++) {
                const line = lines[startY + dy] || '';
                for (let dx = 0; dx < blockW; dx++) {
                    total++;
                    const ch = line[startX + dx];
                    if (ch && ch !== ' ') {
                        filled++;
                        counts[ch] = (counts[ch] || 0) + 1;
                    }
                }
            }
            const density = total > 0 ? filled / total : 0;
            if (density > 0.25) {
                let best = '█';
                let bestCount = 0;
                for (const [ch, count] of Object.entries(counts)) {
                    if (count > bestCount) {
                        best = ch;
                        bestCount = count;
                    }
                }
                row += best;
            } else {
                row += ' ';
            }
        }
        result.push(row);
    }
    return result;
}

/**
 * Load and downsample all chase animation sprites.
 * Returns objects with { lines, width, height } for each sprite.
 */
function loadChaseSprites(targetRows, targetCols) {
    const playerRight = downsampleArt(
        loadArtLines('art/chompy-player-right.txt'),
        targetRows,
        targetCols,
    );
    const playerLeft = downsampleArt(
        loadArtLines('art/chompy-player-left.txt'),
        targetRows,
        targetCols,
    );
    const ghostRight = downsampleArt(
        loadArtLines('art/chompy-ghost-right.txt'),
        targetRows,
        targetCols,
    );
    const ghostLeft = downsampleArt(
        loadArtLines('art/chompy-ghost-left.txt'),
        targetRows,
        targetCols,
    );
    const ghostFrightened = downsampleArt(
        loadArtLines('art/chompy-ghost-frightened.txt'),
        targetRows,
        targetCols,
    );

    return {
        playerRight: makeSprite(playerRight),
        playerLeft: makeSprite(playerLeft),
        ghostRight: makeSprite(ghostRight),
        ghostLeft: makeSprite(ghostLeft),
        ghostFrightened: makeSprite(ghostFrightened),
    };
}

function makeSprite(lines) {
    // Trim empty rows from top and bottom
    while (lines.length > 0 && lines[0].trim() === '') lines.shift();
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
    const width = Math.max(0, ...lines.map((l) => l.replace(/\s+$/, '').length));
    return {
        lines,
        width,
        height: lines.length,
    };
}

module.exports = {
    loadChaseSprites,
    downsampleArt,
};
