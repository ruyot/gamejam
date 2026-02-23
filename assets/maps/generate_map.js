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
 * Borders are stripped based on grid position so segments merge seamlessly:
 *   - Corners keep their 2 outer walls only
 *   - Edges keep their 1 outward-facing wall only
 *   - Center keeps no walls
 *
 * Usage:  node generate_map.js
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
    return raw
        .replace(/\r/g, '')
        .split('\n')
        .filter((l) => l.length > 0 && !l.trimStart().startsWith(';'));
}

function flipHorizontal(lines) {
    return lines.map((line) => {
        const chars = [...line];
        chars.reverse();
        return chars.map((ch) => HORIZONTAL_MIRROR[ch] || ch).join('');
    });
}

function flipVertical(lines) {
    return [...lines].reverse().map((line) =>
        [...line].map((ch) => VERTICAL_MIRROR[ch] || ch).join('')
    );
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

/**
 * Strip borders from a segment based on its position in the 3×3 grid.
 *
 *   Grid position determines which walls to KEEP:
 *     row 0 → keep top,    row 2 → keep bottom,   row 1 → keep neither
 *     col 0 → keep left,   col 2 → keep right,    col 1 → keep neither
 *
 *   "Strip" means:
 *     - top:    remove first row entirely
 *     - bottom: remove last row entirely
 *     - left:   remove first character of each remaining row
 *     - right:  remove last character of each remaining row
 */
function stripBorders(lines, gridRow, gridCol) {
    let result = [...lines];

    // Vertical stripping (rows)
    const keepTop = gridRow === 0;
    const keepBottom = gridRow === 2;

    if (!keepBottom) result = result.slice(0, -1);   // strip bottom row
    if (!keepTop) result = result.slice(1);        // strip top row

    // Horizontal stripping (columns)
    const keepLeft = gridCol === 0;
    const keepRight = gridCol === 2;

    result = result.map((line) => {
        const chars = [...line];
        if (!keepRight) chars.pop();     // strip right column
        if (!keepLeft) chars.shift();   // strip left column
        return chars.join('');
    });

    return result;
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

    // Determine uniform tile size
    const allRaw = [rawA, rawB, rawC, rawD, rawCenter];
    const segWidth = Math.max(...allRaw.map(
        (seg) => seg.reduce((max, l) => Math.max(max, [...l].length), 0)
    ));
    const segHeight = Math.max(...allRaw.map((seg) => seg.length));

    // Pad all to uniform size, then apply mirroring
    const A = padLines(rawA, segWidth, segHeight);
    const B = padLines(rawB, segWidth, segHeight);
    const C = padLines(rawC, segWidth, segHeight);
    const D = padLines(rawD, segWidth, segHeight);
    const center = padLines(rawCenter, segWidth, segHeight);

    // Build full 3×3 grid (before border stripping)
    //
    //   [ A        ]  [ D        ]  [ flipH(A)  ]
    //   [ B        ]  [  center  ]  [ flipH(B)  ]
    //   [ flipV(C) ]  [ flipV(D) ]  [ flipHV(C) ]

    const rawGrid = [
        [A, D, flipHorizontal(A)],
        [B, center, flipHorizontal(B)],
        [flipVertical(C), flipVertical(D), flipBoth(C)],
    ];

    // Strip borders based on position
    const strippedGrid = rawGrid.map((row, r) =>
        row.map((seg, c) => stripBorders(seg, r, c))
    );

    // Stitch rows
    const outputLines = [];
    for (let row = 0; row < 3; row++) {
        const segs = strippedGrid[row];
        const rowHeight = segs[0].length;
        for (let lineIdx = 0; lineIdx < rowHeight; lineIdx++) {
            outputLines.push(segs.map((s) => s[lineIdx]).join(''));
        }
    }

    const mapWidth = [...outputLines[0]].length;
    const extraRow = '┃' + '.'.repeat(mapWidth - 2) + '┃';
    outputLines.splice(outputLines.length - 1, 0, extraRow);

    const lastRow = outputLines.length - 1;
    const edgeGap = Math.floor(lastRow / 4);
    const tunnelRows = [
        edgeGap,                                       
        Math.floor((edgeGap + (lastRow - edgeGap)) / 2), 
        lastRow - edgeGap,                                 
    ];

    for (const row of tunnelRows) {
        const chars = [...outputLines[row]];
        chars[0] = ' ';
        chars[chars.length - 1] = ' ';
        outputLines[row] = chars.join('');
    }
    console.log();
    console.log('┌──────────────────────────────────────────────┐');
    console.log('│         GENERATED SYMMETRIC MAP              │');
    console.log('│  5 unique segments · borders merged          │');
    console.log('└──────────────────────────────────────────────┘');
    console.log();
    console.log(`  Segments: A=${segA}  B=${segB}  C=${segC}  D=${segD}  center=8`);
    console.log();
    console.log(`  Layout:`);
    console.log(`    [ seg-${segA} ]  [ seg-${segD} ]  [ seg-${segA}H ]`);
    console.log(`    [ seg-${segB} ]  [ seg-8  ]  [ seg-${segB}H ]`);
    console.log(`    [ seg-${segC}V]  [ seg-${segD}V]  [ seg-${segC}HV]`);
    console.log();

    for (const line of outputLines) {
        console.log('  ' + line);
    }
    console.log();

    const outPath = path.join(__dirname, 'generated-map.txt');
    fs.writeFileSync(outPath, outputLines.join('\n') + '\n', 'utf8');
    console.log(`  Map saved to: ${outPath}`);
    console.log();
}

generateMap();
