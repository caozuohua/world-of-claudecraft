// Tests for the Renown-tab pure core (deeds_leaderboard_view.ts):
//  - the async state machine: loading / error / empty / ranked discriminators,
//  - row derivation (rank, name, realm, class + knownClass, level, renown,
//    deedCount, and the TITLE passed through as a DEED ID, never text),
//  - the viewer's own display-character row flagged `me` by name,
//  - the server-resolved `self` standing passed through (null when absent),
//  - the pager state and the server page-clamp passthrough,
//  - parity: a Sim-shaped empty page (the offline sandbox has no account
//    population) and same-input determinism.
//
// The core is async-free (the painter owns the Promise); this Node suite
// drives it directly.

import { describe, expect, it } from 'vitest';
import { paginateDeedsLeaderboard } from '../src/sim/leaderboard_page';
import {
  buildDeedsLeaderboardView,
  type DeedsLeaderboardInput,
} from '../src/ui/deeds_leaderboard_view';
import type { DeedsLeaderboardEntry, DeedsLeaderboardPage } from '../src/world_api';

function entry(over: Partial<DeedsLeaderboardEntry> = {}): DeedsLeaderboardEntry {
  return {
    rank: 1,
    name: 'Aldwin',
    realm: 'Claudemoon',
    cls: 'warrior',
    level: 20,
    renown: 425,
    deedCount: 37,
    title: 'prog_veteran',
    ...over,
  };
}

function page(over: Partial<DeedsLeaderboardPage> = {}): DeedsLeaderboardPage {
  return { leaders: [entry()], page: 0, pageCount: 1, total: 1, pageSize: 50, ...over };
}

describe('buildDeedsLeaderboardView', () => {
  it('maps the loading discriminator straight through', () => {
    expect(buildDeedsLeaderboardView({ kind: 'loading' })).toEqual({ kind: 'loading' });
  });

  it('maps the error discriminator straight through', () => {
    expect(buildDeedsLeaderboardView({ kind: 'error' })).toEqual({ kind: 'error' });
  });

  it('reports an empty page as empty (the offline Sim always lands here)', () => {
    const view = buildDeedsLeaderboardView({
      kind: 'page',
      page: page({ leaders: [], total: 0 }),
    });
    expect(view.kind).toBe('empty');
  });

  it('derives ranked rows, passing every entry field through with the title as a deed id', () => {
    const input: DeedsLeaderboardInput = {
      kind: 'page',
      page: page({
        leaders: [
          entry({ rank: 1, name: 'Aldwin', renown: 425, deedCount: 37, title: 'prog_veteran' }),
          entry({ rank: 2, name: 'Berrin', realm: 'Duskhold', renown: 300, title: null }),
        ],
        total: 2,
      }),
    };
    const view = buildDeedsLeaderboardView(input);
    expect(view.kind).toBe('ranked');
    if (view.kind !== 'ranked') return;
    expect(view.rows).toEqual([
      {
        rank: 1,
        name: 'Aldwin',
        realm: 'Claudemoon',
        cls: 'warrior',
        knownClass: true,
        level: 20,
        renown: 425,
        deedCount: 37,
        // Never localized here: the painter resolves through deed_i18n.ts.
        title: 'prog_veteran',
        me: false,
      },
      {
        rank: 2,
        name: 'Berrin',
        realm: 'Duskhold',
        cls: 'warrior',
        knownClass: true,
        level: 20,
        renown: 300,
        deedCount: 37,
        title: null,
        me: false,
      },
    ]);
  });

  it('flags an unknown class id so the painter skips the class tooltip', () => {
    const view = buildDeedsLeaderboardView({
      kind: 'page',
      page: page({
        leaders: [entry({ cls: 'gone_class' as DeedsLeaderboardEntry['cls'] })],
      }),
    });
    if (view.kind !== 'ranked') throw new Error('expected ranked');
    expect(view.rows[0].knownClass).toBe(false);
  });

  it('flags the viewer display row me by exact character name', () => {
    const view = buildDeedsLeaderboardView({
      kind: 'page',
      page: page({
        leaders: [entry({ rank: 1, name: 'Aldwin' }), entry({ rank: 2, name: 'Berrin' })],
        total: 2,
      }),
      viewerName: 'Berrin',
    });
    if (view.kind !== 'ranked') throw new Error('expected ranked');
    expect(view.rows[0].me).toBe(false);
    expect(view.rows[1].me).toBe(true);
  });

  it('does not flag any row me when the viewer name is absent, empty, or null', () => {
    for (const viewerName of [undefined, '', null] as const) {
      const view = buildDeedsLeaderboardView({ kind: 'page', page: page(), viewerName });
      if (view.kind !== 'ranked') throw new Error('expected ranked');
      expect(view.rows[0].me).toBe(false);
    }
  });

  it('passes the server-resolved self standing through, null when absent', () => {
    const withSelf = buildDeedsLeaderboardView({
      kind: 'page',
      page: page({ self: { rank: 12, topPercent: 4 } }),
    });
    if (withSelf.kind !== 'ranked') throw new Error('expected ranked');
    expect(withSelf.self).toEqual({ rank: 12, topPercent: 4 });

    const withoutSelf = buildDeedsLeaderboardView({ kind: 'page', page: page() });
    if (withoutSelf.kind !== 'ranked') throw new Error('expected ranked');
    expect(withoutSelf.self).toBeNull();
  });

  it('omits the pager when the board fits on one page', () => {
    const view = buildDeedsLeaderboardView({ kind: 'page', page: page() });
    if (view.kind !== 'ranked') throw new Error('expected ranked');
    expect(view.pager).toBeNull();
  });

  it('builds pager state with prev disabled on the first page', () => {
    const view = buildDeedsLeaderboardView({ kind: 'page', page: page({ page: 0, pageCount: 3 }) });
    if (view.kind !== 'ranked') throw new Error('expected ranked');
    expect(view.pager).toEqual({ page: 0, pageCount: 3, prevDisabled: true, nextDisabled: false });
  });

  it('builds pager state with next disabled on the last page', () => {
    const view = buildDeedsLeaderboardView({ kind: 'page', page: page({ page: 2, pageCount: 3 }) });
    if (view.kind !== 'ranked') throw new Error('expected ranked');
    expect(view.pager).toEqual({ page: 2, pageCount: 3, prevDisabled: false, nextDisabled: true });
  });

  it('mirrors the server-clamped page back into the view', () => {
    const view = buildDeedsLeaderboardView({ kind: 'page', page: page({ page: 1, pageCount: 4 }) });
    if (view.kind !== 'ranked') throw new Error('expected ranked');
    expect(view.page).toBe(1);
  });

  it('is deterministic for the same input', () => {
    const input: DeedsLeaderboardInput = { kind: 'page', page: page(), viewerName: 'Aldwin' };
    expect(buildDeedsLeaderboardView(input)).toEqual(buildDeedsLeaderboardView(input));
  });

  it('parity: a Sim-shaped empty page renders empty like the offline world', () => {
    // The offline Sim resolves paginateDeedsLeaderboard([], ...): an empty
    // board with no self line, exactly the sandbox contract.
    const simPage = paginateDeedsLeaderboard([], 0, 50);
    const view = buildDeedsLeaderboardView({ kind: 'page', page: simPage });
    expect(view.kind).toBe('empty');
  });
});
