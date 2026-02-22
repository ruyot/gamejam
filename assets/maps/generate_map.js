'use strict';

/**
 * Standalone symmetric map generator.
 *
 * Picks 5 unique segments (A, B, C, D + center-8) from the pool of 9
 * and composes a 3×3 grid with horizontal/vertical mirroring:
 *
 *   [ A          ]  [ D          ]  [ flipH(A)    ]
 *   [ B          ]  [ 8 (center) ]  [ flipH(B)    ]
 *   [ flipV(C)   ]  [ flipV(D)   ]  [ flipHV(C)   ]
 *
 * Usage:  node generate_map.js [--seed N]
 */

const fs = require('node:fs');
const path = require('node:path');

const SEGMENTS_DIR = path.join(__dirname, 'segments');
const CENTER_SEGMENT = 8;

// ── Box-drawing mirror tables ───────────────────────────────────────

const HORIZONTAL_MIRROR = {
    '┏': '┓', '┓': '┏',
    '┗': '┛', '┛': '┗',
    '┣': '┫', '┫': '┣',
    '┳': '┳', '┻': '┻',
    '╋': '╋',
    '━': '━', '┃': '┃',
};

const VERTICAL_MIRROR = {
    '┏': '┗', '┗': '┏',
    '┓': '┛', '┛': '┓',
    '┳': '┻', '┻': '┳',
    '┣': '┣', '┫': '┫',
    '╋': '╋',
    '━': '━', '┃': '┃',
};

// ── Helpers ─────────────────────────────────────────────────────────

function loadSegment(n) {
    const filePath = path.join(SEGMENTS_DIR, `segment-${n}.txt`);
    const raw = fs.readFileSync(filePath, 'utf8');
    const lines = raw
        .replace(/\r/g, '')
        .split('\n')
        .filter((l) => l.length > 0 && !l.trimStart().startsWith(';'));
    return lines;
}

function flipHorizontal(lines) {
    return lines.map((line) => {
        const chars = [...line];
        chars.reverse();
        return chars.map((ch) => HORIZONTAL_MIRROR[ch] || ch).join('');
    });
}

function flipVertical(lines) {
    const reversed = [...lines].reverse();
    return reversed.map((line) => {
        const chars = [...line];
        return chars.map((ch) => VERTICAL_MIRROR[ch] || ch).join('');
    });
}

function flipBoth(lines) {
    return flipVertical(flipHorizontal(lines));
}

function padLines(lines, width, height) {
    const padded = [];
    for (const l of lines.slice(0, height)) {
        const chars = [...l];
        while (chars.length < width) chars.push(' ');
        padded.push(chars.slice(0, width).join(''));
    }
    while (padded.length < height) {
        padded.push(' '.repeat(width));
    }
    return padded;
}

function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// ── Main ────────────────────────────────────────────────────────────

function generateMap() {
    // Pick 4 random segments from the non-center pool
    const pool = [1, 2, 3, 4, 5, 6, 7, 9];
    const picks = shuffle(pool).slice(0, 4);
    const [segA, segB, segC, segD] = picks;

    // Load raw segments
    const rawA = loadSegment(segA);
    const rawB = loadSegment(segB);
    const rawC = loadSegment(segC);
    const rawD = loadSegment(segD);
    const rawCenter = loadSegment(CENTER_SEGMENT);

    // Determine uniform tile size from segment files
    const segWidth = Math.max(
        ...[rawA, rawB, rawC, rawD, rawCenter].map(
            (seg) => seg.reduce((max, l) => Math.max(max, [...l].length), 0)
        )
    );
    const segHeight = Math.max(
        ...[rawA, rawB, rawC, rawD, rawCenter].map((seg) => seg.length)
    );

    // Pad all segments to uniform size
    const A = padLines(rawA, segWidth, segHeight);
    const B = padLines(rawB, segWidth, segHeight);
    const C = padLines(rawC, segWidth, segHeight);
    const D = padLines(rawD, segWidth, segHeight);
    const center = padLines(rawCenter, segWidth, segHeight);

    // Build the 3×3 grid with mirroring
    //
    //   [ A        ]  [ D        ]  [ flipH(A)  ]
    //   [ B        ]  [  center  ]  [ flipH(B)  ]
    //   [ flipV(C) ]  [ flipV(D) ]  [ flipHV(C) ]

    const grid = [
        [A, D, flipHorizontal(A)],
        [B, center, flipHorizontal(B)],
        [flipVertical(C), flipVertical(D), flipBoth(C)],
    ];

    // Stitch rows
    const outputLines = [];
    for (let row = 0; row < 3; row++) {
        for (let lineIdx = 0; lineIdx < segHeight; lineIdx++) {
            outputLines.push(
                grid[row][0][lineIdx] +
                grid[row][1][lineIdx] +
                grid[row][2][lineIdx]
            );
        }
    }

    // Print header
    console.log();
    console.log('┌──────────────────────────────────────────────┐');
    console.log('│         GENERATED SYMMETRIC MAP              │');
    console.log('│  5 unique segments + mirroring               │');
    console.log('└──────────────────────────────────────────────┘');
    console.log();
    console.log(`  Segments used: A=${segA}  B=${segB}  C=${segC}  D=${segD}  center=8`);
    console.log();
    console.log(`  Layout:`);
    console.log(`    [ seg-${segA} ]  [ seg-${segD} ]  [ seg-${segA}H ]`);
    console.log(`    [ seg-${segB} ]  [ seg-8  ]  [ seg-${segB}H ]`);
    console.log(`    [ seg-${segC}V]  [ seg-${segD}V]  [ seg-${segC}HV]`);
    console.log();

    // Print map
    for (const line of outputLines) {
        console.log('  ' + line);
    }
    console.log();

    // Also write to file for later use
    const outPath = path.join(__dirname, 'generated-map.txt');
    fs.writeFileSync(outPath, outputLines.join('\n') + '\n', 'utf8');
    console.log(`  Map saved to: ${outPath}`);
    console.log();
}

generateMap();
