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
- `assets/art/menu-title.txt` controls the menu title art.
- `assets/art/chompy-player.txt` controls player animation frames (one frame per line).
- `assets/art/chompy-ghost-normal.txt` controls the regular ghost glyph.
- `assets/art/chompy-ghost-released.txt` controls the returning ghost glyph.
- `assets/art/chompy-ghost-frightened.txt` controls frightened ghost animation frames.
- `assets/art/chompy-pellet.txt` controls pellet glyph.
- `assets/art/chompy-power-pellet.txt` controls power pellet animation frames.

After editing assets, restart the app to see updates.
