#!/usr/bin/env python3
"""Preview all segments joined in a 3x3 grid with segment-8 in the center."""

import os

SEGMENTS_DIR = os.path.dirname(os.path.abspath(__file__)) + "/segments"

def load_segment(n):
    path = os.path.join(SEGMENTS_DIR, f"segment-{n}.txt")
    with open(path, encoding="utf-8") as f:
        lines = [l.rstrip("\n") for l in f.readlines()]
    # Strip trailing blank lines
    while lines and lines[-1].strip() == "":
        lines.pop()
    return lines

def pad_lines(lines, width=9, height=10):
    """Ensure each segment has exactly width chars and height rows."""
    padded = []
    for l in lines[:height]:
        # pad or trim to width (in characters, not bytes)
        chars = list(l)
        if len(chars) < width:
            chars += [" "] * (width - len(chars))
        padded.append("".join(chars[:width]))
    while len(padded) < height:
        padded.append(" " * width)
    return padded

# 3x3 grid layout — segment 8 (index 8) in the center (position [1][1])
# Remaining 8 segments placed randomly around it
import random
others = [1, 2, 3, 4, 5, 6, 7, 9]
random.shuffle(others)

# Grid positions (row, col) — center is (1,1)
positions = [(r, c) for r in range(3) for c in range(3) if not (r == 1 and c == 1)]
grid = [[None] * 3 for _ in range(3)]
grid[1][1] = 8
for (r, c), seg in zip(positions, others):
    grid[r][c] = seg

# Load and pad all
loaded = {n: pad_lines(load_segment(n)) for n in range(1, 10)}

# Stitch rows
rows_of_text = []
for row in range(3):
    segs = [loaded[grid[row][col]] for col in range(3)]
    for line_i in range(10):
        rows_of_text.append("  ".join(s[line_i] for s in segs))

# Print layout header
print()
print("  ┌─────────────────────────────────────────────────────┐")
print("  │              GAMEJAM MAP PREVIEW                    │")
print("  │  Layout: 3×3 grid  │  Segment 8 = center           │")
print("  └─────────────────────────────────────────────────────┘")
print()

# Print column headers
col_labels = [f"  seg-{grid[0][c]}  " for c in range(3)]
header_line = "  " + "   ".join(
    f"[{grid[r][c]:>2}]" for r in range(1) for c in range(3)
)

for row in range(3):
    labels = "  ".join(f"[ seg {grid[row][col]:>2} ]" for col in range(3))
    print(f"  {labels}")
    row_lines = rows_of_text[row * 10 : (row + 1) * 10]
    for l in row_lines:
        print("  " + l)
    print()
