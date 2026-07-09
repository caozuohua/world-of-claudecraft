import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Source-level guards for the redesigned options painter (the Warden's Codex
// desktop chrome, P2). The pure control descriptors + the per-kind dispatch
// coercion are unit-tested in options_view.test.ts; here we pin the no-magic
// contract, the tier boundary, the WCAG roles/focus-return, the frame adoption,
// the two-pane structure, and (the load-bearing one) that every setting row
// still fires the SAME dispatch write it did before the redesign.
const painter = readFileSync(new URL('../src/ui/options_window.ts', import.meta.url), 'utf8');
const hudTs = readFileSync(new URL('../src/ui/hud.ts', import.meta.url), 'utf8');

describe('options_window: no magic values', () => {
  it('carries no literal color in TS (colors live in the extracted stylesheet)', () => {
    const hex = painter.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    expect(hex, `hex colors must move to tokens/CSS: ${hex.join(', ')}`).toEqual([]);
    expect(painter, 'rgb()/hsl() color literal must move to tokens/CSS').not.toMatch(
      /\b(?:rgba?|hsla?)\(/,
    );
  });

  it('names its numeric thresholds instead of bare literals', () => {
    expect(painter).toContain('RANGE_FILL_FULL_PCT');
    expect(painter).toContain('const BUG_DESC_MAX_LEN = 2000;');
    expect(painter.match(/\b2000\b/g) ?? []).toHaveLength(1);
  });

  it('uses no em or en dashes (ASCII separators only)', () => {
    expect(painter.includes('—'), 'em dash found').toBe(false);
    expect(painter.includes('–'), 'en dash found').toBe(false);
  });
});

describe('options_window: tier boundary', () => {
  it('reads the graphics preset as a plain setting value, never the governor/cutoff', () => {
    expect(painter).not.toContain('ui_effects_profile');
    expect(painter).not.toContain('EFFECTS_QUALITY_LOW_CUTOFF');
    expect(painter).not.toMatch(/governor\s*[.(]/);
    expect(painter).not.toMatch(/\.state\(\)\.levels/);
  });
});

describe('options_window: window-frame adoption + XL two-pane shell', () => {
  it('renders #options-menu through the shared window-frame builder', () => {
    expect(painter).toContain(
      "import { renderWindowFrame, type WindowFrameParts } from './window_frame'",
    );
    expect(painter).toContain("id: 'options-menu'");
    expect(painter).toContain(
      'renderWindowFrame(mount, OPTIONS_FRAME, { onClose: () => this.close() })',
    );
    // The frame's footer carries the transactional footer row.
    expect(painter).toContain('footer: true');
  });

  it('builds the recessed rail (role=tablist) + detail two-pane and the shell search strip', () => {
    expect(painter).toContain("el('div', 'opt-rail')");
    expect(painter).toContain("rail.setAttribute('role', 'tablist')");
    expect(painter).toContain("rail.setAttribute('aria-orientation', 'vertical')");
    expect(painter).toContain("el('div', 'opt-detail')");
    expect(painter).toContain("el('div', 'opt-search')");
    expect(painter).toContain("t('hudChrome.options.searchPlaceholder')");
    // scope chips
    expect(painter).toContain("'hudChrome.options.searchScopeAll'");
    expect(painter).toContain("'hudChrome.options.searchScopeThis'");
  });
});

describe('options_window: always opens on Overview (never last-visited)', () => {
  it('the toggle path resets to the Overview landing with the All scope', () => {
    const toggle = painter.slice(painter.indexOf('toggle(): void {'));
    const body = toggle.slice(0, toggle.indexOf('\n  }\n'));
    expect(body).toContain("this.activeCategory = 'overview'");
    expect(body).toContain("this.searchScope = 'all'");
    expect(body).toContain("this.subView = 'none'");
  });

  it('the default field value is the Overview landing', () => {
    expect(painter).toContain("private activeCategory: CategoryId = 'overview';");
  });
});

describe('options_window: WCAG 2.2 AA', () => {
  it('returns focus to the opener on every close path', () => {
    expect(painter).toContain('captureFocus');
    expect(painter).toContain('restoreFocus');
    const close = painter.slice(painter.indexOf('close(): void {'));
    expect(close.slice(0, close.indexOf('\n  }\n'))).toContain('this.deps.restoreFocus(target)');
  });

  it('exposes programmatic roles/labels on its controls', () => {
    // sliders are native range inputs with an aria-label + human readout
    expect(painter).toContain("slider.type = 'range'");
    expect(painter).toContain("slider.setAttribute('aria-label', label)");
    expect(painter).toContain("slider.setAttribute('aria-valuetext', text)");
    // the switch replaces the ON/OFF button: role=switch + aria-checked
    expect(painter).toContain("toggle.setAttribute('role', 'switch')");
    expect(painter).toContain("toggle.setAttribute('aria-checked'");
    // segmented choice is a radiogroup of radios
    expect(painter).toContain("seg.setAttribute('role', 'radiogroup')");
    expect(painter).toContain("btn.setAttribute('role', 'radio')");
    // async status + error live regions in the bug report / language flows
    expect(painter).toContain("status.setAttribute('role', 'status')");
    expect(painter).toContain("error.setAttribute('role', 'alert')");
  });
});

// The load-bearing guard: the DOM grammar changed but every setting write is
// byte-identical to the pre-redesign painter (the dispatch-parity contract).
describe('options_window: control-primitive dispatch wiring', () => {
  it('routes each descriptor kind to its matching builder', () => {
    expect(painter).toContain('this.settingSlider(parent, c, hooks)');
    expect(painter).toContain('this.settingToggle(parent, c, hooks)');
    expect(painter).toContain('this.settingBoolToggle(parent, c, hooks)');
    expect(painter).toContain(
      'this.settingChoice(parent, c, hooks, c.rerender ? rerender : undefined)',
    );
  });

  it('fires the exact same setting write per control kind as the inline original', () => {
    expect(painter).toContain('hooks.onSettingChange(key, sliderDispatchValue(slider.value))');
    expect(painter).toContain(
      'hooks.onSettingChange(key, toggleNextValue(hooks.settings.get(key)))',
    );
    expect(painter).toContain(
      'hooks.settings.set(key, boolToggleNextValue(hooks.settings.get(key)))',
    );
    expect(painter).toContain('hooks.onSettingChange(key, option.value)');
  });

  it('binds each row through the shared options_view builder (no forked logic)', () => {
    expect(painter).toContain('buildControlFromRow(source, row)');
  });
});

describe('options_window: changeLanguage hardening (PR #730 preserved)', () => {
  it('guards re-entry, reverts in place on failure, and never sticks busy', () => {
    const lang = painter.slice(
      painter.indexOf('private languageRow'),
      painter.indexOf('private themeRow'),
    );
    expect(lang).toContain('let busy = false');
    expect(lang).toContain(
      'if (busy || !isSupportedLanguage(selected) || selected === getLanguage())',
    );
    expect(lang).toContain('.changeLanguage(selected');
    expect(lang).toContain('this.deps.setDropdownValue(dropdown, getLanguage())');
    expect(lang).toContain('.catch(');
    expect(lang).toContain('.finally(');
  });

  // Restored coverage (P2 review item 1): a successful language switch re-renders
  // the detail pane in place and returns focus to the language dropdown, so the
  // relocalized picker stays keyboard-navigable.
  it('re-renders the detail pane and refocuses the picker on a successful switch', () => {
    const lang = painter.slice(
      painter.indexOf('private languageRow'),
      painter.indexOf('private themeRow'),
    );
    expect(lang).toContain('this.renderDetail();');
    expect(lang).toContain("'.set-lang-select .ui-dd-btn'");
  });
});

describe('options_window: theme custom-color grid preserved under Interface', () => {
  it('renders the preset segments + the per-knob custom colour grid', () => {
    const theme = painter.slice(painter.indexOf('private themeRow'));
    const body = theme.slice(0, theme.indexOf('\n  private '));
    expect(body).toContain('theme.setPreset(id)');
    expect(body).toContain("input.type = 'color'");
    expect(body).toContain('theme.setCustom(knob, input.value)');
    expect(body).toContain('theme.resetCustom()');
  });
});

describe('options_window: bug-report dispatch + async states (preserved)', () => {
  it('preserves the submit action and the no-text / in-flight / failure states', () => {
    const bug = painter.slice(
      painter.indexOf('private renderBugReport'),
      painter.indexOf('private localizeBugReportError'),
    );
    expect(bug).toContain("error.textContent = t('hudChrome.bugReport.describeFirst')");
    expect(bug).toContain('submit.disabled = true');
    expect(bug).toContain('hooks\n        .submit({ description');
    expect(bug).toContain('hudChrome.bugReport.submittedNoShot');
    expect(bug).toContain('submit.disabled = false');
    expect(bug).toContain('this.localizeBugReportError(err)');
  });
});

describe('options_window: keybind rebind dispatch (unchanged until P4)', () => {
  it('captures a key and binds it to the same action/index', () => {
    expect(painter).toContain('private beginCapture(actionId: string, index: number');
    expect(painter).toContain('hooks.captureKey((code)');
    expect(painter).toContain('this.deps.keybinds().bind(actionId, index, code)');
    expect(painter).toContain('this.deps.refreshKeybindLabels()');
  });

  // Restored coverage (P2 review item 1): each controller per-button remap listbox
  // carries its physical button glyph as its accessible name.
  it('names each gamepad-remap listbox with its button glyph', () => {
    const controller = painter.slice(painter.indexOf('private renderControllerButtons'));
    const body = controller.slice(0, controller.indexOf('\n  private '));
    expect(body).toContain('ariaLabel: buttonLabel');
  });
});

describe('options_window: forced-colors selection cue (P2 review item 5)', () => {
  const components = readFileSync(new URL('../src/styles/components.css', import.meta.url), 'utf8');
  it('gives the selected segment a system-colour outline under forced-colors', () => {
    const forced = components.slice(components.indexOf('@media (forced-colors: active)'));
    const block = forced.slice(0, forced.indexOf('\n  }\n}'));
    expect(block).toMatch(/\.opt-seg-btn\.is-selected \{\s*outline: 2px solid Highlight;/);
  });
});

describe('options_window: performance overlay delegation preserved under System', () => {
  it('delegates to the PerfOverlaySettingsPanel and gates drag-placement to System', () => {
    expect(painter).toContain('new PerfOverlaySettingsPanel(');
    expect(painter).toContain('this.perfSettings.render(perfHost)');
    expect(painter).toContain("perfOverlay.setPlacement(id === 'system')");
    // the master toggle still rides on the showFps setting
    expect(painter).toContain("getShowFps: () => hooks.settings.get('showFps')");
  });
});

describe('options_window: footer + reset-all', () => {
  it('confirm-gates Reset all through the shared confirm dialog then re-applies every key', () => {
    const reset = painter.slice(painter.indexOf('private confirmResetAll'));
    const body = reset.slice(0, reset.indexOf('\n  }\n'));
    expect(body).toContain('this.deps.confirmDialog(');
    expect(body).toContain("t('hudChrome.options.resetAllTitle')");
    expect(body).toContain('settings.reset()');
    expect(body).toContain('this.deps.options()?.onSettingChange(k, all[k])');
  });

  it('gates Report a Bug online but keeps Log out reachable in both modes', () => {
    const footer = painter.slice(painter.indexOf('private renderFooter'));
    const body = footer.slice(0, footer.indexOf('\n  private '));
    expect(body).toContain('this.deps.bugReport() !== null');
    // logout is rendered unconditionally (offline it reloads to the title screen)
    expect(body).toContain('this.deps.options()?.logout()');
  });
});

describe('options_window: scoped category reset', () => {
  it('resets exactly the category key set to defaults and re-applies each', () => {
    const reset = painter.slice(painter.indexOf('private resetKeys'));
    const body = reset.slice(0, reset.indexOf('\n  }\n'));
    // numeric + bool keys both go set-then-onSettingChange to their def
    expect(body).toContain('hooks.settings.set(key as BoolSettingKey, bool.def)');
    expect(body).toContain('hooks.onSettingChange(key as keyof GameSettings, bool.def)');
    expect(body).toContain('hooks.settings.set(key as NumericSettingKey, r.def)');
    expect(painter).toContain('categoryResetKeys(id)');
  });
});

describe('options_window: viewport resync on open (PR #1118 preserved)', () => {
  it('calls syncAppViewport() before the panel becomes visible', () => {
    expect(painter).toContain("import { syncAppViewport } from '../game/app_viewport'");
    const toggle = painter.slice(painter.indexOf('toggle(): void {'));
    const body = toggle.slice(0, toggle.indexOf('\n  }\n'));
    const syncIdx = body.indexOf('syncAppViewport()');
    const displayIdx = body.indexOf("root().style.display = 'flex'");
    expect(syncIdx).toBeGreaterThan(-1);
    expect(displayIdx).toBeGreaterThan(-1);
    expect(syncIdx).toBeLessThan(displayIdx);
  });
});

describe('options_window: close semantics preserved', () => {
  it('drops perf placement, hides the tooltip, resumes music, returns focus', () => {
    const close = painter.slice(painter.indexOf('close(): void {'));
    const body = close.slice(0, close.indexOf('\n  }\n'));
    expect(body).toContain("this.deps.root().style.display = 'none'");
    expect(body).toContain('this.deps.options()?.perfOverlay.setPlacement(false)');
    expect(body).toContain('this.deps.hideTooltip()');
    expect(body).toContain('music.resumeFromMenu()');
    expect(body).toContain('this.deps.restoreFocus(target)');
  });
});

describe('options_window: uiScale slider commits on release (#1558 preserved)', () => {
  it('a commit-on-change slider commits only on change, previewing readout on input', () => {
    const fn = painter.slice(painter.indexOf('if (c.commitOnChange) {'));
    const branch = fn.slice(0, fn.indexOf('} else {'));
    const inputHandler = branch.slice(
      branch.indexOf("addEventListener('input'"),
      branch.indexOf("addEventListener('change'"),
    );
    expect(inputHandler).toContain('readoutFromSlider();');
    expect(inputHandler).not.toContain('onSettingChange');
    const changeHandler = branch.slice(branch.indexOf("addEventListener('change'"));
    expect(changeHandler).toContain("addEventListener('change', commit)");
  });

  it('a normal slider commits live on input, via the shared closure', () => {
    const elseArm = painter.slice(
      painter.indexOf('} else {', painter.indexOf('if (c.commitOnChange) {')),
    );
    expect(elseArm.slice(0, elseArm.indexOf('\n    }'))).toContain(
      "addEventListener('input', commit)",
    );
  });
});

describe('options_window: settings shows the running version (#1541 preserved)', () => {
  it('renders the version + build id from the shared app_version source', () => {
    expect(painter).toContain("import { appVersionInfo } from './app_version'");
    expect(painter).toContain('appVersionInfo()');
    expect(painter).toContain("t('hudChrome.options.version', { version, build })");
  });
});

describe('options_window: stays a cold window', () => {
  it('exposes no per-frame refresh and is never wired into Hud.update', () => {
    expect(painter).not.toContain('refreshIfChanged');
    const update = hudTs.slice(hudTs.indexOf('\n  update(): void {'));
    const nextMethodEnd = update.indexOf('\n  }\n');
    expect(update.slice(0, nextMethodEnd)).not.toContain('optionsWindow');
  });
});
