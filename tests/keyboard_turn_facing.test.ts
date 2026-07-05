import { describe, expect, it } from 'vitest';
import {
  type KeyboardTurnArgs,
  newKeyboardTurnState,
  stepKeyboardTurnFacing,
} from '../src/game/keyboard_turn_facing';
import { TURN_SPEED } from '../src/sim/types';

const FRAME_60 = 1 / 60;

const args = (over: Partial<KeyboardTurnArgs> = {}): KeyboardTurnArgs => ({
  turnLeft: false,
  turnRight: false,
  turnAllowed: true,
  sentFacing: null,
  serverFacing: 0,
  frameDt: FRAME_60,
  ...over,
});

describe('stepKeyboardTurnFacing', () => {
  it('integrates a right turn as a DECREASING facing at TURN_SPEED', () => {
    const st = newKeyboardTurnState();
    const f = stepKeyboardTurnFacing(st, args({ turnRight: true, serverFacing: 1.0 }));
    expect(f).toBeCloseTo(1.0 - TURN_SPEED * FRAME_60, 6);
  });

  it('integrates a left turn as an INCREASING facing at TURN_SPEED', () => {
    const st = newKeyboardTurnState();
    const f = stepKeyboardTurnFacing(st, args({ turnLeft: true, serverFacing: -0.5 }));
    expect(f).toBeCloseTo(-0.5 + TURN_SPEED * FRAME_60, 6);
  });

  it('seeds from the server facing on engage (no first-frame jump)', () => {
    const st = newKeyboardTurnState();
    const f = stepKeyboardTurnFacing(st, args({ turnLeft: true, serverFacing: 2.4 }));
    // one frame of turning away from exactly where the model was displayed
    expect(Math.abs((f as number) - 2.4)).toBeLessThanOrEqual(TURN_SPEED * FRAME_60 + 1e-9);
  });

  it('ignores the stale server facing while a key is held (no mid-turn drag-back)', () => {
    const st = newKeyboardTurnState();
    let f = stepKeyboardTurnFacing(st, args({ turnLeft: true, serverFacing: 0 }));
    // server facing lags a round trip behind; local integration must not chase it
    f = stepKeyboardTurnFacing(st, args({ turnLeft: true, serverFacing: -1.0 }));
    expect(f).toBeCloseTo(2 * TURN_SPEED * FRAME_60, 6);
  });

  it('a non-null sentFacing (mouselook / click-move) clears the state and yields', () => {
    const st = newKeyboardTurnState();
    stepKeyboardTurnFacing(st, args({ turnLeft: true }));
    const f = stepKeyboardTurnFacing(st, args({ turnLeft: true, sentFacing: 1.2 }));
    expect(f).toBeNull();
    expect(st.facing).toBeNull();
  });

  it('converges instead of integrating while turning is not allowed (stun family)', () => {
    const st = newKeyboardTurnState();
    stepKeyboardTurnFacing(st, args({ turnLeft: true, serverFacing: 0 }));
    const engaged = st.facing as number;
    const f = stepKeyboardTurnFacing(
      st,
      args({ turnLeft: true, turnAllowed: false, serverFacing: 0 }),
    ) as number;
    // stepped back toward the server facing, not further away
    expect(Math.abs(f)).toBeLessThan(Math.abs(engaged));
  });

  it('press-then-release converges exactly onto the server facing and hands off', () => {
    const st = newKeyboardTurnState();
    // hold left for 30 frames
    for (let i = 0; i < 30; i++) {
      stepKeyboardTurnFacing(st, args({ turnLeft: true, serverFacing: 0 }));
    }
    const local = st.facing as number;
    // the server integrated the same held duration, so its facing arrives near
    // the local one (up to tick quantization); converge onto it
    const serverFacing = local - 0.1;
    let f: number | null = local;
    let frames = 0;
    while (f !== null && frames < 1000) {
      f = stepKeyboardTurnFacing(st, args({ serverFacing }));
      frames++;
    }
    expect(frames).toBeLessThan(20); // 0.1 rad at PI rad/s is a few frames
    expect(st.facing).toBeNull(); // handed off, no residual drift
  });

  it('clamps an over-long frame so a hitch cannot over-rotate', () => {
    const st = newKeyboardTurnState();
    const f = stepKeyboardTurnFacing(st, args({ turnLeft: true, serverFacing: 0, frameDt: 0.5 }));
    expect(Math.abs(f as number)).toBeLessThanOrEqual(TURN_SPEED * 0.1 + 1e-9);
  });

  it('both keys held stays engaged with net-zero rotation', () => {
    const st = newKeyboardTurnState();
    const f = stepKeyboardTurnFacing(
      st,
      args({ turnLeft: true, turnRight: true, serverFacing: 0.8 }),
    );
    expect(f).toBeCloseTo(0.8, 6);
    expect(st.facing).not.toBeNull();
  });

  it('returns null and stays inactive when idle', () => {
    const st = newKeyboardTurnState();
    expect(stepKeyboardTurnFacing(st, args({ serverFacing: 1.0 }))).toBeNull();
    expect(st.facing).toBeNull();
  });

  it('wraps across +/-PI while integrating', () => {
    const st = newKeyboardTurnState();
    const f = stepKeyboardTurnFacing(
      st,
      args({ turnLeft: true, serverFacing: Math.PI - 0.01 }),
    ) as number;
    expect(f).toBeLessThan(Math.PI + 1e-9);
    expect(Math.abs(f)).toBeLessThanOrEqual(Math.PI);
  });
});
