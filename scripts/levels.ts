// Level tools. Run with: npm run levels -- <command>
//   list                          ids and bot stats for every level
//   ids                           give every level file (shipped or candidate) without an "id" a new one
//   score [world ...] [--runs N]  re-run the bot; set moves, stars, and bot notes in each file
//   generate <world> <count>      make candidates into levels/candidates/world-N/
//                                 [--seed S] [--ramp a,b] (a..b within the preset's easy 0 to hard 1)
//   regenerate <world> <n ...>    rebuild shipped levels n... in place from the world's preset, at their
//                                 spot in the easy-to-hard ramp, with fresh ids; up to 3 seeds each [--seed S]
//   keep <world> <n ...>          move candidates n... to the end of world N
//   drop <world> <n ...>          remove levels n... from world N (renumbers the rest)
//   reject <world> <n ...>        delete candidates n... (renumbers the rest)
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { analyzeLevel, isLuckHeavy, tuneFromStats } from '../src/bot/bot';
import { formatLevelJson, toLevelFile } from '../src/bot/format';
import { botNote, generateCandidate } from '../src/bot/generate';
import { presets } from '../src/bot/presets';
import { parseLevel } from '../src/rules';

const ROOT = join(__dirname, '..', 'levels');
const worldDir = (w: number) => join(ROOT, `world-${w}`);
const candDir = (w: number) => join(ROOT, 'candidates', `world-${w}`);
const pad = (n: number) => String(n).padStart(2, '0');

function levelFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => /^\d+\.json$/.test(f)).sort();
}

function worlds(): number[] {
  return readdirSync(ROOT).map((d) => d.match(/^world-(\d+)$/)).filter(Boolean).map((m) => Number(m![1])).sort((a, b) => a - b);
}

function read(dir: string, f: string, label: string) {
  return parseLevel(JSON.parse(readFileSync(join(dir, f), 'utf8')), label);
}

/** Every level file, shipped and candidate, with its directory. */
function allFiles(): { dir: string; f: string }[] {
  const dirs = worlds().flatMap((w) => [worldDir(w), candDir(w)]);
  return dirs.flatMap((dir) => levelFiles(dir).map((f) => ({ dir, f })));
}

/** A new random level id (8 base36 chars) not used by any level file. */
const usedIds = new Set<string>();
function mintId(): string {
  if (usedIds.size === 0) {
    for (const { dir, f } of allFiles()) {
      const id = JSON.parse(readFileSync(join(dir, f), 'utf8')).id;
      if (typeof id === 'string') usedIds.add(id);
    }
  }
  for (;;) {
    const id = [...randomBytes(8)].map((b) => (b % 36).toString(36)).join('');
    if (!usedIds.has(id)) {
      usedIds.add(id);
      return id;
    }
  }
}

/** Renames NN.json files so they run 01, 02, ... with no gaps. */
function renumber(dir: string) {
  const files = levelFiles(dir);
  files.forEach((f, k) => renameSync(join(dir, f), join(dir, `tmp-${pad(k + 1)}.json`)));
  files.forEach((_, k) => renameSync(join(dir, `tmp-${pad(k + 1)}.json`), join(dir, `${pad(k + 1)}.json`)));
}

// vite-node passes everything after "--" through untouched.
const dash = process.argv.indexOf('--');
const args = dash >= 0 ? process.argv.slice(dash + 1) : process.argv.slice(2);
const flag = (name: string, dflt: number) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return dflt;
  const v = Number(args[i + 1]);
  args.splice(i, 2);
  return v;
};
const runs = flag('runs', 100);
const seedFlag = flag('seed', Date.now() % 1_000_000);
// --ramp a,b: where in the preset's easy..hard range this batch runs (default 0,1).
const rampAt = args.indexOf('--ramp');
const ramp = rampAt >= 0 ? args.splice(rampAt, 2)[1].split(',').map(Number) : [0, 1];
const [cmd, ...rest] = args;
const nums = rest.map(Number);

