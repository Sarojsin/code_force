import type { AnimationState } from '../AnimationEngine';

export interface LunaPose {
  jaw: number;
  headTilt: number;
  headNod: number;
  blink: number;
  breath: number;
  tail: number;
  ear: number;
  earTwitch: number;
  look: number;
  weightShift: number;
  talking: boolean;
}

export interface PoseOptions {
  /** Respect OS "reduce motion" — disable periodic sine (breath/tail/blink wiggle). */
  reducedMotion?: boolean;
  /** Perf flag — lower animation frequency (slower sines). */
  reduceAnimations?: boolean;
  /** Live TTS lip-sync — override jaw with syllable cadence while speaking. */
  talking?: boolean;
}

export const INITIAL_POSE: LunaPose = {
  jaw: 0,
  headTilt: 0,
  headNod: 0,
  blink: 0,
  breath: 0,
  tail: 0,
  ear: 0,
  earTwitch: 0,
  look: 0,
  weightShift: 0,
  talking: false,
};

export function emptyPose(): LunaPose {
  return { ...INITIAL_POSE };
}

/**
 * Pure, deterministic mapper from the Reanimated animation state machine to
 * per-bone rotation targets. `t` is elapsed seconds and drives sine timing.
 *
 * Idle micro-animation spec (alive feel):
 *   breathing  — continuous (root scale, every frame)
 *   blink      — every 3-8s        (eye lid, 0=open / 1=closed)
 *   ear twitch — every 8-20s        (ears forward flick)
 *   tail sway  — every 4-10s        (tail sway around Z)
 *   head tilt  — slow roll around Z (one side dips)
 *   look       — slow yaw around Y  (head looks left/right)
 *   weight shift — slow lean around X (body shifts weight)
 *
 * Sign conventions (match the renderer):
 *   headNod — pitch around X (positive = up)
 *   headTilt — roll around Z (positive = right side down)
 *   look — yaw around Y (positive = right)
 *   tail — sway around Z
 *   jaw — open (positive = open, renderer inverts internally)
 *   ear — perk (positive = ears up/forward), negative = flat/pressed back
 *   earTwitch — forward flick (additive with ear perk)
 *   blink — 0 = open, 1 = closed
 *   breath — 0 = neutral, >0 = inflated
 *   weightShift — lean around X (positive = lean right)
 */
