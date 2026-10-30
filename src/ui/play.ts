// The play screen: turns touches into paths, runs the rules, animates results.
import { config } from '../config';
import { MoveAnimation } from '../render/animation';
import { drawScene, type DragView } from '../render/board';
import { fitCanvas, type Surface } from '../render/canvas';
import { cellAt, computeLayout, type Layout } from '../render/layout';
import {
  addMoves, applyMove, extendPath, goalDone, goalRemaining, isLoopClosed, isValidPath, movesLeft,
  type GameState,
} from '../rules';
import { currentTheme, dotIcon, el } from './dom';

export interface PlayHooks {
  /** Called once the final move's animation has finished. */
  onEnd(state: GameState): void;
  colorblind(): boolean;
}

export class PlayScreen {
  private state!: GameState;
  private surface!: Surface;
  private layout!: Layout;
  private anim: MoveAnimation | null = null;
  private drag: (DragView & { pointerId: number; last: [number, number] }) | null = null;
  private raf = 0;

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
          dotIcon(g.goal.color, cb),
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
    drawScene(this.surface, this.layout, this.state, f, this.drag, { theme: currentTheme(), colorblind: this.hooks.colorblind() }, now);
    if (f?.done) {
      this.anim = null;
      if (this.state.status !== 'playing') this.hooks.onEnd(this.state);
    }
    const rippling = this.drag && now - this.drag.addedAt < config.select.ringMs;
    if (this.anim || rippling) this.redraw();
  }

  private point(e: PointerEvent): [number, number] {
    const rect = this.canvas.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  }

  private down(e: PointerEvent): void {
    if (this.drag || this.anim || this.state?.status !== 'playing') return;
    const pt = this.point(e);
    const cell = cellAt(this.layout, pt[0], pt[1]);
    if (cell === null) return;
    const path = extendPath(this.state, [], cell);
    if (path.length === 0) return;
    this.canvas.setPointerCapture(e.pointerId);
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
      this.renderHud();
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
