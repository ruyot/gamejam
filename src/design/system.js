'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ASSETS_ROOT = path.resolve(__dirname, '..', '..', 'assets');

const DEFAULT_MENU_TITLE = [
  '  _____                         _                   ',
  ' / ____|                       | |                  ',
  '| |  __  __ _ _ __ ___   ___   | | __ _ _ __ ___   ',
  "| | |_ |/ _` | '_ ` _ \\ / _ \\  | |/ _` | '_ ` _ \\  ",
  '| |__| | (_| | | | | | |  __/  | | (_| | | | | | | ',
  ' \\_____|\\__,_|_| |_| |_|\\___|  |_|\\__,_|_| |_| |_| ',
];

const DEFAULT_CHOMPY_MAZE = [
  '###########################',
  '#o....#.........#....#...o#',
  '#.##.#.#####.#.#.#####.#..#',
  '#....#.....#.#.#.....#....#',
  '####.###.#.#.#.#.#.###.####',
  '#......#.#.....#.#......#.#',
  '#.######.#### ####.######.#',
  '#...........   ...........#',
  '###.###.### ##### ###.###.#',
  '#.#.#.#.# ### ### #.#.#.#.#',
  '#...#...#   G G   #...#...#',
  '#.#.#.#.# ####### #.#.#.#.#',
  '#...........   ...........#',
  '#.######.#### ###.######..#',
  '#o....#...P...#.......#..o#',
  '###.#.#.#####.#.#####.#.###',
  '#...#.#.....#.#.#.....#...#',
  '#.###.#####.#.#.#.#####.###',
  '###########################',
];

const DEFAULT_DESIGN = {
  menu: {
    frame: {
      width: 71,
      height: 26,
    },
    titleArtFile: 'art/menu-title.txt',
    subtitle: 'Terminal Arcade',
    selectedCursor: '>',
    unselectedCursor: ' ',
    comingSoonSuffix: '(soon)',
    bottomRule:
      '---------------------------------------------------------------------',
    hints: {
      navigate: '[UP/DOWN] Navigate',
      select: '[ENTER] Select',
      quit: '[Q] Quit',
    },
    colors: {
      screenBg: 16,
      frameBg: 17,
      frameFg: 255,
      frameBorder: 39,
      title: '#93c5fd',
      subtitle: '#7dd3fc',
      selected: '#fef08a',
      default: '#e2e8f0',
      comingSoon: '#94a3b8',
      comingSoonSuffix: '#64748b',
      hintNavigate: '#bae6fd',
      hintSelect: '#fde68a',
      hintQuit: '#fecaca',
      bottomRule: '#334155',
    },
  },
  chompy: {
    frame: {
      width: 82,
      height: 32,
      minTerminalWidth: 72,
      minTerminalHeight: 30,
    },
    title: '[ CHOMPY ]',
    status: {
      tooSmall: 'Terminal too small for GameJam',
      resizeHint: 'Resize to at least 72x30.',
    },
    controlsHint:
      '[Arrows/WASD] Move  [P/Space] Pause  [R] Restart  [Q/Esc] Menu',
    tileWidth: 2,
    ghostPalette: ['#ff5f5f', '#ff87d7', '#5fd7ff', '#ffaf5f'],
    maze: {
      file: 'maps/chompy-maze.txt',
      legend: {
        wall: ['#', '[', ']', '|', '+', '-'],
        pellet: '.',
        powerPellet: 'o',
        playerStart: 'P',
        ghostStart: 'G',
      },
    },
    glyphFiles: {},
    glyphs: {
      playerFrames: ['>'],
      playerDirectional: {
        right: ['>'],
        left: ['<'],
        up: ['v'],
        down: ['^'],
      },
      ghostNormal: ['ᗣ'],
      ghostReleased: ['ᗣ'],
      ghostFrightenedFrames: ['ᗣ', 'ᗣ'],
      pellet: ['·'],
      powerPelletFrames: ['●', '○'],
      wallEven: '#',
      wallOdd: '%',
      lifeFull: '>',
      lifeEmpty: '·',
    },
    colors: {
      screenBg: 16,
      frameBg: 17,
      frameFg: 230,
      frameBorder: 45,
      boardBorder: 38,
      title: '#93c5fd',
      controls: '#7dd3fc',
      controlsPause: '#fde68a',
      controlsRestart: '#fda4af',
      controlsQuit: '#fecaca',
      resizeBorder: 197,
      resizeBg: 17,
      resizeTitle: '#fecaca',
      resizeHint: '#fde68a',
      hudLabel: '#dbeafe',
      hudScore: '#facc15',
      hudLevel: '#7dd3fc',
      hudLives: '#fb7185',
      hudMode: '#86efac',
      statusGameOver: '#f87171',
      statusPaused: '#fef08a',
      statusLevelClear: '#86efac',
      statusReady: '#fbbf24',
      statusInfo: '#a5f3fc',
      player: '#fbbf24',
      ghostFrightenedA: '#60a5fa',
      ghostFrightenedB: '#bfdbfe',
      ghostReleased: '#64748b',
      pellet: '#f8fafc',
      powerPellet: '#fde047',
      wallEven: '#1d4ed8',
      wallOdd: '#2563eb',
    },
  },
};

