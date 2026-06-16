import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

function splitGameUiTemplate(): { templateHtml: string; liveHtml: string } {
  const marker = '<template id="game-ui-template">';
  const start = html.indexOf(marker);
  const end = html.indexOf('</template>', start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  const templateHtml = html.slice(start, end + '</template>'.length);
  return {
    templateHtml,
    liveHtml: html.slice(0, start) + html.slice(end + '</template>'.length),
  };
}

describe('client HTML shell', () => {
  it('keeps game HUD controls out of the live startup DOM', () => {
    const { liveHtml, templateHtml } = splitGameUiTemplate();

    expect(templateHtml).toContain('id="ui"');
    expect(templateHtml).toContain('Release Spirit');
    expect(templateHtml).toContain('Combat Log');
    expect(templateHtml).toContain('id="chat-input"');

    expect(liveHtml).not.toContain('id="ui"');
    expect(liveHtml).not.toContain('Release Spirit');
    expect(liveHtml).not.toContain('Combat Log');
    expect(liveHtml).not.toContain('id="chat-input"');
  });

  it('offers the quest log in the mobile controls drawer', () => {
    expect(html).toContain('id="mobile-extra-controls"');
    expect(html).toContain('id="mobile-quest"');
    expect(html).toContain('aria-label="Quest Log"');
  });

  it('only displays mobile touch controls after the game is active', () => {
    expect(html).toContain('body.mobile-touch.game-active #mobile-controls');
    expect(html).not.toContain('body.mobile-touch #mobile-controls { position: absolute; inset: 0; display: block;');
  });

  it('lays out mobile More tray buttons horizontally', () => {
    expect(html).toContain('body.mobile-touch #mobile-extra-controls .mobile-btn');
    expect(html).toContain('flex-direction: row;');
    expect(html).toContain('body.mobile-touch #mobile-extra-controls .mobile-btn .ui-icon');
  });

  it('omits Meters from the mobile More tray while keeping the desktop window', () => {
    expect(html).toContain('id="meters-window"');
    expect(html).not.toContain('id="mobile-meters"');
  });

  it('keeps the mobile More button in the combat row', () => {
    const combatControls = html.slice(html.indexOf('<div id="mobile-combat-controls">'), html.indexOf('<div id="mobile-extra-controls">'));
    const primaryButtons = [...combatControls.matchAll(/<button class="mobile-btn"/g)];

    expect(primaryButtons).toHaveLength(6);
    expect(html).toContain('grid-template-columns: 124px repeat(5, 58px);');
    expect(html).toContain('grid-template-columns: 115px repeat(5, 54px);');
    expect(html).toContain('grid-template-columns: 96px repeat(5, 42px);');
    expect(html).toContain('pointer-events: auto; align-items: end; z-index: 30;');
    expect(html).toContain('body.mobile-touch #mobile-more {\n    position: static;');
  });

  it('keeps the mobile move zone clear of the centered skill bar', () => {
    expect(html).toContain('width: min(34vw, calc(50vw - 126px));');
    expect(html).toContain('min-width: 142px;');
    expect(html).toContain('max-width: 300px;');
  });

  it('places mobile Autorun beside the spell bar', () => {
    expect(html).toContain('body.mobile-touch #mobile-autorun {\n    position: fixed;');
    expect(html).toContain('left: max(calc(18px + env(safe-area-inset-left)), calc(50% - 208px));');
    expect(html).toContain('bottom: calc(72px + env(safe-area-inset-bottom));');
    expect(html).toContain('body.mobile-touch.mobile-window-open #mobile-autorun { display: none; }');
  });

  it('keeps the expanded mobile More tray inside the viewport', () => {
    expect(html).toContain('calc(100vw - 222px - max(12px, env(safe-area-inset-right, 0px)))');
    expect(html).toContain('calc(100vw - 208px - max(12px, env(safe-area-inset-right, 0px)))');
  });

  it('caps mobile quest and NPC panels instead of stretching them edge to edge', () => {
    expect(html).toContain('body.mobile-touch #quest-log-window,\n  body.mobile-touch #vendor-window,\n  body.mobile-touch #quest-dialog');
    expect(html).toContain('width: clamp(320px, 76vw, 680px);');
    expect(html).toContain('max-width: calc(100vw - 20px);');
    expect(html).toContain('transform: translateX(-50%);');
  });

  it('centers mobile Talents above touch controls', () => {
    expect(html).toContain('body.mobile-touch.mobile-window-open #ui {\n    z-index: 90;');
    expect(html).toContain('body.mobile-touch #talents-window {\n    position: fixed;');
    expect(html).toContain('top: 50%;');
    expect(html).toContain('transform: translate(-50%, -50%);');
    expect(html).toContain('z-index: 95 !important;');
  });
});