export function animationToPose(
  state: AnimationState,
  t: number,
  options?: PoseOptions,
): LunaPose {
  'worklet';
  const reduced = options?.reducedMotion === true;
  const slow = options?.reduceAnimations === true;
  const speed = slow ? 0.5 : 1;

  const blinkPeriodic = reduced
    ? 0
    : Math.max(0, Math.sin(t * 1.1 * speed)) > 0.93 ? 1 : 0;

  const idleWiggles = reduced
    ? { earTwitch: 0, headTilt: 0, look: 0, weightShift: 0 }
    : {
        earTwitch: Math.max(0, Math.sin(t * 0.45 * speed)) > 0.91 ? 0.5 : 0,
        headTilt: Math.sin(t * 0.38 * speed) * 0.025,
        look: Math.sin(t * 0.3 * speed) * 0.1,
        weightShift: Math.sin(t * 0.42 * speed) * 0.03,
      };

  const pose: LunaPose = (() => {
    switch (state) {
      case 'idle': {
      return {
        jaw: 0,
        headTilt: idleWiggles.headTilt,
        headNod: reduced ? 0 : Math.sin(t * 0.8 * speed) * 0.04,
        blink: blinkPeriodic,
        breath: reduced ? 0 : (Math.sin(t * 1.2 * speed) + 1) * 0.05,
        tail: reduced ? 0 : Math.sin(t * 0.7 * speed) * 0.12,
        ear: 0,
        earTwitch: idleWiggles.earTwitch,
        look: idleWiggles.look,
        weightShift: idleWiggles.weightShift,
        talking: false,
      };
    }

    case 'show_back': {
      // Turned to face away: body still breathes/blinks/twitches, but the head
      // stays neutral (no idle look/tilt/weight-shift) so it reads as "looking
      // off into the distance" rather than fidgeting.
      return {
        jaw: 0,
        headTilt: 0,
        headNod: reduced ? 0 : Math.sin(t * 0.8 * speed) * 0.03,
        blink: blinkPeriodic,
        breath: reduced ? 0 : (Math.sin(t * 1.2 * speed) + 1) * 0.04,
        tail: reduced ? 0 : Math.sin(t * 0.7 * speed) * 0.1,
        ear: 0,
        earTwitch: idleWiggles.earTwitch,
        look: 0,
        weightShift: 0,
        talking: false,
      };
    }

    case 'idle_blink': {
      return {
        jaw: 0,
        headTilt: idleWiggles.headTilt,
        headNod: reduced ? 0 : Math.sin(t * 0.8 * speed) * 0.04,
        blink: blinkPeriodic === 1 ? 1 : 0,
        breath: reduced ? 0 : (Math.sin(t * 1.2 * speed) + 1) * 0.05,
        tail: reduced ? 0 : Math.sin(t * 0.7 * speed) * 0.12,
        ear: 0,
        earTwitch: idleWiggles.earTwitch,
        look: idleWiggles.look,
        weightShift: idleWiggles.weightShift,
        talking: false,
      };
    }

    case 'happy': {
      const wiggle = reduced ? 0 : Math.sin(t * 6 * speed) * 0.1;
      return {
        jaw: 0.35,
        headTilt: wiggle,
        headNod: reduced ? 0 : Math.abs(Math.sin(t * 6 * speed)) * 0.15,
        blink: 0,
        breath: reduced ? 0 : (Math.sin(t * 2 * speed) + 1) * 0.07,
        tail: reduced ? 0 : Math.sin(t * 8 * speed) * 0.5,
        ear: 0.4,
        earTwitch: 0,
        look: 0,
        weightShift: 0,
        talking: false,
      };
    }

    case 'sad': {
      return {
        jaw: 0,
        headTilt: -0.25,
        headNod: reduced ? 0 : Math.sin(t * 0.5 * speed) * 0.05,
        blink: 0,
        breath: reduced ? 0 : (Math.sin(t * 0.8 * speed) + 1) * 0.04,
        tail: -0.3,
        ear: -0.35,
        earTwitch: 0,
        look: 0,
        weightShift: 0,
        talking: false,
      };
    }

    case 'sleep': {
      return {
        jaw: 0,
        headTilt: -0.05,
        headNod: reduced ? 0 : Math.sin(t * 0.3 * speed) * 0.03,
        blink: 1,
        breath: reduced ? 0 : (Math.sin(t * 0.45 * speed) + 1) * 0.08,
        tail: 0,
        ear: -0.2,
        earTwitch: 0,
        look: 0,
        weightShift: 0,
        talking: false,
      };
    }

    case 'jump': {
      return {
        jaw: 0,
        headTilt: 0,
        headNod: reduced ? 0 : Math.sin(t * 12 * speed) * 0.06,
        blink: 0,
        breath: 0.1,
        tail: 0.5,
        ear: 0.3,
        earTwitch: 0,
        look: 0,
        weightShift: 0,
        talking: false,
      };
    }

    case 'wave': {
      return {
        jaw: 0,
        headTilt: 0.2,
        headNod: reduced ? 0 : Math.sin(t * 5 * speed) * 0.08,
        blink: 0,
        breath: reduced ? 0 : (Math.sin(t * 1.5 * speed) + 1) * 0.06,
        tail: 0.4,
        ear: 0.35,
        earTwitch: 0,
        look: 0,
        weightShift: 0,
        talking: false,
      };
    }

    case 'celebrate': {
      const bounce = reduced ? 0 : Math.sin(t * 10 * speed) * 0.12;
      return {
        jaw: 0.4,
        headTilt: bounce,
        headNod: reduced ? 0 : Math.abs(Math.sin(t * 10 * speed)) * 0.2,
        blink: 0,
        breath: reduced ? 0 : (Math.sin(t * 3 * speed) + 1) * 0.09,
        tail: reduced ? 0 : Math.sin(t * 12 * speed) * 0.6,
        ear: 0.5,
        earTwitch: 0,
        look: 0,
        weightShift: 0,
        talking: false,
      };
    }

    case 'pet': {
      return {
        jaw: 0,
        headTilt: 0.15,
        headNod: reduced ? 0 : Math.sin(t * 3 * speed) * 0.06,
        blink: blinkPeriodic,
        breath: reduced ? 0 : (Math.sin(t * 2.5 * speed) + 1) * 0.06,
        tail: 0,
        ear: -0.3,
        earTwitch: 0,
        look: 0,
        weightShift: 0,
        talking: false,
      };
    }

    case 'hidden': {
       return emptyPose();
     }

     case 'flip': {
       // Mid-backflip: ears back, tail up, head tucked, slight excitement.
       // The body X-rotation (backflip) is driven by the rotationX shared value
       // applied to the root entity — this pose layer adds the facial/body
       // micro-expressions for the moment.
       return {
         jaw: 0,
         headTilt: reduced ? 0 : Math.sin(t * 8 * speed) * 0.1,
         headNod: reduced ? 0 : Math.abs(Math.sin(t * 4 * speed)) * 0.2,
         blink: 0,
         breath: reduced ? 0 : (Math.sin(t * 5 * speed) + 1) * 0.06,
         tail: 0.4,
         ear: -0.4,
         earTwitch: 0,
         look: 0,
         weightShift: reduced ? 0 : Math.sin(t * 6 * speed) * 0.05,
         talking: false,
       };
     }

     default:
      return animationToPose('idle', t, options);
    }
  })();

  if (options?.talking === true && state !== 'hidden') {
    pose.jaw = 0.6 * (0.5 + 0.5 * Math.sin(t * 8));
    pose.talking = true;
  }

  return pose;
}