function loadDesignSystem() {
  const userConfig = readJson(resolveAssetPath('design.json'), {});
  const merged = deepMerge(DEFAULT_DESIGN, userConfig);

  const menu = {
    ...merged.menu,
    titleArtLines: readTextLines(resolveAssetPath(merged.menu.titleArtFile), DEFAULT_MENU_TITLE),
    frameArtLines: readTextLines(resolveAssetPath(merged.menu.frameArtFile), []).filter(
      (line) => !line.trimStart().startsWith(';'),
    ),
  };

  const glyphFiles = merged.chompy.glyphFiles || {};
  const glyphs = merged.chompy.glyphs || {};
  const maze = merged.chompy.maze || {};
  const mazeLegend = maze.legend || {};

  const chompy = {
    ...merged.chompy,
    maze: {
      ...maze,
      legend: {
        ...mazeLegend,
        wall: asArray(mazeLegend.wall, DEFAULT_DESIGN.chompy.maze.legend.wall),
        pellet: asString(mazeLegend.pellet, DEFAULT_DESIGN.chompy.maze.legend.pellet),
        powerPellet: asString(
          mazeLegend.powerPellet,
          DEFAULT_DESIGN.chompy.maze.legend.powerPellet,
        ),
        playerStart: asString(
          mazeLegend.playerStart,
          DEFAULT_DESIGN.chompy.maze.legend.playerStart,
        ),
        ghostStart: asString(
          mazeLegend.ghostStart,
          DEFAULT_DESIGN.chompy.maze.legend.ghostStart,
        ),
      },
      lines: readMapLines(resolveAssetPath(maze.file), DEFAULT_CHOMPY_MAZE),
    },
    glyphs: {
      ...glyphs,
      playerFrames: readTextLines(
        resolveAssetPath(glyphFiles.playerFrames),
        asArray(glyphs.playerFrames, DEFAULT_DESIGN.chompy.glyphs.playerFrames),
      ),
      playerDirectional: {
        right: optionalTextLines(resolveAssetPath(glyphFiles.playerRightFrames))
          || asOptionalArray(glyphs.playerDirectional && glyphs.playerDirectional.right),
        left: optionalTextLines(resolveAssetPath(glyphFiles.playerLeftFrames))
          || asOptionalArray(glyphs.playerDirectional && glyphs.playerDirectional.left),
        up: optionalTextLines(resolveAssetPath(glyphFiles.playerUpFrames))
          || asOptionalArray(glyphs.playerDirectional && glyphs.playerDirectional.up),
        down: optionalTextLines(resolveAssetPath(glyphFiles.playerDownFrames))
          || asOptionalArray(glyphs.playerDirectional && glyphs.playerDirectional.down),
      },
      ghostNormal: readTextLines(
        resolveAssetPath(glyphFiles.ghostNormal),
        asLines(glyphs.ghostNormal, DEFAULT_DESIGN.chompy.glyphs.ghostNormal),
      ),
      ghostNormalDirectional: {
        right: optionalTextLines(resolveAssetPath(glyphFiles.ghostRightFrames)),
        left: optionalTextLines(resolveAssetPath(glyphFiles.ghostLeftFrames)),
        up: optionalTextLines(resolveAssetPath(glyphFiles.ghostUpFrames)),
        down: optionalTextLines(resolveAssetPath(glyphFiles.ghostDownFrames)),
      },
      ghostReleased: readTextLines(
        resolveAssetPath(glyphFiles.ghostReleased),
        asLines(glyphs.ghostReleased, DEFAULT_DESIGN.chompy.glyphs.ghostReleased),
      ),
      ghostFrightenedFrames: readTextLines(
        resolveAssetPath(glyphFiles.ghostFrightenedFrames),
        asArray(glyphs.ghostFrightenedFrames, DEFAULT_DESIGN.chompy.glyphs.ghostFrightenedFrames),
      ),
      pellet: readTextLines(
        resolveAssetPath(glyphFiles.pellet),
        asLines(glyphs.pellet, DEFAULT_DESIGN.chompy.glyphs.pellet),
      ),
      powerPelletFrames: readTextLines(
        resolveAssetPath(glyphFiles.powerPelletFrames),
        asArray(glyphs.powerPelletFrames, DEFAULT_DESIGN.chompy.glyphs.powerPelletFrames),
      ),
      wallEven: asString(glyphs.wallEven, DEFAULT_DESIGN.chompy.glyphs.wallEven),
      wallOdd: asString(glyphs.wallOdd, DEFAULT_DESIGN.chompy.glyphs.wallOdd),
      lifeFull: asString(glyphs.lifeFull, DEFAULT_DESIGN.chompy.glyphs.lifeFull),
      lifeEmpty: asString(glyphs.lifeEmpty, DEFAULT_DESIGN.chompy.glyphs.lifeEmpty),
    },
  };

  return {
    menu,
    chompy,
  };
}

