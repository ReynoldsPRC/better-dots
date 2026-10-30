// Easing curves, named so config.ts can pick one by string.
export const easings = {
  linear: (t: number) => t,
  easeInQuad: (t: number) => t * t,
  easeOutQuad: (t: number) => t * (2 - t),
  easeInOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  easeInCubic: (t: number) => t * t * t,
  easeOutCubic: (t: number) => 1 - (1 - t) ** 3,
} as const;

export type EasingName = keyof typeof easings;

export function ease(name: string, t: number): number {
  const fn = easings[name as EasingName] ?? easings.linear;
  return fn(Math.min(1, Math.max(0, t)));
}