switch (cmd) {
  case 'list': {
    for (const w of worlds()) {
      for (const f of levelFiles(worldDir(w))) {
        const raw = JSON.parse(readFileSync(join(worldDir(w), f), 'utf8'));
        const b = raw.bot ?? {};
        console.log(`${w}-${f.slice(0, 2)}  ${raw.id ?? '(no id)'}  moves ${String(raw.moves).padStart(2)}  stars ${raw.stars ? `${raw.stars.two}/${raw.stars.three}` : '-'}  bot win ${b.winRate ?? '-'} median ${b.median ?? '-'}  ${raw.name ?? ''}`);
      }
    }
    break;
  }
  case 'ids': {
    for (const { dir, f } of allFiles()) {
      const raw = JSON.parse(readFileSync(join(dir, f), 'utf8'));
      if (raw.id !== undefined) continue;
      const out = { id: mintId(), ...raw };
      writeFileSync(join(dir, f), formatLevelJson(out));
      console.log(`${join(dir, f).slice(ROOT.length + 1)}: id ${out.id}`);
    }
    break;
  }
  case 'score': {
    for (const w of nums.length ? nums : worlds()) {
      for (const f of levelFiles(worldDir(w))) {
        const level = read(worldDir(w), f, `${w}-${f.slice(0, 2)}`);
        const stats = analyzeLevel(level, runs, level.seed);
        const t = tuneFromStats(stats);
        if (!t) {
          console.log(`${level.label}: bot finished only ${Math.round(stats.finishRate * 100)}% of runs; left unchanged. Consider dropping it.`);
          continue;
        }
        const next = { ...level, moves: t.moves, stars: t.stars };
        writeFileSync(join(worldDir(w), f), formatLevelJson(toLevelFile(next, botNote(stats, t))));
        const flags = [isLuckHeavy(stats) ? 'luck-heavy' : '', t.oneTier ? 'one-tier' : ''].filter(Boolean).join(' ');
        console.log(`${level.label}: moves ${level.moves} -> ${t.moves}, stars 2@${t.stars.two} 3@${t.stars.three}, bot median ${stats.median} p10 ${stats.p10}${flags ? `  ${flags}` : ''}`);
      }
    }
    break;
  }
  case 'generate': {
    const [w, count] = nums;
    const preset = presets[w];
    if (!preset || !count) throw new Error(`usage: generate <world> <count>; presets exist for worlds ${Object.keys(presets).join(', ')}`);
    mkdirSync(candDir(w), { recursive: true });
    let n = levelFiles(candDir(w)).length;
    let seed = seedFlag;
    for (let k = 0, tries = 0; k < count && tries < count * 10; seed++, tries++) {
      const t = ramp[0] + (ramp[1] - ramp[0]) * (count === 1 ? 0.5 : k / (count - 1));
      const c = generateCandidate({ ...preset(t), runs: Math.max(20, Math.round(runs / 2)) }, seed);
      if (!c) {
        continue;
      }
      k++;
      n++;
      writeFileSync(join(candDir(w), `${pad(n)}.json`), formatLevelJson(toLevelFile({ ...c.level, id: mintId() }, c.bot)));
      tries = 0;
      console.log(`candidate c${w}-${n}: moves ${c.level.moves}, bot win ${c.bot.winRate}, median ${c.bot.median}`);
    }
    break;
  }
  case 'regenerate': {
    const [w, ...which] = nums;
    const preset = presets[w];
    if (!preset || which.length === 0) throw new Error(`usage: regenerate <world> <n ...>; presets exist for worlds ${Object.keys(presets).join(', ')}`);
    const count = levelFiles(worldDir(w)).length;
    for (const n of which) {
      const file = join(worldDir(w), `${pad(n)}.json`);
      if (!existsSync(file)) throw new Error(`no level ${file}`);
      const t = count === 1 ? 0.5 : (n - 1) / (count - 1);
      let made = false;
      for (let attempt = 0; attempt < 3 && !made; attempt++) {
        const seed = seedFlag + n * 1000 + attempt;
        const c = generateCandidate({ ...preset(t), runs: Math.max(20, Math.round(runs / 2)) }, seed);
        if (!c) {
          console.log(`${w}-${n}: attempt ${attempt + 1} (seed ${seed}) found no winnable level`);
          continue;
        }
        writeFileSync(file, formatLevelJson(toLevelFile({ ...c.level, id: mintId() }, c.bot)));
        console.log(`${w}-${n}: regenerated (seed ${seed}): moves ${c.level.moves}, bot win ${c.bot.winRate}, median ${c.bot.median}`);
        made = true;
      }
      if (!made) console.log(`${w}-${n}: 3 regenerations failed`);
    }
    break;
  }
  case 'keep': {
    const [w, ...which] = nums;
    mkdirSync(worldDir(w), { recursive: true });
    let n = levelFiles(worldDir(w)).length;
    for (const k of which) {
      const src = join(candDir(w), `${pad(k)}.json`);
      if (!existsSync(src)) throw new Error(`no candidate ${src}`);
      renameSync(src, join(worldDir(w), `${pad(++n)}.json`));
      console.log(`candidate c${w}-${k} is now level ${w}-${n} (id unchanged)`);
    }
    renumber(candDir(w));
    break;
  }
  case 'drop':
  case 'reject': {
    const [w, ...which] = nums;
    const dir = cmd === 'drop' ? worldDir(w) : candDir(w);
    for (const k of which) {
      const file = join(dir, `${pad(k)}.json`);
      if (!existsSync(file)) throw new Error(`no ${cmd === 'drop' ? 'level' : 'candidate'} ${w}-${k} (${file})`);
      rmSync(file);
      console.log(`removed ${cmd === 'drop' ? '' : 'candidate '}${w}-${k}`);
    }
    renumber(dir);
    break;
  }
  default:
    console.log('commands: list | ids | score [world ...] | generate <world> <count> | keep <world> <n ...> | drop <world> <n ...> | reject <world> <n ...>');
}
