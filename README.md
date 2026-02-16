# GameJam - Terminal Game Arcade

GameJam is a terminal arcade built with Node.js and `blessed`.

Current MVP includes:
- Polished title menu with keyboard navigation
- `Chompy` (Pac-Man-inspired) playable in terminal
- Pellets + power pellets + ghost behavior modes
- Score, lives, level progression, and persistent high score
- Externalized design assets for easy art/theme iteration

## Run

```bash
npm install
npm start
```

Planned distribution command:

```bash
npx gamejam
```

## Controls

| Action | Keys |
| --- | --- |
| Move | Arrow keys or `W/A/S/D` |
| Pause | `P` or `Space` |
| Restart run | `R` |
| Quit to menu / exit | `Q` or `Esc` |
| Select menu item | `Enter` |

## Notes

- High score is saved to `~/.gamejam/highscores.json`.
- Recommended terminal size: at least `72x30`.

## Design Workflow

All visual styling and ASCII art can be edited without touching game logic:

- `assets/design.json` controls labels, hints, colors, and glyph file paths.
- `assets/design.json` `menu.titleAnimation.speedMs` controls rainbow title animation speed.
- `assets/design.json` also controls maze file + tile legend + map tile width.
- `assets/art/menu-frame.txt` controls menu page border/background ASCII art.
- `assets/art/menu-title.txt` controls the menu title art.
- `assets/art/chompy-player.txt` controls player source art.
- `assets/art/chompy-player-right.txt` controls explicit player right-facing art.
- `assets/art/chompy-player-left.txt` controls explicit player left-facing art.
- `assets/art/chompy-player-up.txt` controls explicit player up-facing art.
- `assets/art/chompy-player-down.txt` controls explicit player down-facing art.
- `assets/art/chompy-ghost-normal.txt` controls regular ghost source art.
- `assets/art/chompy-ghost-right.txt` controls explicit right-facing ghost art.
- `assets/art/chompy-ghost-left.txt` controls explicit left-facing ghost art.
- `assets/art/chompy-ghost-up.txt` controls explicit up-facing ghost art.
- `assets/art/chompy-ghost-down.txt` controls explicit down-facing ghost art.
- `assets/art/chompy-ghost-released.txt` controls returning ghost source art.
- `assets/art/chompy-ghost-frightened.txt` controls frightened ghost source art.
- `assets/art/chompy-pellet.txt` controls pellet source art.
- `assets/art/chompy-power-pellet.txt` controls power pellet source art.
- `assets/maps/chompy-maze.txt` is the active maze source file.
- `assets/maps/generic-bracket-maze.txt` is a bracket-style template you can iterate on.
- `assets/maps/segments/segment-1.txt` ... `segment-9.txt` are reserved for 3x3 procedural segment design (each segment should be 9x9).

Sprite rendering notes:
- Maze rendering uses fixed-size map tiles.
- Multi-line ASCII sprite art is downscaled into equal-sized tiles so different source sizes still fit the board.
- Ghost facings are generated from your base ghost art by mirroring/flipping for left/up/down.
- Player facings use explicit direction files when provided, otherwise they fall back to transform-generated facings.
- Ghost facings use explicit direction files when provided; otherwise `chompy-ghost-normal.txt` is treated as right-facing and left/up/down are transform-generated.

After editing assets, restart the app to see updates.
