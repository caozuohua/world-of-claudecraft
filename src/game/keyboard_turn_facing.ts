// Instant local display facing for keyboard turns online.
//
// Offline, A/D turning mutates the sim facing the same frame. Online the tl/tr
// flags are integrated SERVER-side at TURN_SPEED, so the model (and the follow
// camera) used to wait a full round trip before visibly turning. This module
// integrates the same TURN_SPEED math locally, display-only: the result feeds
// the renderer's facing-override chain and the camera follow, never the wire or
// ClientWorld state (the sanctioned display-layer anticipation, see
// src/net/CLAUDE.md).
//
// While a turn key is held the local integration owns the heading and ignores
// the round-trip-stale server facing (blending mid-turn would drag the model
// backwards by the echo latency). On release, or while turning is blocked
// (stun family, corpse), it converges back onto the interpolated server facing
// at the same TURN_SPEED and hands control back once aligned. Both ends
// integrate the held keys at the same rate for the same duration, so the
// residual gap at release is bounded by server tick quantization plus echo
// jitter, and the convergence is visually invisible.

import { TURN_SPEED } from '../sim/types';
import { wrapAngle } from './camera_follow';

// Handoff gap: TURN_SPEED * DT is one server tick of turning (~0.157 rad);
// converging to well under that before yielding reads as an exact match.
const HANDOFF_EPS = 1e-3; // rad
const MAX_FRAME_DT = 0.1; // clamp long frames so a hitch cannot over-rotate

export interface KeyboardTurnState {
  facing: number | null; // null = inactive (the server facing owns the display)
}

export function newKeyboardTurnState(): KeyboardTurnState {
  return { facing: null };
}

function approachAngle(current: number, target: number, maxStep: number): number {
  const step = Math.max(0, maxStep);
  const d = wrapAngle(target - current);
  if (Math.abs(d) <= step) return target;
  return current + Math.sign(d) * step;
}

export interface KeyboardTurnArgs {
  turnLeft: boolean;
  turnRight: boolean;
  /** False while turning is blocked (stun family / corpse): converge and hand off. */
  turnAllowed: boolean;
  /**
   * The facing the client streams to the server this frame (mouselook,
   * click-move, mouselook-release latch). Non-null means that path owns the
   * heading and the server applies it immediately: clear and yield.
   */
  sentFacing: number | null;
  /** Interpolated prev->server facing (alpha capped at 1), the handoff target. */
  serverFacing: number;
  frameDt: number;
}

/**
 * Advance the local keyboard-turn display facing one frame. Returns the facing
 * to show (and to follow with the camera) while engaged or converging, or null
 * once the interpolated server facing owns the display again.
 */
export function stepKeyboardTurnFacing(
  state: KeyboardTurnState,
  args: KeyboardTurnArgs,
): number | null {
  if (args.sentFacing !== null) {
    state.facing = null;
    return null;
  }
  const dt = Math.min(Math.max(0, args.frameDt), MAX_FRAME_DT);
  if (args.turnAllowed && (args.turnLeft || args.turnRight)) {
    // Turning right DECREASES facing (sim convention: f points along (sin f, cos f)).
    const dir = (args.turnLeft ? 1 : 0) - (args.turnRight ? 1 : 0);
    const base = state.facing ?? args.serverFacing;
    state.facing = wrapAngle(base + dir * TURN_SPEED * dt);
    return state.facing;
  }
  if (state.facing === null) return null;
  const next = approachAngle(state.facing, args.serverFacing, TURN_SPEED * dt);
  if (Math.abs(wrapAngle(args.serverFacing - next)) <= HANDOFF_EPS) {
    state.facing = null;
    return null;
  }
  state.facing = next;
  return next;
}
