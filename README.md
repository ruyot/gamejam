# GameJam - Terminal Game Arcade

GameJam is a terminal arcade built with Node.js and `blessed`.

Current MVP includes:
- Polished title menu with keyboard navigation
- `Chompy` (Pac-Man-inspired) playable in terminal
- Pellets + power pellets + ghost behavior modes
- Score, lives, level progression, and persistent high score

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
