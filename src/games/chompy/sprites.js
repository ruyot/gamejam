'use strict';

function pickDirectionalFrame(sprite, direction, frameCounter, divisor) {
  if (!sprite) {
    return '?';
  }
  const frames = sprite[direction] || sprite.right;
  if (!Array.isArray(frames) || frames.length === 0) {
    return '?';
  }
  if (frames.length === 1) {
    return frames[0];
  }
  const index = Math.floor(frameCounter / divisor) % frames.length;
  return frames[index];
}

function buildSpriteSet(glyphs, tileWidth) {
  return {
    player: buildDirectionalSprite(glyphs.playerFrames, tileWidth, glyphs.playerDirectional),
    ghostNormal: buildDirectionalSprite(
      glyphs.ghostNormal,
      tileWidth,
      glyphs.ghostNormalDirectional,
    ),
    ghostReleased: buildDirectionalSprite(glyphs.ghostReleased, tileWidth),
    ghostFrightened: buildDirectionalSprite(glyphs.ghostFrightenedFrames, tileWidth),
    pellet: buildDirectionalSprite(glyphs.pellet, tileWidth),
    powerPellet: buildDirectionalSprite(glyphs.powerPelletFrames, tileWidth),
  };
}

function buildDirectionalSprite(lines, tileWidth, overrides) {
  const frames = splitArtFrames(lines);
  const rightFrames = frames.map((frame) => artToTile(frame, tileWidth, 'horizontal'));
  const leftFrames = frames.map((frame) =>
    artToTile(mirrorArt(frame), tileWidth, 'horizontal'),
  );
  const upFrames = frames.map((frame) => artToTile(flipArt(frame), tileWidth, 'vertical'));
  const downFrames = frames.map((frame) =>
    artToTile(mirrorArt(flipArt(frame)), tileWidth, 'vertical'),
  );

  const overrideRight = compileOverrideFrames(overrides && overrides.right, tileWidth);
  const overrideLeft = compileOverrideFrames(overrides && overrides.left, tileWidth);
  const overrideUp = compileOverrideFrames(overrides && overrides.up, tileWidth);
  const overrideDown = compileOverrideFrames(overrides && overrides.down, tileWidth);

  return {
    right: overrideRight || rightFrames,
    left: overrideLeft || leftFrames,
    up: overrideUp || upFrames,
    down: overrideDown || downFrames,
  };
}

function compileOverrideFrames(lines, tileWidth) {
  if (!Array.isArray(lines) || lines.length === 0) {
    return null;
  }
  return splitArtFrames(lines).map((frame) => artToTile(frame, tileWidth, 'horizontal'));
}

function splitArtFrames(lines) {
  if (!Array.isArray(lines) || lines.length === 0) {
    return [['?']];
  }
  const normalized = lines.map((line) => String(line));
  const isSingleCharFrameList = normalized.every(
    (line) => line.length > 0 && line.length <= 3 && !/\s/.test(line),
  );
  if (isSingleCharFrameList && normalized.length > 1) {
    return normalized.map((line) => [line]);
  }
  return [normalized];
}

function artToTile(lines, tileWidth, mode) {
  const matrix = normalizeArt(lines);
  if (matrix.length === 0 || matrix[0].length === 0) {
    return tileGlyph(' ', tileWidth);
  }
  if (mode === 'vertical' && tileWidth >= 2) {
    const topDensity = regionDensity(matrix, 0, matrix[0].length, 0, Math.ceil(matrix.length / 2));
    const bottomDensity = regionDensity(
      matrix,
      0,
      matrix[0].length,
      Math.floor(matrix.length / 2),
      matrix.length,
    );
    const pair = [densityToGlyph(topDensity), densityToGlyph(bottomDensity)].join('');
    return tileGlyph(pair, tileWidth);
  }

  const chunkWidth = matrix[0].length / tileWidth;
  let output = '';
  for (let index = 0; index < tileWidth; index += 1) {
    const startX = Math.floor(index * chunkWidth);
    const endX = Math.floor((index + 1) * chunkWidth);
    const density = regionDensity(matrix, startX, Math.max(startX + 1, endX), 0, matrix.length);
    output += densityToGlyph(density);
  }
  return tileGlyph(output, tileWidth);
}

function normalizeArt(lines) {
  const withoutTopBottomBlanks = trimVertical(lines.map((line) => String(line)));
  if (withoutTopBottomBlanks.length === 0) {
    return [];
  }

  const charRows = withoutTopBottomBlanks.map((line) => Array.from(line));
  let minX = Number.POSITIVE_INFINITY;
  let maxX = -1;

  for (const row of charRows) {
    for (let index = 0; index < row.length; index += 1) {
      if (isInk(row[index])) {
        minX = Math.min(minX, index);
        maxX = Math.max(maxX, index);
      }
    }
  }

  if (maxX < minX) {
    return [];
  }

  const width = maxX - minX + 1;
  return charRows.map((row) => {
    const cropped = row.slice(minX, maxX + 1);
    while (cropped.length < width) {
      cropped.push(' ');
    }
    return cropped;
  });
}

function trimVertical(lines) {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start].trim().length === 0) {
    start += 1;
  }
  while (end > start && lines[end - 1].trim().length === 0) {
    end -= 1;
  }
  return lines.slice(start, end);
}

function mirrorArt(lines) {
  return lines.map((line) => Array.from(line).reverse().join(''));
}

function flipArt(lines) {
  return lines.slice().reverse();
}

function regionDensity(matrix, startX, endX, startY, endY) {
  let filled = 0;
  let total = 0;
  for (let y = Math.max(0, startY); y < Math.min(matrix.length, endY); y += 1) {
    for (let x = Math.max(0, startX); x < Math.min(matrix[y].length, endX); x += 1) {
      total += 1;
      if (isInk(matrix[y][x])) {
        filled += 1;
      }
    }
  }
  return total > 0 ? filled / total : 0;
}

function isInk(char) {
  return char !== ' ' && char !== '\t';
}

function densityToGlyph(value) {
  if (value <= 0.05) return ' ';
  if (value <= 0.2) return '.';
  if (value <= 0.35) return ':';
  if (value <= 0.5) return '=';
  if (value <= 0.7) return '+';
  if (value <= 0.85) return '*';
  return '#';
}

function tileGlyph(value, width) {
  const text = String(value || '');
  if (text.length >= width) {
    return text.slice(0, width);
  }
  return text.padEnd(width, ' ');
}

module.exports = {
  buildSpriteSet,
  pickDirectionalFrame,
};