function colorize(text, color) {
  if (!color) {
    return text;
  }
  return `{${color}-fg}${text}{/}`;
}

function resolveAssetPath(relativePath) {
  if (typeof relativePath !== 'string' || !relativePath.trim()) {
    return null;
  }
  if (path.isAbsolute(relativePath)) {
    return relativePath;
  }
  return path.join(ASSETS_ROOT, relativePath);
}

function readJson(filePath, fallbackValue) {
  if (!filePath) {
    return fallbackValue;
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (_error) {
    return fallbackValue;
  }
}

function readTextLines(filePath, fallbackLines) {
  if (!filePath) {
    return fallbackLines.slice();
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const lines = raw.replace(/\r/g, '').split('\n').filter((line) => line.length > 0);
    return lines.length > 0 ? lines : fallbackLines.slice();
  } catch (_error) {
    return fallbackLines.slice();
  }
}

function readMapLines(filePath, fallbackLines) {
  if (!filePath) {
    return fallbackLines.slice();
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const lines = raw
      .replace(/\r/g, '')
      .split('\n')
      .map((line) => line.replace(/\s+$/, ''))
      .filter((line) => line.length > 0 && !line.trimStart().startsWith(';'));
    return lines.length > 0 ? lines : fallbackLines.slice();
  } catch (_error) {
    return fallbackLines.slice();
  }
}

function optionalTextLines(filePath) {
  const lines = readTextLines(filePath, []).filter(
    (line) => line.trim().length > 0 && !line.trimStart().startsWith(';'),
  );
  return lines.length > 0 ? lines : null;
}

function deepMerge(baseValue, overrideValue) {
  if (Array.isArray(baseValue)) {
    return Array.isArray(overrideValue) ? overrideValue.slice() : baseValue.slice();
  }
  if (isRecord(baseValue)) {
    const result = { ...baseValue };
    if (!isRecord(overrideValue)) {
      return result;
    }
    for (const [key, value] of Object.entries(overrideValue)) {
      result[key] =
        key in baseValue ? deepMerge(baseValue[key], value) : cloneUnknown(value);
    }
    return result;
  }
  return overrideValue === undefined ? baseValue : overrideValue;
}

function cloneUnknown(value) {
  if (Array.isArray(value)) {
    return value.slice();
  }
  if (isRecord(value)) {
    const result = {};
    for (const [key, item] of Object.entries(value)) {
      result[key] = cloneUnknown(item);
    }
    return result;
  }
  return value;
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asOptionalArray(value) {
  if (Array.isArray(value) && value.length > 0) {
    return value.map((item) => String(item));
  }
  return null;
}

function asArray(value, fallbackValue) {
  if (Array.isArray(value) && value.length > 0) {
    return value.map((item) => String(item));
  }
  return fallbackValue.slice();
}

function asString(value, fallbackValue) {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  return fallbackValue;
}

function asLines(value, fallbackValue) {
  if (Array.isArray(value) && value.length > 0) {
    return value.map((item) => String(item));
  }
  if (typeof value === 'string' && value.length > 0) {
    return [value];
  }
  return Array.isArray(fallbackValue) ? fallbackValue.slice() : [String(fallbackValue)];
}

module.exports = {
  loadDesignSystem,
  colorize,
};
