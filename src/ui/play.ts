// The play screen: turns touches into paths, runs the rules, animates results.
import { config } from '../config';
import { MoveAnimation } from '../render/animation';
import { drawScene, type DragView } from '../render/board';
import { fitCanvas, type Surface } from '../render/canvas';
import { cellAt, computeLayout, type Layout } from '../render/layout';
import {
  addMoves, applyMove, applyPowerUp, canUsePowerUp, extendPath, goalDone, goalRemaining, hintSquare, isLoopClosed, isValidPath,
  leftoverBombs, movesLeft, type GameState, type MoveResult, type PowerUp,
} from '../rules';
import { currentTheme, el, goalIcon } from './dom';

export interface PlayHooks {
  /** Called once the final move's animation has finished. */
  onEnd(state: GameState): void;
  colorblind(): boolean;
  /** Whether the square hint setting is on. */
  squareHint(): boolean;
  /** A power-up was used (spend it). */
  powerUsed(): void;
  /** A power-up started or stopped waiting for a tap on the board. */
  targetChanged(kind: TargetPowerUp | null): void;
}

/** The power-ups that are aimed at a cell. */
export type TargetPowerUp = 'eraser' | 'sureShot';

export class PlayScreen {
  private state!: GameState;
  private surface!: Surface;
  private layout!: Layout;
  private anim: MoveAnimation | null = null;
  private drag: (DragView & { pointerId: number; last: [number, number] }) | null = null;
  private raf = 0;
  /** A power-up waiting for a tap: the next tap on the board aims it at that cell. */
  private target: TargetPowerUp | null = null;
  /** After a win, the leftover-move bombs still to animate (null until the win's own animation ends). */
  private finale: { state: GameState; result: MoveResult }[] | null = null;
  /** Last touch or move, for the square hint's idle timer; and the hint found for the current board. */
  private lastInput = 0;
  private hint: { state: GameState; path: number[] | null } | null = null;
  private hintTimer = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly hud: { goals: HTMLElement; moves: HTMLElement; top: HTMLElement },
    private readonly hooks: PlayHooks,
  ) {
    canvas.addEventListener('pointerdown', (e) => this.down(e));
    canvas.addEventListener('pointermove', (e) => this.move(e));
    canvas.addEventListener('pointerup', (e) => this.up(e));
    canvas.addEventListener('pointercancel', (e) => this.cancel(e));
  }

  get game(): GameState {
    return this.state;
  }

  start(state: GameState): void {
    this.state = state;
    this.anim = null;
    this.drag = null;
    this.finale = null;
    this.lastInput = performance.now();
    this.setTarget(null);
    this.resize();
    this.renderHud();
  }

  /** The assist: 5 more moves after running out. */
  assist(): void {
    this.state = addMoves(this.state, config.assist.moves);
    this.renderHud();
    this.redraw();
  }

  resize(): void {
    if (!this.state) return;
    this.surface = fitCanvas(this.canvas);
    const top = this.hud.top.getBoundingClientRect().bottom;
    this.layout = computeLayout(this.surface.width, this.surface.height, this.state.rows, this.state.cols, top, 24);
    this.redraw();
  }

  redraw(): void {
    if (!this.raf) this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  renderHud(): void {
    const s = this.state;
    const cb = this.hooks.colorblind();
    this.hud.goals.replaceChildren(
      ...s.goals.map((g) =>
        el('div', { class: `goal${goalDone(s, g) ? ' done' : ''}` },
          goalIcon(g.goal, cb),
          el('span', {}, goalDone(s, g) ? '✓' : String(goalRemaining(s, g))),
        ),
      ),
    );
    this.hud.moves.textContent = String(movesLeft(s));
  }

  private frame(now: number): void {
    this.raf = 0;
    if (!this.state) return;
    const f = this.anim?.frame(now) ?? null;
    const hint = this.hintFor(now);
    drawScene(this.surface, this.layout, this.state, f, this.drag, { theme: currentTheme(), colorblind: this.hooks.colorblind() }, now, hint);
    // Counts change when the cleared dots have popped, not when the finger lifts.
    if (this.anim && !this.anim.hudShown && now >= this.anim.hudAt) {
      this.anim.hudShown = true;
      this.renderHud();
    }
    if (f?.done) {
      this.anim = null;
      this.lastInput = now;
      if (this.state.status !== 'playing' && !this.nextFinaleBomb(now)) this.hooks.onEnd(this.state);
    }
    const rippling = this.drag && now - this.drag.addedAt < config.select.ringMs;
    if (this.anim || rippling || hint) this.redraw();
  }

  /** After a win, starts the next leftover-move bomb. Returns false once there are none left. */
  private nextFinaleBomb(now: number): boolean {
    if (this.state.status !== 'won') return false;
    this.finale ??= leftoverBombs(this.state);
    const step = this.finale.shift();
    if (!step) return false;
    this.anim = new MoveAnimation(this.state, step.result, step.state, now);
    this.state = step.state;
    this.redraw();
    return true;
  }

  /**
   * The square hint to show now, if it's on and the board has sat idle long
   * enough. While waiting, schedules a redraw for when it's due.
   */
  private hintFor(now: number): { path: readonly number[]; since: number } | null {
    clearTimeout(this.hintTimer);
    if (!this.hooks.squareHint() || this.state.status !== 'playing' || this.drag || this.anim || this.target) return null;
    const since = this.lastInput + config.hint.delayMs;
    if (now < since) {
      this.hintTimer = window.setTimeout(() => this.redraw(), since - now);
      return null;
    }
    if (this.hint?.state !== this.state) this.hint = { state: this.state, path: hintSquare(this.state) };
    return this.hint.path ? { path: this.hint.path, since } : null;
  }

  private point(e: PointerEvent): [number, number] {
    const rect = this.canvas.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  }

  get targeting(): TargetPowerUp | null {
    return this.target;
  }

  setTarget(kind: TargetPowerUp | null): void {
    if (this.target === kind) return;
    this.target = kind;
    this.hooks.targetChanged(kind);
  }

  /** Can a power-up be used right now (game on, no drag, last move landed)? */
  ready(): boolean {
    return !this.drag && this.state?.status === 'playing' && this.inputOpen(performance.now());
  }

  /** Uses a power-up if it can be used now. Returns true if it was. */
  usePowerUp(p: PowerUp): boolean {
    if (!this.ready() || !canUsePowerUp(this.state, p)) return false;
    const { state, result } = applyPowerUp(this.state, p);
    this.anim = new MoveAnimation(this.state, result, state, performance.now());
    this.state = state;
    this.hooks.powerUsed();
    this.redraw();
    return true;
  }

  /** A new drag can start once the last move's dots have landed (or, under 'end', once it has fully finished). */
  private inputOpen(now: number): boolean {
    const a = this.anim;
    return !a || now >= (config.input.unlockAt === 'end' ? a.end : a.inputAt);
  }

  private down(e: PointerEvent): void {
    this.lastInput = performance.now();
    if (this.drag || this.state?.status !== 'playing' || !this.inputOpen(performance.now())) return;
    const pt = this.point(e);
    const cell = cellAt(this.layout, pt[0], pt[1]);
    if (cell === null) return;
    if (this.target) {
      // Taps on cells the power-up can't act on are ignored; the button cancels.
      if (this.usePowerUp({ kind: this.target, cell })) this.setTarget(null);
      return;
    }
    const path = extendPath(this.state, [], cell);
    if (path.length === 0) return;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      // Capture is a nicety (keeps the drag if the finger leaves the canvas); input works without it.
    }
    this.drag = { path, finger: pt, addedAt: performance.now(), loop: false, pointerId: e.pointerId, last: pt };
    this.redraw();
  }

  private move(e: PointerEvent): void {
    const d = this.drag;
    if (!d || e.pointerId !== d.pointerId) return;
    const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
    for (const ev of events.length ? events : [e]) this.trace(d, this.point(ev));
    this.redraw();
  }

  /** Follows the finger from its last position, sampling so fast swipes don't skip dots. */
  private trace(d: NonNullable<PlayScreen['drag']>, pt: [number, number]): void {
    const [x0, y0] = d.last;
    const step = this.layout.cell * config.input.sampleStep;
    const n = Math.max(1, Math.ceil(Math.hypot(pt[0] - x0, pt[1] - y0) / step));
    for (let k = 1; k <= n; k++) {
      const x = x0 + ((pt[0] - x0) * k) / n;
      const y = y0 + ((pt[1] - y0) * k) / n;
      const cell = cellAt(this.layout, x, y);
      if (cell === null) continue;
      const next = extendPath(this.state, d.path, cell);
      if (next === d.path) continue;
      if (next.length > d.path.length) d.addedAt = performance.now();
      d.path = next;
      d.loop = isLoopClosed(next);
    }
    d.last = pt;
    d.finger = pt;
  }

  private up(e: PointerEvent): void {
    const d = this.drag;
    if (!d || e.pointerId !== d.pointerId) return;
    this.drag = null;
    if (isValidPath(this.state, d.path)) {
      const { state, result } = applyMove(this.state, d.path);
      this.anim = new MoveAnimation(this.state, result, state, performance.now());
      this.state = state;
    }
    this.redraw();
  }

  private cancel(e: PointerEvent): void {
    if (this.drag?.pointerId === e.pointerId) {
      this.drag = null;
      this.redraw();
    }
  }
}
