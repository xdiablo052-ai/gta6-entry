// Neon Harbor — hand-in program for the gta6-01 competition (Node 22, standard library
// only). The game itself is the static site under game/ (three.js vendored under
// game/vendor/, no build step, no network); this program copies game/ and screenshots/
// to the output directory and writes the dossier the judge reads, using the vendored
// make.fun library exactly as the kit's starter does.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Serve the game locally with: node serve.ts  (then open http://localhost:8080)
// Node 22 runs this .ts file as-is: no flags, no build step, no install.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's own caps (the kit's reference/gate.json): refuse here what the scorer
// would refuse there — over 4 screenshots or one over 256 KiB, over 993 files or
// 48 MiB under game/, or a game path over 1000 bytes.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
