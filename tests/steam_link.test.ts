// The character-select Steam Link button gating (src/ui/steam_link.ts): the
// button must key off the shell's REAL capability (wocDesktop.steamLinkSupported,
// backed by the desktop-steam-capability IPC), not the mere presence of the
// steamLinkTicket bridge method, which every Electron shell exposes including
// packaged website builds where a ticket can never be minted. Driven with a
// hand-rolled fake DOM (jsdom is deliberately not a dependency) and a stubbed
// wocDesktop bridge.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Api } from '../src/net/online';
import { refreshSteamLinkStatus, wireSteamLink } from '../src/ui/steam_link';

// steam_link.ts consults DESKTOP_APP at call time; force the desktop arm so the
// bridge path under test is reachable in plain Node.
vi.mock('../src/net/online', () => ({ DESKTOP_APP: true }));

interface FakeElement {
  hidden: boolean;
  textContent: string | null;
  listeners: Record<string, () => void>;
  addEventListener(type: string, handler: () => void): void;
}

function installDom(): Record<string, FakeElement> {
  const elements: Record<string, FakeElement> = {};
  for (const id of ['cs-steam-group', 'steam-status', 'btn-steam-link', 'btn-steam-unlink']) {
    const listeners: Record<string, () => void> = {};
    elements[id] = {
      hidden: false,
      textContent: '',
      listeners,
      addEventListener(type: string, handler: () => void) {
        listeners[type] = handler;
      },
    };
  }
  (globalThis as { document?: unknown }).document = {
    getElementById: (id: string) => elements[id] ?? null,
  };
  return elements;
}

// Drain the promise chain a click handler kicked off (no timers in play).
async function flushAsync(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

// The login trio is what desktopBridge() requires; the Steam methods ride on top.
function installBridge(steamMethods: Record<string, unknown>): void {
  (globalThis as { wocDesktop?: unknown }).wocDesktop = {
    openBrowserLogin: async () => {},
    takeLoginCode: async () => null,
    onLoginCode: () => () => {},
    ...steamMethods,
  };
}

// An authed, server-advertised, not-yet-linked player: the one state where the
// Link button is a candidate to show at all.
const unlinkedApi = {
  token: 'session-token',
  steamAdvert: async () => true,
  steamStatus: async () => ({ enabled: true, linked: false }),
} as unknown as Api;

afterEach(() => {
  delete (globalThis as { document?: unknown }).document;
  delete (globalThis as { wocDesktop?: unknown }).wocDesktop;
});

describe('refreshSteamLinkStatus capability gating', () => {
  it('hides the Link button when the shell reports Steam unsupported (website build)', async () => {
    const elements = installDom();
    installBridge({
      steamLinkTicket: async () => null,
      steamLinkSupported: async () => false,
    });
    await refreshSteamLinkStatus(unlinkedApi);
    expect(elements['cs-steam-group'].hidden).toBe(false);
    expect(elements['btn-steam-link'].hidden).toBe(true);
  });

  it('shows the Link button when the shell reports Steam supported', async () => {
    const elements = installDom();
    installBridge({
      steamLinkTicket: async () => 'deadbeef',
      steamLinkSupported: async () => true,
    });
    await refreshSteamLinkStatus(unlinkedApi);
    expect(elements['cs-steam-group'].hidden).toBe(false);
    expect(elements['btn-steam-link'].hidden).toBe(false);
  });

  it('falls back to ticket-method presence on older shells without the capability probe', async () => {
    const elements = installDom();
    installBridge({ steamLinkTicket: async () => 'deadbeef' });
    await refreshSteamLinkStatus(unlinkedApi);
    expect(elements['btn-steam-link'].hidden).toBe(false);
  });

  it('keeps hiding the Link button when even the ticket method is absent', async () => {
    const elements = installDom();
    installBridge({});
    await refreshSteamLinkStatus(unlinkedApi);
    expect(elements['btn-steam-link'].hidden).toBe(true);
  });

  it('falls back to ticket-method presence when the capability probe throws', async () => {
    // A transient bridge error must not hide a working Link button; the server
    // stays the authority, so the worst case is a click that mints null.
    const elements = installDom();
    installBridge({
      steamLinkTicket: async () => 'deadbeef',
      steamLinkSupported: async () => {
        throw new Error('ipc hiccup');
      },
    });
    await refreshSteamLinkStatus(unlinkedApi);
    expect(elements['btn-steam-link'].hidden).toBe(false);
  });
});

describe('startSteamLink capability guard', () => {
  it('never mints a ticket when the shell reports Steam unsupported', async () => {
    const elements = installDom();
    const mint = vi.fn(async () => 'deadbeef');
    installBridge({
      steamLinkTicket: mint,
      steamLinkSupported: async () => false,
    });
    const steamLink = vi.fn(async () => ({}));
    const api = {
      token: 'session-token',
      steamAdvert: async () => true,
      steamStatus: async () => ({ enabled: true, linked: false }),
      steamLink,
    } as unknown as Api;
    wireSteamLink(api);
    elements['btn-steam-link'].listeners.click();
    await flushAsync();
    expect(mint).not.toHaveBeenCalled();
    expect(steamLink).not.toHaveBeenCalled();
  });

  it('mints and posts the ticket when the shell reports Steam supported', async () => {
    const elements = installDom();
    const mint = vi.fn(async () => 'deadbeef');
    installBridge({
      steamLinkTicket: mint,
      steamLinkSupported: async () => true,
    });
    const steamLink = vi.fn(async () => ({}));
    const api = {
      token: 'session-token',
      steamAdvert: async () => true,
      steamStatus: async () => ({ enabled: true, linked: false }),
      steamLink,
    } as unknown as Api;
    wireSteamLink(api);
    elements['btn-steam-link'].listeners.click();
    await flushAsync();
    expect(mint).toHaveBeenCalledTimes(1);
    expect(steamLink).toHaveBeenCalledWith('deadbeef');
  });
});
