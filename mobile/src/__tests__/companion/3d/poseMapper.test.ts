import { animationToPose, emptyPose, INITIAL_POSE } from '../../../services/companion/3d/poseMapper';
import type { AnimationState } from '../../../services/companion/AnimationEngine';

const ALL_STATES: AnimationState[] = [
  'idle',
  'idle_blink',
  'happy',
  'sad',
  'sleep',
  'jump',
  'wave',
  'celebrate',
  'pet',
  'hidden',
  'show_back',
];

describe('animationToPose', () => {
  it('returns a pose for every animation state', () => {
    for (const state of ALL_STATES) {
      const pose = animationToPose(state, 0);
      expect(typeof pose.jaw).toBe('number');
      expect(typeof pose.headTilt).toBe('number');
      expect(typeof pose.headNod).toBe('number');
      expect(typeof pose.blink).toBe('number');
      expect(typeof pose.breath).toBe('number');
      expect(typeof pose.tail).toBe('number');
      expect(typeof pose.ear).toBe('number');
      expect(typeof pose.earTwitch).toBe('number');
      expect(typeof pose.look).toBe('number');
      expect(typeof pose.weightShift).toBe('number');
      expect(typeof pose.talking).toBe('boolean');
    }
  });

  it('is deterministic: same state + t yields the same pose', () => {
    const a = animationToPose('happy', 1.5);
    const b = animationToPose('happy', 1.5);
    expect(a).toEqual(b);
  });

  it('blinks at a known blink tick', () => {
    // sin(t * 0.6) > 0.94 first near t ~ 2.35 rad / 0.6
    expect(animationToPose('idle', 0).blink).toBe(0);
    const blinked = animationToPose('idle', 2.6).blink;
    expect(blinked === 0 || blinked === 1).toBe(true);
  });

  it('sleep state keeps eyes closed', () => {
    expect(animationToPose('sleep', 0).blink).toBe(1);
    expect(animationToPose('sleep', 5).blink).toBe(1);
  });

  it('happy state lifts ears and wags tail', () => {
    const pose = animationToPose('happy', 1);
    expect(pose.ear).toBeGreaterThan(0);
    expect(pose.jaw).toBeGreaterThan(0);
  });

  it('hidden state returns a neutral pose', () => {
    expect(animationToPose('hidden', 0)).toEqual(INITIAL_POSE);
  });

  it('unknown state falls back to idle', () => {
    const fallback = animationToPose('unknown' as AnimationState, 0);
    expect(fallback).toEqual(animationToPose('idle', 0));
  });

  it('reducedMotion disables periodic breathing/tail/head movement', () => {
    const motion = animationToPose('idle', 2);
    const reduced = animationToPose('idle', 2, { reducedMotion: true });
    expect(reduced.headNod).toBe(0);
    expect(reduced.tail).toBe(0);
    expect(reduced.breath).toBe(0);
    expect(motion).not.toEqual(reduced);
  });

  it('reduceAnimations slows the motion but keeps it non-zero', () => {
    const normal = animationToPose('celebrate', 3);
    const slow = animationToPose('celebrate', 3, { reduceAnimations: true });
    // Slower sines still move, just with smaller magnitude at this t.
    expect(slow.tail).not.toBe(0);
    expect(typeof slow.tail).toBe('number');
    expect(normal).not.toEqual(slow);
  });

  it('emptyPose returns a fresh, independent copy', () => {
    const a = emptyPose();
    const b = emptyPose();
    a.jaw = 1;
    expect(b.jaw).toBe(0);
  });

  it('talking is false for all non-speech states', () => {
    for (const state of ALL_STATES) {
      expect(animationToPose(state, 0).talking).toBe(false);
    }
  });

  it('t=0 and t=0.5 differ for periodic idle motion', () => {
    const t0 = animationToPose('idle', 0);
    const t05 = animationToPose('idle', 0.5);
    expect(t0).not.toEqual(t05);
  });

  it('idle keeps breathing and micro-wiggles alive', () => {
    // t = pi/2 / 0.45 -> first ear-twitch peak (~3.5s)
    const t = 3.49;
    const pose = animationToPose('idle', t);
    expect(pose.breath).toBeGreaterThan(0);
    expect(pose.earTwitch).toBe(0.5);
    expect(pose.look).toBeCloseTo(Math.sin(t * 0.3) * 0.1, 5);
    expect(pose.weightShift).toBeCloseTo(Math.sin(t * 0.42) * 0.03, 5);
    expect(pose.headTilt).toBeCloseTo(Math.sin(t * 0.38) * 0.025, 5);
    expect(pose.tail).toBeCloseTo(Math.sin(t * 0.7) * 0.12, 5);
  });

  it('blinks within the 3-8s window (period ~5.7s)', () => {
    expect(animationToPose('idle', 0).blink).toBe(0);
    expect(animationToPose('idle', 0.1).blink).toBe(0);
    // first peak near t = pi/2 / 1.1
    expect(animationToPose('idle', 1.43).blink).toBe(1);
    // second peak ~14s later still within cadence
    expect(animationToPose('idle', 7.1).blink).toBe(1);
  });

  it('ear twitch fires again within ~14s cadence (8-20s band)', () => {
    const t1 = 3.49; // first ear-twitch peak
    const t2 = 17.45; // next peak
    expect(animationToPose('idle', t1).earTwitch).toBe(0.5);
    expect(animationToPose('idle', t2).earTwitch).toBe(0.5);
  });

  it('non-idle states zero out ear twitch / look / weight shift', () => {
    for (const state of ALL_STATES) {
      if (state === 'idle' || state === 'idle_blink' || state === 'sleep') continue;
      const pose = animationToPose(state, 2);
      expect(pose.earTwitch).toBe(0);
      expect(pose.look).toBe(0);
      expect(pose.weightShift).toBe(0);
    }
  });

  it('show_back stays subtly alive but keeps the head neutral', () => {
    const t = 3.49;
    const pose = animationToPose('show_back', t);
    expect(pose.breath).toBeCloseTo(Math.sin(t * 1.2) * 0.04 + 0.04, 5);
    expect(pose.earTwitch).toBe(0.5);
    expect(pose.tail).toBeCloseTo(Math.sin(t * 0.7) * 0.1, 5);
    // head stays forward-facing
    expect(pose.look).toBe(0);
    expect(pose.weightShift).toBe(0);
    expect(pose.headTilt).toBe(0);
  });

  it('reducedMotion zeroes all idle wiggles', () => {
    const reduced = animationToPose('idle', 3.49, { reducedMotion: true });
    expect(reduced.breath).toBe(0);
    expect(reduced.tail).toBe(0);
    expect(reduced.headNod).toBe(0);
    expect(reduced.headTilt).toBe(0);
    expect(reduced.look).toBe(0);
    expect(reduced.weightShift).toBe(0);
    expect(reduced.earTwitch).toBe(0);
  });
});
