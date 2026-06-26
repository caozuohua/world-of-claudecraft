import { describe, expect, it } from 'vitest';
import {
  COMBAT_ANNOUNCE_INTERVAL_MS,
  combatAnnounceDue,
  combatLineKind,
  liveRegionPoliteness,
} from '../src/ui/live_region_politeness';

// The pure live-region politeness picker + throttle gate (P15a). Routine chat and
// combat announce politely; assertive is reserved for the genuinely urgent role=alert
// nodes; the combat region is throttled, never assertive-spammed.
describe('liveRegionPoliteness', () => {
  it('announces chat and routine combat politely', () => {
    expect(liveRegionPoliteness('chat')).toBe('polite');
    expect(liveRegionPoliteness('combat')).toBe('polite');
  });

  it('reserves assertive for the genuinely urgent system alerts (the role=alert nodes)', () => {
    expect(liveRegionPoliteness('systemAlert')).toBe('assertive');
  });

  it('does not announce an event another region already speaks', () => {
    expect(liveRegionPoliteness('silent')).toBe('off');
  });

  it('keeps the combat region and the assertive role=alert region mutually exclusive', () => {
    // A combat event resolves to the polite combat region, NEVER the assertive
    // role=alert region, so one combat event updates exactly one region.
    expect(liveRegionPoliteness('combat')).not.toBe(liveRegionPoliteness('systemAlert'));
    expect(liveRegionPoliteness('combat')).toBe('polite');
  });

  it('is deterministic: same input -> same output', () => {
    for (const kind of ['chat', 'combat', 'systemAlert', 'silent'] as const) {
      expect(liveRegionPoliteness(kind)).toBe(liveRegionPoliteness(kind));
    }
  });
});

describe('combat-line politeness parity + safety (decision 15: Sim vs ClientWorld)', () => {
  // The HUD funnels BOTH hosts' combat lines through the one combatLog() path, and
  // combatLineKind() takes NO host argument: it is parameterless and always classifies a
  // combat line as 'combat'. So there is no input by which a Sim-emitted line and a
  // ClientWorld-mirrored line could diverge; the parity is structural, not coincidental.
  // (An earlier version of this test built two decorative event objects and asserted
  // liveRegionPoliteness('combat') === liveRegionPoliteness('combat'), which is vacuous;
  // it now pins the real properties that make the parity hold.)
  it('classifies a combat line host-agnostically (no parameter the host could vary)', () => {
    expect(combatLineKind.length).toBe(0); // parameterless: nothing host-specific feeds it
    expect(combatLineKind()).toBe('combat');
  });

  it('always announces a combat line polite and NEVER assertive, on either host', () => {
    // The real safety guarantee: a routine combat line is throttled-polite, never
    // escalated to assertive spam. Because the kind is host-fixed, this holds identically
    // offline (Sim) and online (the ClientWorld mirror).
    const politeness = liveRegionPoliteness(combatLineKind());
    expect(politeness).toBe('polite');
    expect(politeness).not.toBe('assertive');
  });
});

describe('combatAnnounceDue (pure throttle gate)', () => {
  it('lets the first announcement through immediately (lastAnnounce = -Infinity)', () => {
    expect(combatAnnounceDue(0, Number.NEGATIVE_INFINITY)).toBe(true);
  });

  it('holds within the interval and releases at/after it', () => {
    expect(combatAnnounceDue(0, 0)).toBe(false);
    expect(combatAnnounceDue(COMBAT_ANNOUNCE_INTERVAL_MS - 1, 0)).toBe(false);
    expect(combatAnnounceDue(COMBAT_ANNOUNCE_INTERVAL_MS, 0)).toBe(true);
    expect(combatAnnounceDue(COMBAT_ANNOUNCE_INTERVAL_MS + 500, 0)).toBe(true);
  });

  it('honors an injected interval override and stays deterministic', () => {
    expect(combatAnnounceDue(500, 0, 1000)).toBe(false);
    expect(combatAnnounceDue(1000, 0, 1000)).toBe(true);
    expect(combatAnnounceDue(1000, 0, 1000)).toBe(combatAnnounceDue(1000, 0, 1000));
  });

  it('exposes a named cadence constant, not a magic literal (decision 12)', () => {
    expect(typeof COMBAT_ANNOUNCE_INTERVAL_MS).toBe('number');
    expect(COMBAT_ANNOUNCE_INTERVAL_MS).toBeGreaterThan(0);
  });
});
