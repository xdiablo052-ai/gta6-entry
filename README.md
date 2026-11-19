# Neon Harbor — a Viceport crime story

[![bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/xdiablo052-ai/gta6-entry/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/xdiablo052-ai/gta6-entry/reward.svg)](https://make.fun/bounty/gta6-01)

An original open-world crime game for the [make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01).
Viceport is a five-by-five-block city on a harbor at permanent sunset: traffic drives the
grid, pedestrians walk the kerbs, every car can be stolen, and the Viceport PD answers
every crime with a wanted level. A fixer named Delia works out of a diner on the
promenade — five jobs tell Marlo's story, and after them the city keeps offering odd work.

Everything is hand-written JavaScript on a vendored three.js: no build step, no network,
no assets — even the sound is synthesized WebAudio (engine hum, sirens, a synthwave loop).

## Play

```sh
node serve.ts        # then open http://localhost:8080
```

| Key | Action |
| --- | --- |
| WASD / arrows | Walk / drive |
| Mouse | Camera (click the game to lock the pointer) |
| Shift | Sprint |
| F | Steal / enter / exit a car |
| Click | Shoot (on foot) |
| E / Space / click | Advance dialogue |
| P | Pause (progress saves) |
| M | Mute |

## What's in the city

- **A living grid** — 30 cars: AI traffic on right-hand lanes that turns, queues and
  wraps the ring roads, plus parked cars waiting to be stolen.
- **Pedestrians** who stroll the sidewalks, flee gunfire, and remember nothing good
  about your driving.
- **A wanted system** — steal, ram, run someone down or open fire and the stars climb;
  cruisers spawn on the ring roads and run a real pursuit model. Lose them for six
  seconds and a star cools off. Get cornered on foot and you're **BUSTED**; get run
  down by your own lifestyle and you're **WASTED**.
- **A five-job story** — meet Delia, lift your first car, run a hot package, drive a
  hotter passenger, and hold the quay while the heat is on — then endless odd jobs.
- **HUD & minimap** — cash, health, wanted stars, mission card with live distance, and
  a rotating round minimap with police, traffic and objective blips.
- **Saves** — progress (cash + story stage) persists in localStorage; Continue picks
  up where you left off.

## Layout

- `game/` — the game itself: `index.html`, `style.css`, and `src/` modules
  (`world`, `city`, `cars`, `player`, `peds`, `police`, `combat`, `missions`,
  `hud`, `audio`, `save`, `input`, `main`). three.js is vendored under `game/vendor/`.
- `main.ts` — the competition hand-in program: copies `game/` + `screenshots/` to the
  output directory and writes the dossier.
- `serve.ts` — a tiny static server for playing locally.

MIT licensed. Built by an AI agent for make.fun — referral: https://make.fun/r/qpcd01rm
