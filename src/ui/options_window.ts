// Options window painter: the Warden's Codex desktop chrome (P2).
//
// Owns the #options-menu DOM, adopting the shared window-frame builder
// (window_frame.ts) at XL size and painting a recessed category rail + detail
// two-pane off the pure view-models in options_view.ts (which consume the
// options_ia tree). The window is a full-attention modal: non-draggable and
// non-resizable (excluded in window_drag_handle.ts + window_resize.ts), always
// opening on the Overview landing.
//
// This is the thin DOM consumer per the vendor_window template. Every setting
// row's dispatch is byte-identical to the pre-redesign painter: the pure
// coercions (sliderDispatchValue / toggleNextValue / boolToggleNextValue) and
// the exact onSettingChange / settings.set calls are preserved; only the DOM
// grammar changed (the text ON/OFF button became the .opt-switch role=switch,
// choices became the .opt-seg radiogroup). The bespoke flows are ported intact:
// the language busy/failed picker, the theme preset + custom-colour grid, the
// keybind rebind table, the Controller per-button remap, and the delegated
// performance-overlay panel (drag-placement gated to the System category).
//
// No raw hex / magic values: every colour lives in the extracted stylesheet;
// the two numeric thresholds here are named constants. The graphics rows read
// the STATIC graphics preset as a plain setting value only.

import { syncAppViewport } from '../game/app_viewport';
import { audio } from '../game/audio';
import { GAMEPAD_NONE, GP, gamepadButtonLabel } from '../game/gamepad_map';
import {
  BIND_ACTIONS,
  BIND_CATEGORIES,
  isReservedCode,
  type Keybinds,
  keyLabel,
} from '../game/keybinds';
import type { MenuIntentKind } from '../game/menu_gamepad_nav';
import { isNativeAppShell, useTouchInterface } from '../game/mobile_controls';
import { music } from '../game/music';
import {
  BOOL_SETTINGS,
  type BoolSettingKey,
  type GameSettings,
  type NumericSettingKey,
  SETTING_RANGES,
} from '../game/settings';
import type { IWorld } from '../world_api';
import { appVersionInfo } from './app_version';
import type { ChatClock } from './chat_timestamp';
import { esc } from './esc';
import { FOCUSABLE_SELECTOR } from './focus_manager';
import type { BugReportHooks, OptionsHooks } from './hud';
import {
  formatNumber,
  getLanguage,
  isSupportedLanguage,
  type SupportedLanguage,
  supportedLanguages,
  t,
} from './i18n';
import type { TranslationKey } from './i18n.catalog';
import {
  type ControllerBindRow,
  type ControllerDuplicate,
  computeKeybindConflicts,
  evictedActions,
  type KeybindConflicts,
  type KeyboardBindRow,
} from './keybind_conflicts';
import {
  clampIndex,
  type FocusIntent,
  type RowControlKind,
  rowKeyIntent,
  SLIDER_PAGE_STEPS,
  segIndexForIntent,
  sliderStepValue,
  wrapIndex,
} from './options_focus_model';
import {
  buildSearchIndex,
  CATEGORIES,
  type CategoryId,
  categoriesForSearch,
  categorySettingKeys,
  OVERVIEW_PINS,
  OVERVIEW_QUICK_ACTIONS,
  type QuickActionId,
  settingRow,
} from './options_ia';
import {
  type BoolToggleControl,
  boolToggleNextValue,
  buildBugReportInfo,
  buildControlFromRow,
  type ChoiceControl,
  categoryChangedCount,
  categoryResetKeys,
  type OptionsControl,
  type OptionsSettingsSource,
  renderCategory,
  renderRailModel,
  rowMatchesQuery,
  type SliderControl,
  type SliderFmt,
  sliderDispatchValue,
  type ToggleControl,
  toggleIsOn,
  toggleNextValue,
  totalChangedCount,
} from './options_view';
import { PerfOverlaySettingsPanel, type PerfSettingsHost } from './perf_overlay_settings';
import { rovingTarget } from './roving_index';
import {
  PRESET_ORDER,
  type PresetId,
  resolveTheme,
  THEME_KNOB_LABEL_KEY,
  THEME_KNOB_ORDER,
} from './theme';
import { svgIcon, type UiIconName } from './ui_icons';
import { renderWindowFrame, type WindowFrameParts } from './window_frame';
import type { WindowFrameDescriptor } from './window_frame_view';

// Maximum characters for the bug-report description (a named threshold).
const BUG_DESC_MAX_LEN = 2000;
// Full-scale percent for the slider gold-fill gradient (--range-fill is 0..100%).
const RANGE_FILL_FULL_PCT = 100;
// A controller page-scroll (RT/LT) moves the detail pane by this fraction of its
// viewport height (spec section 5: "page-scroll long panes").
const PAGE_SCROLL_FRACTION = 0.9;
// Brand-neutral D-pad glyph for the footer legend. Mirrors the language-neutral
// hardware-glyph convention in gamepad_map (the per-brand arrow labels there all
// share this prefix); kept ASCII (no arrows) for the legend's compact single line.
const DPAD_GLYPH = 'D-pad';

// The XL frame descriptor. #options-menu is not a shared tenant, but the frame
// still mounts on an inner container so the shared window-frame CSS (:has(>
// .window-frame), .window > .window-frame) binds exactly as it does for vendor.
const OPTIONS_FRAME: WindowFrameDescriptor = {
  id: 'options-menu',
  titleKey: 'hud.options.gameMenu',
  closeLabelKey: 'hud.options.returnToGame',
  footer: true,
};

// Graphics keys that only apply after a reload (drive the Overview reload alert),
// and the four advanced sub-pickers revealed only at the Advanced preset (5).
const RELOAD_KEYS = new Set([
  'graphicsPreset',
  'terrainDetail',
  'foliageDensity',
  'effectsQuality',
  'shadowQuality',
]);
const ADVANCED_GFX_KEYS = new Set([
  'terrainDetail',
  'foliageDensity',
  'effectsQuality',
  'shadowQuality',
]);

// Rail category icon: best-fit mapping onto the existing UiIconName glyph set
// (dedicated rail glyphs are a follow-up). The label is always the primary
// affordance; the icon carries the rail when it collapses under 900px.
const RAIL_ICON: Record<string, UiIconName> = {
  home: 'menu',
  display: 'map',
  layout: 'nameplates',
  accessibility: 'interact',
  mouse: 'target',
  keyboard: 'character',
  gamepad: 'swap',
  touch: 'vibrate',
  audio: 'music',
  gauge: 'meters',
};
const railIcon = (slug: string): UiIconName => RAIL_ICON[slug] ?? 'menu';

// Endonyms for the in-game language picker; never localized (they render
// identically in every locale, matching the homepage footer picker).
const LANGUAGE_ENDONYMS: Record<SupportedLanguage, string> = {
  en: 'English (US)',
  es: 'Español (LatAm)',
  es_ES: 'Español (España)',
  fr_FR: 'Français (France)',
  fr_CA: 'Français (Canada)',
  en_CA: 'English (Canada)',
  it_IT: 'Italiano',
  de_DE: 'Deutsch',
  zh_CN: '简体中文',
  zh_TW: '繁體中文',
  ko_KR: '한국어',
  ja_JP: '日本語',
  pt_BR: 'Português (Brasil)',
  ru_RU: 'Русский',
  cs_CZ: 'Čeština',
  nl_NL: 'Nederlands',
  pl_PL: 'Polski',
  id_ID: 'Bahasa Indonesia',
  tr_TR: 'Türkçe',
  sv_SE: 'Svenska',
  vi_VN: 'Tiếng Việt',
  da_DK: 'Dansk',
};

// Localized labels for the keybind category headers + action rows.
const BIND_CATEGORY_LABEL_KEYS: Partial<Record<string, TranslationKey>> = {
  Movement: 'hud.keybinds.categories.movement',
  Targeting: 'hud.keybinds.categories.targeting',
  Interface: 'hud.keybinds.categories.interface',
  'Action Bar': 'hud.keybinds.categories.actionBar',
};
const BIND_ACTION_LABEL_KEYS: Partial<Record<string, TranslationKey>> = {
  forward: 'hud.keybinds.actions.forward',
  back: 'hud.keybinds.actions.back',
  turnLeft: 'hud.keybinds.actions.turnLeft',
  turnRight: 'hud.keybinds.actions.turnRight',
  strafeLeft: 'hud.keybinds.actions.strafeLeft',
  strafeRight: 'hud.keybinds.actions.strafeRight',
  jump: 'hud.keybinds.actions.jump',
  autorun: 'hud.keybinds.actions.autorun',
  target: 'hud.keybinds.actions.target',
  attackMove: 'hud.keybinds.actions.attackMove',
  interact: 'hud.keybinds.actions.interact',
  char: 'hud.keybinds.actions.char',
  spellbook: 'hud.keybinds.actions.spellbook',
  questlog: 'hud.keybinds.actions.questlog',
  map: 'hud.keybinds.actions.map',
  bags: 'hud.keybinds.actions.bags',
  nameplates: 'hud.keybinds.actions.nameplates',
  meters: 'hud.keybinds.actions.meters',
  social: 'hud.keybinds.actions.social',
  arena: 'hud.keybinds.actions.arena',
  chat: 'hud.keybinds.actions.chat',
  emoteWheel: 'hudChrome.keybinds.emoteWheel',
  targetFriendly: 'hudChrome.keybinds.targetFriendly',
  targetFriendlyNext: 'hudChrome.keybinds.targetFriendlyNext',
  discord: 'hudChrome.keybinds.discord',
  valecup: 'hudChrome.keybinds.valecup',
  talents: 'game.talents.title',
  leaderboard: 'game.leaderboard.title',
  calendar: 'hudChrome.calendar.keybindLabel',
  crafting: 'hudChrome.crafting.title',
};

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

/**
 * Hud-supplied glue. The window renders no item rows, so it composes no
 * PainterHostPresentation bag; it reads the world's bug-report slice and routes
 * the options / bug-report seams, the keybind store, the shared dropdown, focus
 * management, the confirm dialog, and the online flag through these closures.
 */
export interface OptionsWindowDeps {
  root(): HTMLElement;
  world(): IWorld;
  options(): OptionsHooks | null;
  bugReport(): BugReportHooks | null;
  keybinds(): Keybinds;
  slotActionName(slot: number): string | null;
  refreshKeybindLabels(): void;
  buildDropdown(
    options: { value: string; label: string }[],
    current: string,
    onChange?: (value: string) => void,
    placeholder?: string,
    a11y?: { ariaLabel?: string; labelledBy?: string },
  ): HTMLElement;
  setDropdownValue(root: HTMLElement, value: string): void;
  focusFirstInteractive(root: HTMLElement, preferredSelector?: string): void;
  closeOthers(): void;
  hideTooltip(): void;
  captureFocus(): HTMLElement | null;
  restoreFocus(target: HTMLElement | null): void;
  log(message: string): void;
  resetChatWindow(): void;
  resetUnitFrames(): void;
  getChatTimestamps(): boolean;
  setChatTimestamps(on: boolean): void;
  getChatClock(): ChatClock;
  setChatClock(clock: ChatClock): void;
  /** True in authoritative online play (gates the online-only quick actions +
   *  the status readout). Optional: falls back to the bug-report seam presence. */
  isOnline?(): boolean;
  /** The shared confirm dialog (reset-all is confirm-gated). Optional: without
   *  it the reset runs immediately (wired by hud.ts). */
  confirmDialog?(
    title: string,
    body: string,
    okText: string,
    cancelText: string,
    onOk: () => void,
  ): void;
}

type SearchScope = 'all' | 'section';

export class OptionsWindow {
  private activeCategory: CategoryId = 'overview';
  private searchQuery = '';
  private searchScope: SearchScope = 'all';
  // A pushed sub-view (bug report) inside the detail pane; back returns to System.
  private subView: 'none' | 'bugreport' = 'none';
  private capturingKey: { action: string; index: number } | null = null;
  // The active rebind capture's canceller (the on-screen Cancel affordance + the
  // focus-loss/blur exit call it; it fires the capture callback with null once).
  private captureCancel: (() => void) | null = null;
  // Action ids carrying a transient eviction badge until the next rebind interaction.
  private evictedRows: string[] = [];
  private keybindNote = '';
  private reloadPending = false;
  private perfSettings: PerfOverlaySettingsPanel | null = null;
  private returnFocus: HTMLElement | null = null;
  // Assertive live region for controller announcements (the X = clear keybind verb),
  // a body-level child so a detail-only repaint never destroys it.
  private announceEl: HTMLElement | null = null;

  constructor(private readonly deps: OptionsWindowDeps) {}

  get isOpen(): boolean {
    return this.deps.root().style.display === 'flex';
  }

  private online(): boolean {
    return this.deps.isOnline ? this.deps.isOnline() : this.deps.bugReport() !== null;
  }

  private env(): { touch: boolean; nativeShell: boolean } {
    return { touch: useTouchInterface(), nativeShell: isNativeAppShell() };
  }

  toggle(): void {
    if (this.isOpen) {
      this.close();
      return;
    }
    // Re-sync --app-vh/--app-vw right before opening (see PR 1118): a stale
    // value from a fullscreen toggle/resize would hard-clip the framed panel.
    syncAppViewport();
    this.returnFocus = this.deps.captureFocus();
    this.deps.closeOthers();
    // Always open on Overview (never last-visited), scope reset to All.
    this.activeCategory = 'overview';
    this.subView = 'none';
    this.searchQuery = '';
    this.searchScope = 'all';
    this.capturingKey = null;
    this.keybindNote = '';
    this.deps.options()?.perfOverlay.setPlacement(false);
    this.render();
    this.deps.root().style.display = 'flex';
    // Spec section 5: the menu opens with focus ON the Overview rail tab. This also
    // seeds the controller path: hud routes pad menu verbs to this window only while
    // focus is inside it, so without this a fresh open would strand a pad user.
    this.deps.focusFirstInteractive(this.deps.root(), '.opt-tab.is-active');
    music.pauseForMenu();
    audio.click();
  }

  close(): void {
    this.deps.root().style.display = 'none';
    // Disarm any in-flight rebind capture so a stale callback can never fire after
    // the menu is gone (input's captureCb is cleared by the canceller).
    this.cancelCapture();
    this.capturingKey = null;
    this.deps.options()?.perfOverlay.setPlacement(false);
    this.deps.hideTooltip();
    music.resumeFromMenu();
    const target = this.returnFocus;
    this.returnFocus = null;
    this.deps.restoreFocus(target);
  }

  /** Push a dropped perf-overlay drag position into the open panel's sliders. */
  onPerfOverlayMoved(x: number, y: number): void {
    this.perfSettings?.syncPosition(x, y);
  }

  /** Re-render the Controller pane in place when a pad connects/disconnects, and
   *  the footer legend strip (which appears only while a pad is connected). */
  refreshControllerLabels(): void {
    if (!this.isOpen) return;
    // The pad map (and thus the Controller duplicate aggregate) can change on
    // connect/disconnect, so refresh the rail dot alongside the pane.
    this.renderRail();
    if (this.activeCategory === 'controller' && this.subView === 'none') this.renderDetail();
    const footer = this.deps.root().querySelector<HTMLElement>('.window-footer');
    if (footer) this.renderFooter(footer);
  }

  // -------------------------------------------------------------------------
  // Frame + shell (stamped cold, then rail/detail repaint per interaction)
  // -------------------------------------------------------------------------

  private ensureFrame(): WindowFrameParts {
    const root = this.deps.root();
    const mounted = root.querySelector<HTMLElement>(':scope > .window-frame');
    const body = mounted?.querySelector<HTMLElement>('.window-body');
    if (mounted && body) {
      return {
        root: mounted,
        body,
        footer: mounted.querySelector<HTMLElement>('.window-footer'),
        tabButtons: [],
      };
    }
    const mount = document.createElement('div');
    const parts = renderWindowFrame(mount, OPTIONS_FRAME, { onClose: () => this.close() });
    root.replaceChildren(mount);
    // Ctrl+Tab / Ctrl+Shift+Tab cycle categories from anywhere in the body (spec
    // section 5). Attached once on the persistent body node so it survives every
    // pane repaint (the rail/detail listeners re-attach per render below).
    parts.body.addEventListener('keydown', (e) => this.onBodyKeydown(e));
    return parts;
  }

  private render(): void {
    const { body, footer } = this.ensureFrame();
    body.replaceChildren();
    body.appendChild(this.buildSearchStrip());
    // Assertive live region for controller announcements (body-level so a detail
    // repaint keeps it). visually-hidden; only its text is exposed to AT.
    const announce = el('div', 'visually-hidden');
    announce.setAttribute('role', 'status');
    announce.setAttribute('aria-live', 'assertive');
    body.appendChild(announce);
    this.announceEl = announce;
    const grid = el('div', 'opt-body');
    const rail = el('div', 'opt-rail');
    rail.setAttribute('role', 'tablist');
    rail.setAttribute('aria-orientation', 'vertical');
    const detailScroll = el('div', 'opt-detail');
    const detailInner = el('div', 'opt-detail-inner');
    detailScroll.appendChild(detailInner);
    grid.append(rail, detailScroll);
    body.appendChild(grid);
    // Navigation wiring (spec section 5): vertical roving on the rail, the in-row
    // value keys on the detail, and the authoritative .is-active-row cursor set on
    // focusin (NOT derived from :focus-visible, so it lights for programmatic and
    // controller focus too). These live on the persistent rail/detail scrollers, so
    // a detail-only repaint (renderDetail) keeps them; a full render re-creates the
    // nodes and re-binds fresh, so there is no leak.
    rail.addEventListener('keydown', (e) => this.onRailKeydown(e));
    detailScroll.addEventListener('keydown', (e) => this.onDetailKeydown(e));
    detailScroll.addEventListener('focusin', (e) => this.markActiveRow(e.target));
    this.renderRail();
    this.renderDetail();
    if (footer) this.renderFooter(footer);
  }

  private railEl(): HTMLElement {
    return this.deps.root().querySelector<HTMLElement>('.opt-rail') as HTMLElement;
  }

  private detailEl(): HTMLElement {
    return this.deps.root().querySelector<HTMLElement>('.opt-detail-inner') as HTMLElement;
  }

  private buildSearchStrip(): HTMLElement {
    const strip = el('div', 'opt-search');
    const field = el('div', 'search-field');
    const input = document.createElement('input');
    input.type = 'search';
    input.className = 'search-input';
    input.value = this.searchQuery;
    input.setAttribute('placeholder', t('hudChrome.options.searchPlaceholder'));
    input.setAttribute('aria-label', t('hudChrome.options.searchPlaceholder'));
    input.addEventListener('input', () => {
      this.searchQuery = input.value;
      // The input lives in the search strip, a sibling of the detail pane, so a
      // detail-only repaint preserves the caret + focus while typing.
      this.renderDetail();
    });
    field.appendChild(input);
    strip.appendChild(field);
    const scopes = el('div', 'opt-scopes');
    scopes.setAttribute('role', 'group');
    scopes.setAttribute('aria-label', t('hudChrome.options.searchPlaceholder'));
    const mkScope = (scope: SearchScope, labelKey: TranslationKey) => {
      const btn = el('button', 'opt-scope');
      btn.type = 'button';
      btn.dataset.scope = scope;
      btn.textContent = t(labelKey);
      btn.setAttribute('aria-pressed', String(this.searchScope === scope));
      // "This section" is meaningless on the Overview landing.
      if (scope === 'section' && this.activeCategory === 'overview') btn.disabled = true;
      btn.addEventListener('click', () => {
        this.searchScope = scope;
        for (const b of scopes.querySelectorAll<HTMLElement>('.opt-scope'))
          b.setAttribute('aria-pressed', String(b === btn));
        this.renderDetail();
      });
      return btn;
    };
    scopes.append(
      mkScope('all', 'hudChrome.options.searchScopeAll'),
      mkScope('section', 'hudChrome.options.searchScopeThis'),
    );
    strip.appendChild(scopes);
    return strip;
  }

  // -------------------------------------------------------------------------
  // Rail
  // -------------------------------------------------------------------------

  private renderRail(): void {
    const rail = this.railEl();
    rail.replaceChildren();
    const hooks = this.deps.options();
    const changed = (id: CategoryId): number =>
      hooks ? categoryChangedCount(id, (key) => this.isChanged(hooks, key)) : 0;
    // Aggregate conflict state feeds the per-category rail dot (spec section 7):
    // the Keybinds dot on any keyboard conflict/unbound, the Controller dot on any
    // controller duplicate. The dot lives OUTSIDE the label so it survives the
    // 900px icon-collapse (a conflict stays visible even when the rail is a strip).
    const conflicts = this.computeConflicts();
    const conflictFor = (id: CategoryId): boolean =>
      (id === 'keybinds' && conflicts.keyboardWarning) ||
      (id === 'controller' && conflicts.controllerWarning);
    const model = renderRailModel(this.env(), changed);
    rail.appendChild(this.railTab(model.overview, conflictFor(model.overview.id)));
    for (const group of model.groups) {
      const head = el('div', 'opt-rail-group');
      head.textContent = t(group.labelKey);
      rail.appendChild(head);
      for (const tab of group.tabs) rail.appendChild(this.railTab(tab, conflictFor(tab.id)));
    }
  }

  private railTab(
    tab: {
      id: CategoryId;
      iconSlug: string;
      nameKey: TranslationKey;
      changedCount: number;
    },
    hasConflict = false,
  ): HTMLElement {
    const name = t(tab.nameKey);
    const btn = el('button', 'opt-tab');
    btn.type = 'button';
    btn.setAttribute('role', 'tab');
    btn.dataset.category = tab.id;
    const active = this.activeCategory === tab.id && this.subView === 'none';
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', String(active));
    btn.tabIndex = active ? 0 : -1;
    btn.title = name;
    const icon = el('span', 'opt-tab-icon');
    icon.innerHTML = svgIcon(railIcon(tab.iconSlug));
    const label = el('span', 'opt-tab-label');
    label.textContent = name;
    btn.append(icon, label);
    if (hasConflict) {
      const dot = el('span', 'opt-tab-dot');
      dot.setAttribute('role', 'img');
      dot.setAttribute('aria-label', t('hudChrome.options.conflictDot'));
      btn.appendChild(dot);
    }
    if (tab.changedCount > 0) {
      const count = el('span', 'opt-tab-count');
      count.textContent = formatNumber(tab.changedCount, { maximumFractionDigits: 0 });
      count.setAttribute(
        'aria-label',
        t('hudChrome.options.changed', {
          count: formatNumber(tab.changedCount, { maximumFractionDigits: 0 }),
        }),
      );
      btn.appendChild(count);
    }
    btn.addEventListener('click', () => this.setActiveCategory(tab.id));
    return btn;
  }

  private setActiveCategory(id: CategoryId, opts: { preserveRailFocus?: boolean } = {}): void {
    // Arrow-roving the rail (and Ctrl+Tab) plays no click and, per spec section 5,
    // re-renders the DETAIL pane only: the rail node (and thus the focused tab) must
    // survive. A pointer click keeps the full-render path (audio + rebuild).
    if (!opts.preserveRailFocus) audio.click();
    this.activeCategory = id;
    this.subView = 'none';
    this.searchQuery = '';
    this.capturingKey = null;
    this.keybindNote = '';
    // Perf-overlay drag placement is gated to the System category being open.
    this.deps.options()?.perfOverlay.setPlacement(id === 'system');
    if (opts.preserveRailFocus) {
      this.syncRailActive();
      this.syncSearchStrip();
      this.renderDetail();
    } else {
      this.render();
    }
  }

  /** Update the rail tabs' active state IN PLACE (no rebuild), so an arrow-roved or
   *  Ctrl+Tab-switched tab keeps its focus and the trap is never dropped. */
  private syncRailActive(): void {
    for (const tab of this.railEl().querySelectorAll<HTMLElement>('[role="tab"]')) {
      const active = tab.dataset.category === this.activeCategory && this.subView === 'none';
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    }
  }

  /** Re-sync the shell search strip after an in-place category switch: clear the
   *  reset query in the live input and re-evaluate the "This section" scope gate
   *  (meaningless on Overview), without rebuilding the strip (or the rail). */
  private syncSearchStrip(): void {
    const root = this.deps.root();
    const input = root.querySelector<HTMLInputElement>('.search-input');
    if (input) input.value = this.searchQuery;
    const sectionScope = root.querySelector<HTMLButtonElement>('.opt-scope[data-scope="section"]');
    if (sectionScope) sectionScope.disabled = this.activeCategory === 'overview';
  }

  /** The visible rail category ids, in rail order (Overview + the env-visible group
   *  tabs), read from the rendered rail so keyboard + controller cycling match it. */
  private visibleCategoryIds(): CategoryId[] {
    return [...this.railEl().querySelectorAll<HTMLElement>('[role="tab"]')]
      .map((t) => t.dataset.category as CategoryId | undefined)
      .filter((id): id is CategoryId => !!id);
  }

  // -------------------------------------------------------------------------
  // Keyboard navigation (spec section 5). The pure decisions live in
  // options_focus_model; these thin handlers apply them to the live DOM.
  // -------------------------------------------------------------------------

  /** Rail = a vertical roving tablist: Up/Down move focus AND auto-activate,
   *  Home/End jump. Left/Right are left free (in-row value adjust). Ctrl+Tab is
   *  owned by the body handler, so ignore any modified key here. */
  private onRailKeydown(e: KeyboardEvent): void {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const tabs = [...this.railEl().querySelectorAll<HTMLElement>('[role="tab"]')];
    const active = document.activeElement;
    const current = active instanceof HTMLElement ? tabs.indexOf(active) : -1;
    if (current < 0) return;
    const next = rovingTarget(e.key, current, tabs.length, 'vertical');
    if (next === null) return;
    e.preventDefault();
    const tab = tabs[next];
    tab.focus();
    const id = tab.dataset.category as CategoryId | undefined;
    // Auto-activation: aria-selected-follows-focus. The rail node survives (in-place
    // rail sync + detail-only render), so `tab` stays focused across the swap.
    if (id) this.setActiveCategory(id, { preserveRailFocus: true });
  }

  /** Ctrl+Tab / Ctrl+Shift+Tab cycle categories from anywhere in the body. */
  private onBodyKeydown(e: KeyboardEvent): void {
    if (e.key !== 'Tab' || !e.ctrlKey) return;
    e.preventDefault();
    const visible = this.visibleCategoryIds();
    const current = visible.indexOf(this.activeCategory);
    if (current < 0) return;
    const next = wrapIndex(visible.length, current, e.shiftKey ? -1 : 1);
    this.setActiveCategory(visible[next], { preserveRailFocus: true });
    // Land focus on the now-active rail tab so subsequent arrows keep roving.
    this.railEl().querySelector<HTMLElement>('.opt-tab.is-active')?.focus();
  }

  /** In-row value keys: switch Left/Right, segmented Left/Right + Home/End, slider
   *  Page (Left/Right/Home/End on a slider stay native to the range input); a
   *  keybind cap Delete/Backspace unbinds that slot (spec sections 5/6). */
  private onDetailKeydown(e: KeyboardEvent): void {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const kind = this.controlKindOf(target);
    // Keybind cap: Delete/Backspace unbinds. Skipped while a capture is in flight
    // (then the next keydown belongs to the capture callback, not the unbind).
    if (
      kind === 'keybind' &&
      !this.capturingKey &&
      (e.key === 'Delete' || e.key === 'Backspace') &&
      target.dataset.action !== undefined &&
      target.dataset.index !== undefined
    ) {
      e.preventDefault();
      this.clearFocusedKeybind();
      return;
    }
    const intent = rowKeyIntent(kind, e.key);
    if (!intent) return;
    e.preventDefault();
    this.applyAdjustToControl(target, intent);
  }

  /** The authoritative .is-active-row cursor: set on focusin (so it lights for
   *  keyboard, programmatic, AND controller focus, never :focus-visible-derived). */
  private markActiveRow(target: EventTarget | null): void {
    const scope = this.deps.root().querySelector<HTMLElement>('.opt-detail');
    if (!scope) return;
    for (const r of scope.querySelectorAll<HTMLElement>('.is-active-row'))
      r.classList.remove('is-active-row');
    const row = target instanceof HTMLElement ? target.closest<HTMLElement>('.opt-row') : null;
    if (row) row.classList.add('is-active-row');
  }

  /** Classify a focused element into the value-bearing control kind its row presents. */
  private controlKindOf(el: HTMLElement): RowControlKind {
    if (el.classList.contains('opt-slider')) return 'slider';
    if (el.classList.contains('opt-switch')) return 'switch';
    if (el.classList.contains('opt-seg-btn') || el.closest('.opt-seg')) return 'segmented';
    if (el.classList.contains('kb-key')) return 'keybind';
    return 'other';
  }

  /** Apply a value FocusIntent (from a keyboard key OR a controller adjust verb) to
   *  the focused control, reusing its existing dispatch so the write stays
   *  byte-identical. Shared by the keyboard and controller paths. */
  private applyAdjustToControl(el: HTMLElement, intent: FocusIntent): void {
    const kind = this.controlKindOf(el);
    if (kind === 'slider') {
      const slider = el as HTMLInputElement;
      const dir = intent === 'adjustInc' || intent === 'adjustPageInc' ? 1 : -1;
      if (
        intent !== 'adjustDec' &&
        intent !== 'adjustInc' &&
        intent !== 'adjustPageDec' &&
        intent !== 'adjustPageInc'
      )
        return; // Home/End on a slider stay native
      const steps =
        intent === 'adjustPageInc' || intent === 'adjustPageDec' ? SLIDER_PAGE_STEPS : 1;
      const next = sliderStepValue(
        Number(slider.value),
        Number(slider.min),
        Number(slider.max),
        Number(slider.step) || 1,
        dir,
        steps,
      );
      if (next === Number(slider.value)) return;
      slider.value = String(next);
      // Reuse the existing input/change listeners so the commit is byte-identical
      // (a commit-on-change slider needs the change event; a live one needs input).
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      slider.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    if (kind === 'switch') {
      if (intent !== 'adjustDec' && intent !== 'adjustInc') return;
      const on = el.getAttribute('aria-checked') === 'true';
      const want = intent === 'adjustInc'; // Left = off, Right = on
      if (on !== want) el.click(); // reuse the switch's own toggle dispatch
      return;
    }
    if (kind === 'segmented') {
      const seg = el.closest<HTMLElement>('.opt-seg') ?? el;
      const radios = [...seg.querySelectorAll<HTMLElement>('[role="radio"]')];
      if (radios.length === 0) return;
      const current = radios.findIndex((r) => r.getAttribute('aria-checked') === 'true');
      const target = segIndexForIntent(radios.length, current < 0 ? 0 : current, intent);
      if (target === null) return;
      const rowKey = el.closest<HTMLElement>('.opt-row')?.dataset.key;
      const btn = radios[target];
      if (btn.getAttribute('aria-checked') !== 'true') btn.click(); // select (may re-render)
      // Selection-follows-focus: re-resolve the selected radio (the pane may have
      // re-rendered for a preset/interface-mode change) and move focus onto it.
      const selected = rowKey
        ? this.deps
            .root()
            .querySelector<HTMLElement>(
              `.opt-row[data-key="${rowKey}"] [role="radio"][aria-checked="true"]`,
            )
        : null;
      (selected ?? radios[target]).focus();
    }
  }

  // -------------------------------------------------------------------------
  // Controller navigation (spec section 5). The public seam the gamepad wiring
  // dispatches into (a MenuIntentKind is structurally a FocusIntent), routed
  // through the same pure model + DOM helpers as the keyboard path.
  // -------------------------------------------------------------------------

  /** Apply one resolved controller menu verb. Public: the gamepad manager reaches
   *  this through hud.handleMenuGamepadIntent, never navigator.getGamepads. */
  handleMenuIntent(intent: MenuIntentKind): void {
    if (!this.isOpen) return;
    this.applyFocusIntent(intent);
  }

  /** The single dispatch keyboard and controller converge on. */
  private applyFocusIntent(fi: FocusIntent): void {
    switch (fi) {
      case 'categoryPrev':
      case 'categoryNext':
        this.cycleCategory(fi === 'categoryNext' ? 1 : -1);
        return;
      case 'rowPrev':
      case 'rowNext':
        this.stepRowFocus(fi === 'rowNext' ? 1 : -1);
        return;
      case 'adjustDec':
      case 'adjustInc':
      case 'adjustMin':
      case 'adjustMax':
      case 'adjustPageDec':
      case 'adjustPageInc': {
        const el = this.focusedControl();
        if (el) this.applyAdjustToControl(el, fi);
        return;
      }
      case 'activate':
        this.activateFocused();
        return;
      case 'back':
        this.backOrClose();
        return;
      case 'resetRow':
        this.resetFocusedRow();
        return;
      case 'clearKeybind':
        this.clearFocusedKeybind();
        return;
      case 'pageUp':
      case 'pageDown':
        this.pageScrollDetail(fi === 'pageDown' ? 1 : -1);
        return;
      default: {
        // Exhaustiveness guard (task 9 review follow-up): a new FocusIntent that is
        // not routed above fails compilation here rather than silently no-opping.
        const _never: never = fi;
        return _never;
      }
    }
  }

  /** The focused control, only when it is inside the options window. */
  private focusedControl(): HTMLElement | null {
    const active = document.activeElement;
    return active instanceof HTMLElement && this.deps.root().contains(active) ? active : null;
  }

  /** The detail pane's focusable controls in document order (the trap's set, so a
   *  roving radiogroup counts once), for controller row-focus stepping. */
  private detailFocusables(): HTMLElement[] {
    const scope = this.deps.root().querySelector<HTMLElement>('.opt-detail');
    if (!scope) return [];
    return [...scope.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
      (elm) => elm.getClientRects().length > 0,
    );
  }

  /** LB/RB: cycle to the previous/next visible category (from anywhere), then land
   *  focus on the new pane's first row so D-pad Up/Down keeps working. */
  private cycleCategory(dir: -1 | 1): void {
    const visible = this.visibleCategoryIds();
    const current = visible.indexOf(this.activeCategory);
    if (current < 0) return;
    this.setActiveCategory(visible[wrapIndex(visible.length, current, dir)], {
      preserveRailFocus: true,
    });
    this.focusFirstRow();
  }

  /** D-pad Up/Down: move focus one row, clamped at the ends (no wrap). */
  private stepRowFocus(dir: -1 | 1): void {
    const rows = this.detailFocusables();
    if (rows.length === 0) return;
    const active = document.activeElement;
    const current = active instanceof HTMLElement ? rows.indexOf(active) : -1;
    const next = clampIndex(rows.length, current < 0 ? (dir > 0 ? -1 : 0) : current, dir);
    if (next >= 0) rows[next].focus();
  }

  private focusFirstRow(): void {
    this.detailFocusables()[0]?.focus();
  }

  /** A: activate the focused control (reuses its own click handler). */
  private activateFocused(): void {
    this.focusedControl()?.click();
  }

  /** B: pop a pushed sub-view, else close the menu. */
  private backOrClose(): void {
    if (this.subView !== 'none') {
      this.subView = 'none';
      this.renderRail();
      this.renderDetail();
      this.focusFirstRow();
      return;
    }
    this.close();
  }

  /** Y: reset the focused row to its default via the same scoped-reset path. A full
   *  render refreshes the row value AND the rail changed-counts; focus is returned
   *  to the same row so the controller cursor does not vanish. */
  private resetFocusedRow(): void {
    const key = this.focusedControl()?.closest<HTMLElement>('.opt-row')?.dataset.key;
    if (!key) return;
    this.resetKeys([key]);
    this.render();
    const row = this.deps.root().querySelector<HTMLElement>(`.opt-row[data-key="${key}"]`);
    row?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
  }

  /** X: clear the focused keybind cap only (no-op elsewhere); announces the result. */
  private clearFocusedKeybind(): void {
    const cap = this.focusedControl();
    const action = cap?.dataset.action;
    const index = cap?.dataset.index;
    if (!cap || !cap.classList.contains('kb-key') || action === undefined || index === undefined)
      return;
    this.deps.keybinds().clear(action, Number(index));
    this.deps.refreshKeybindLabels();
    this.announce(
      t('hudChrome.options.keybindCleared', { action: this.actionDisplayName(action, action) }),
    );
    // Clearing a slot can leave the action unbound (a new conflict), so refresh the
    // rail dot + the pane banner, not just the detail.
    this.renderRail();
    this.renderDetail();
    // The repaint detached the focused cap; re-home focus onto the rebuilt cap so
    // the controller cursor survives and the next verb keeps working.
    this.deps
      .root()
      .querySelector<HTMLElement>(`.kb-key[data-action="${action}"][data-index="${index}"]`)
      ?.focus();
  }

  /** RT/LT: page-scroll the detail pane (RT = down, LT = up). */
  private pageScrollDetail(dir: -1 | 1): void {
    const scroll = this.deps.root().querySelector<HTMLElement>('.opt-detail');
    if (!scroll) return;
    scroll.scrollTop += dir * scroll.clientHeight * PAGE_SCROLL_FRACTION;
  }

  private announce(message: string): void {
    if (this.announceEl) this.announceEl.textContent = message;
  }

  // -------------------------------------------------------------------------
  // Detail dispatcher
  // -------------------------------------------------------------------------

  private renderDetail(): void {
    const detail = this.detailEl();
    detail.replaceChildren();
    if (this.subView === 'bugreport') {
      this.renderBugReport(detail);
      return;
    }
    const q = this.searchQuery.trim();
    if (q && this.searchScope === 'all') {
      this.renderSearchResults(detail, q);
      return;
    }
    if (this.activeCategory === 'overview') {
      this.renderOverview(detail);
      return;
    }
    if (this.activeCategory === 'system') {
      this.renderSystem(detail);
      return;
    }
    this.renderCategoryDetail(detail);
  }

  private settingsSource(hooks: OptionsHooks): OptionsSettingsSource {
    return {
      num: (key) => hooks.settings.get(key as NumericSettingKey),
      bool: (key) => hooks.settings.get(key as BoolSettingKey),
      range: (key) => SETTING_RANGES[key as NumericSettingKey],
    };
  }

  private isChanged(hooks: OptionsHooks, key: string): boolean {
    const bool = (BOOL_SETTINGS as Record<string, { def: boolean }>)[key];
    if (bool) return hooks.settings.get(key as BoolSettingKey) !== bool.def;
    const r = SETTING_RANGES[key as NumericSettingKey];
    return r ? hooks.settings.get(key as NumericSettingKey) !== r.def : false;
  }

  private categoryHead(parent: HTMLElement, id: CategoryId, nameKey: TranslationKey): void {
    const hooks = this.deps.options();
    const head = el('div', 'opt-cat-head');
    head.textContent = t(nameKey);
    // Scoped "Reset [category]" ghost action, shown once the category diverges.
    const changed = hooks ? categoryChangedCount(id, (key) => this.isChanged(hooks, key)) : 0;
    if (changed > 0 && categorySettingKeys(id).length > 0) {
      const reset = el('button', 'opt-section-reset');
      reset.type = 'button';
      reset.textContent = t('hud.options.resetToDefaults');
      reset.setAttribute('aria-label', t('hud.options.resetToDefaults'));
      reset.addEventListener('click', () => {
        audio.click();
        this.resetKeys(categoryResetKeys(id));
        this.render();
      });
      const bar = el('div', 'opt-section-head');
      bar.append(head, reset);
      parent.appendChild(bar);
    } else {
      parent.appendChild(head);
    }
  }

  private renderCategoryDetail(detail: HTMLElement): void {
    const hooks = this.deps.options();
    const model = renderCategory(this.activeCategory, this.env());
    this.categoryHead(detail, model.id, model.nameKey);
    const sub = el('div', 'opt-cat-sub');
    sub.textContent = t(model.subheadKey);
    detail.appendChild(sub);
    if (hooks) {
      const source = this.settingsSource(hooks);
      const q = this.searchScope === 'section' ? this.searchQuery.trim() : '';
      for (const section of model.sections) {
        const secEl = el('div', 'opt-section');
        const headEl = el('div', 'opt-section-head');
        const title = document.createElement('span');
        title.textContent = t(section.headKey);
        headEl.appendChild(title);
        secEl.appendChild(headEl);
        let shown = 0;
        for (const row of section.rows) {
          // Preset-then-detail: the advanced sub-pickers show only at Advanced (5).
          if (
            this.activeCategory === 'graphics' &&
            row.key &&
            ADVANCED_GFX_KEYS.has(row.key) &&
            Math.round(hooks.settings.get('graphicsPreset')) !== 5
          )
            continue;
          if (q && row.key) {
            const labelText = row.labelKey ? t(row.labelKey) : '';
            if (!rowMatchesQuery(labelText, row.key, q)) continue;
          }
          if (q && !row.key) continue; // hide notes / bespoke rows while filtering
          if (row.control === 'language') {
            this.languageRow(secEl);
            shown++;
            continue;
          }
          if (row.control === 'themePreset') {
            this.themeRow(secEl);
            shown++;
            continue;
          }
          const control = buildControlFromRow(source, row);
          if (!control) continue;
          if (control.control === 'choice' && row.key === 'graphicsPreset' && isNativeAppShell())
            control.options = control.options.filter((o) => o.value <= 3);
          this.applyControls(secEl, [control], hooks, () => this.render());
          shown++;
        }
        // Bespoke section resets (chat window, unit frame positions).
        if (this.appendSectionAction(secEl, section.id)) shown++;
        if (shown > 0) detail.appendChild(secEl);
      }
    }
    if (this.activeCategory === 'keybinds') this.renderKeybindTable(detail);
    if (this.activeCategory === 'controller') this.renderControllerButtons(detail);
    if (this.activeCategory === 'graphics') this.renderGraphicsReload(detail);
  }

  // -------------------------------------------------------------------------
  // Row primitives (the .opt-* grammar; dispatch is byte-identical)
  // -------------------------------------------------------------------------

  private sliderFormatter(fmt: SliderFmt): (v: number) => string {
    if (fmt === 'degrees')
      return (v) => `${formatNumber(Math.round(v), { maximumFractionDigits: 0 })}°`;
    if (fmt === 'oneDecimal') return (v) => formatNumber(v, { maximumFractionDigits: 1 });
    return (v) => formatNumber(v, { style: 'percent', maximumFractionDigits: 0 });
  }

  private applyControls(
    parent: HTMLElement,
    controls: OptionsControl[],
    hooks: OptionsHooks,
    rerender: () => void,
  ): void {
    for (const c of controls) {
      switch (c.control) {
        case 'slider':
          this.settingSlider(parent, c, hooks);
          break;
        case 'toggle':
          this.settingToggle(parent, c, hooks);
          break;
        case 'boolToggle':
          this.settingBoolToggle(parent, c, hooks);
          break;
        case 'choice':
          this.settingChoice(parent, c, hooks, c.rerender ? rerender : undefined);
          break;
        case 'note':
          this.noteRow(parent, c.textKey);
          break;
        case 'musicToggle':
          this.musicToggle(parent, c.labelKey);
          break;
      }
    }
  }

  private optRow(label: string): { row: HTMLElement; control: HTMLElement } {
    const row = el('div', 'opt-row');
    const name = el('span', 'opt-row-label');
    name.textContent = label;
    name.title = label;
    const control = el('div', 'opt-row-control');
    row.append(name, control);
    return { row, control };
  }

  private settingSlider(parent: HTMLElement, c: SliderControl, hooks: OptionsHooks): void {
    const key = c.key as NumericSettingKey;
    const label = t(c.labelKey);
    const { row, control } = this.optRow(label);
    row.dataset.key = c.key;
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'opt-slider';
    slider.min = String(c.min);
    slider.max = String(c.max);
    slider.step = String(c.step);
    slider.value = String(hooks.settings.get(key));
    slider.setAttribute('aria-label', label);
    const val = el('span', 'opt-slider-val');
    const fmt = this.sliderFormatter(c.fmt);
    const applyReadout = (text: string) => {
      val.textContent = text;
      slider.setAttribute('aria-valuetext', text);
    };
    const syncReadout = () => applyReadout(fmt(hooks.settings.get(key)));
    const readoutFromSlider = () => applyReadout(fmt(Number(slider.value)));
    syncReadout();
    const paintFill = () => {
      const min = Number(slider.min),
        max = Number(slider.max),
        v = Number(slider.value);
      const pct = max > min ? ((v - min) / (max - min)) * RANGE_FILL_FULL_PCT : 0;
      slider.style.setProperty(
        '--range-fill',
        `${Math.max(0, Math.min(RANGE_FILL_FULL_PCT, pct))}%`,
      );
    };
    paintFill();
    const commit = () => {
      hooks.onSettingChange(key, sliderDispatchValue(slider.value));
      syncReadout();
      paintFill();
    };
    if (c.commitOnChange) {
      slider.addEventListener('input', () => {
        readoutFromSlider();
        paintFill();
      });
      slider.addEventListener('change', commit);
    } else {
      slider.addEventListener('input', commit);
    }
    control.append(slider, val);
    parent.appendChild(row);
  }

  private settingToggle(parent: HTMLElement, c: ToggleControl, hooks: OptionsHooks): void {
    const key = c.key as NumericSettingKey;
    const label = t(c.labelKey);
    const { row, control } = this.optRow(label);
    row.dataset.key = c.key;
    const toggle = el('button', 'opt-switch');
    toggle.type = 'button';
    toggle.setAttribute('role', 'switch');
    const sync = () => {
      const on = toggleIsOn(hooks.settings.get(key));
      toggle.setAttribute('aria-checked', String(on));
      toggle.setAttribute('aria-label', label);
    };
    sync();
    toggle.addEventListener('click', () => {
      audio.click();
      hooks.onSettingChange(key, toggleNextValue(hooks.settings.get(key)));
      sync();
    });
    control.appendChild(toggle);
    parent.appendChild(row);
  }

  private settingBoolToggle(parent: HTMLElement, c: BoolToggleControl, hooks: OptionsHooks): void {
    const key = c.key as BoolSettingKey;
    const label = t(c.labelKey);
    const { row, control } = this.optRow(label);
    row.dataset.key = c.key;
    const toggle = el('button', 'opt-switch');
    toggle.type = 'button';
    toggle.setAttribute('role', 'switch');
    const sync = () => {
      const on = hooks.settings.get(key);
      toggle.setAttribute('aria-checked', String(on));
      toggle.setAttribute('aria-label', label);
    };
    sync();
    toggle.addEventListener('click', () => {
      audio.click();
      hooks.onSettingChange(
        key,
        hooks.settings.set(key, boolToggleNextValue(hooks.settings.get(key))),
      );
      sync();
    });
    control.appendChild(toggle);
    parent.appendChild(row);
  }

  private settingChoice(
    parent: HTMLElement,
    c: ChoiceControl,
    hooks: OptionsHooks,
    onChange?: () => void,
  ): void {
    const key = c.key as NumericSettingKey;
    const label = t(c.labelKey);
    const { row, control } = this.optRow(label);
    row.dataset.key = c.key;
    const seg = el('div', 'opt-seg');
    seg.setAttribute('role', 'radiogroup');
    seg.setAttribute('aria-label', label);
    const sync = () => {
      const current = Math.round(hooks.settings.get(key));
      for (const btn of seg.querySelectorAll<HTMLButtonElement>('button[data-value]')) {
        const selected = Number(btn.dataset.value) === current;
        btn.classList.toggle('is-selected', selected);
        btn.setAttribute('aria-checked', String(selected));
        // Roving tabindex: the selected radio is the group's single Tab stop
        // (selection-follows-focus), so the radiogroup is one stop, not one per option.
        btn.tabIndex = selected ? 0 : -1;
      }
    };
    for (const option of c.options) {
      const optionLabel = t(option.labelKey);
      const btn = el('button', 'opt-seg-btn');
      btn.type = 'button';
      btn.setAttribute('role', 'radio');
      btn.dataset.value = String(option.value);
      btn.textContent = optionLabel;
      btn.setAttribute('aria-label', optionLabel);
      btn.addEventListener('click', () => {
        audio.click();
        if (RELOAD_KEYS.has(c.key)) this.reloadPending = true;
        hooks.onSettingChange(key, option.value);
        sync();
        onChange?.();
      });
      seg.appendChild(btn);
    }
    control.appendChild(seg);
    parent.appendChild(row);
    sync();
  }

  private noteRow(parent: HTMLElement, textKey: TranslationKey): void {
    const note = el('div', 'opt-note');
    note.textContent = t(textKey);
    parent.appendChild(note);
  }

  private musicToggle(parent: HTMLElement, labelKey: TranslationKey): void {
    const label = t(labelKey);
    const { row, control } = this.optRow(label);
    const toggle = el('button', 'opt-switch');
    toggle.type = 'button';
    toggle.setAttribute('role', 'switch');
    const sync = () => {
      toggle.setAttribute('aria-checked', String(music.enabled));
      toggle.setAttribute('aria-label', label);
    };
    sync();
    toggle.addEventListener('click', () => {
      audio.click();
      music.setEnabled(!music.enabled);
      sync();
    });
    control.appendChild(toggle);
    parent.appendChild(row);
  }

  /** A bespoke "Reset [scope]" section action row (chat window, frame positions).
   *  Returns true when it appended a row (so the section is not treated empty). */
  private appendSectionAction(parent: HTMLElement, sectionId: string): boolean {
    if (this.searchQuery.trim()) return false; // hide bespoke actions while filtering
    if (this.activeCategory === 'interface' && sectionId === 'chat') {
      this.resetActionRow(parent, 'hudChrome.chatWindow.reset', () => this.deps.resetChatWindow());
      return true;
    }
    if (this.activeCategory === 'interface' && sectionId === 'unitFrames') {
      this.resetActionRow(parent, 'hudChrome.frameReset.label', () => this.deps.resetUnitFrames());
      return true;
    }
    return false;
  }

  private resetActionRow(parent: HTMLElement, labelKey: TranslationKey, onReset: () => void): void {
    const label = t(labelKey);
    const { row, control } = this.optRow(label);
    const btn = el('button', 'btn');
    btn.type = 'button';
    btn.textContent = t('hudChrome.chatWindow.resetAction');
    btn.addEventListener('click', () => {
      audio.click();
      onReset();
    });
    control.appendChild(btn);
    parent.appendChild(row);
  }

  /** Reset a set of settings keys to their defaults and re-apply to subsystems. */
  private resetKeys(keys: string[]): void {
    const hooks = this.deps.options();
    if (!hooks) return;
    for (const key of keys) {
      const bool = (BOOL_SETTINGS as Record<string, { def: boolean }>)[key];
      if (bool) {
        hooks.settings.set(key as BoolSettingKey, bool.def);
        hooks.onSettingChange(key as keyof GameSettings, bool.def);
      } else {
        const r = SETTING_RANGES[key as NumericSettingKey];
        if (!r) continue;
        hooks.settings.set(key as NumericSettingKey, r.def);
        hooks.onSettingChange(key as keyof GameSettings, r.def);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Interface: language + theme (bespoke, ported intact)
  // -------------------------------------------------------------------------

  private languageRow(parent: HTMLElement): void {
    const hooks = this.deps.options();
    if (!hooks) return;
    const { row, control } = this.optRow(t('hud.options.language'));
    const options = supportedLanguages.map((lang) => ({
      value: lang,
      label: LANGUAGE_ENDONYMS[lang],
    }));
    const status = document.createElement('span');
    status.className = 'visually-hidden';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    let busy = false;
    const dropdown = this.deps.buildDropdown(
      options,
      getLanguage(),
      (selected) => {
        if (busy || !isSupportedLanguage(selected) || selected === getLanguage()) return;
        audio.click();
        busy = true;
        void hooks
          .changeLanguage(selected, (msg) => {
            status.textContent = msg;
          })
          .then((ok) => {
            if (ok) {
              if (this.isOpen && this.activeCategory === 'interface' && this.subView === 'none') {
                this.renderDetail();
                this.deps.focusFirstInteractive(this.deps.root(), '.set-lang-select .ui-dd-btn');
              }
            } else {
              this.deps.setDropdownValue(dropdown, getLanguage());
            }
          })
          .catch(() => {
            status.textContent = t('settings.languageLoadFailed');
            this.deps.setDropdownValue(dropdown, getLanguage());
          })
          .finally(() => {
            busy = false;
          });
      },
      undefined,
      { ariaLabel: t('hud.options.language') },
    );
    dropdown.classList.add('set-lang-select');
    control.appendChild(dropdown);
    parent.append(row, status);
  }

  private themeRow(parent: HTMLElement): void {
    const hooks = this.deps.options();
    if (!hooks) return;
    const theme = hooks.theme;
    const { row, control } = this.optRow(t('hudChrome.theme.preset'));
    const seg = el('div', 'set-seg theme-presets');
    const presetLabel = (id: PresetId): string =>
      t(`hudChrome.theme.presets.${id}` as TranslationKey);
    for (const id of PRESET_ORDER) {
      const btn = el('button', 'btn set-seg-btn');
      btn.type = 'button';
      btn.textContent = presetLabel(id);
      btn.classList.toggle('active', theme.get().preset === id);
      btn.addEventListener('click', () => {
        audio.click();
        theme.setPreset(id);
        this.renderDetail();
      });
      seg.appendChild(btn);
    }
    control.appendChild(seg);
    parent.appendChild(row);

    // Custom palette: one colour input per knob, seeded with the effective value.
    const effective = resolveTheme(theme.get());
    const customCount = Object.keys(theme.get().custom).length;
    const customRow = el('div', 'set-row theme-custom-head');
    const customName = el('span', 'set-name');
    customName.textContent = t('hudChrome.theme.customColors');
    const reset = el('button', 'btn set-toggle');
    reset.type = 'button';
    reset.textContent = t('hudChrome.theme.reset');
    reset.disabled = customCount === 0;
    reset.addEventListener('click', () => {
      audio.click();
      theme.resetCustom();
      this.renderDetail();
    });
    customRow.append(customName, reset);
    parent.appendChild(customRow);

    const grid = el('div', 'theme-color-grid');
    for (const knob of THEME_KNOB_ORDER) {
      const knobRow = el('label', 'theme-color-row');
      const swatchLabel = document.createElement('span');
      swatchLabel.textContent = t(
        `hudChrome.theme.knob.${THEME_KNOB_LABEL_KEY[knob]}` as TranslationKey,
      );
      const input = document.createElement('input');
      input.type = 'color';
      input.value = effective[knob];
      input.setAttribute('aria-label', swatchLabel.textContent);
      input.addEventListener('input', () => theme.setCustom(knob, input.value));
      input.addEventListener('change', () => {
        theme.setCustom(knob, input.value);
        reset.disabled = false;
      });
      knobRow.append(input, swatchLabel);
      grid.appendChild(knobRow);
    }
    parent.appendChild(grid);
  }

  private renderGraphicsReload(parent: HTMLElement): void {
    const note = el('div', 'opt-note');
    note.textContent = t('hud.options.graphicsReloadNote');
    parent.appendChild(note);
    const reload = el('button', 'btn');
    reload.type = 'button';
    reload.textContent = t('hud.options.reloadNow');
    reload.addEventListener('click', () => {
      audio.click();
      location.reload();
    });
    parent.appendChild(reload);
  }

  // -------------------------------------------------------------------------
  // Overview landing
  // -------------------------------------------------------------------------

  private renderOverview(detail: HTMLElement): void {
    const head = el('div', 'opt-cat-head');
    head.textContent = t('hudChrome.options.ia.catOverviewName');
    const sub = el('div', 'opt-cat-sub');
    sub.textContent = t('hudChrome.options.ia.catOverviewSub');
    detail.append(head, sub);

    // Quick actions (mirror the footer).
    const quick = el('div', 'opt-quick');
    for (const action of OVERVIEW_QUICK_ACTIONS) {
      if (!this.quickActionAvailable(action.id)) continue;
      const cls =
        action.id === 'resume'
          ? 'btn is-primary'
          : action.id === 'logout' || action.id === 'resetAll'
            ? 'btn is-danger'
            : 'btn';
      const btn = el('button', cls);
      btn.type = 'button';
      btn.textContent = t(action.labelKey);
      btn.addEventListener('click', () => this.runQuickAction(action.id));
      quick.appendChild(btn);
    }
    detail.appendChild(quick);

    // Reload-pending alert (a graphics change that needs a reload was made).
    if (this.reloadPending) {
      const alert = el('div', 'opt-alert');
      const text = document.createElement('span');
      text.textContent = t('hud.options.graphicsReloadNote');
      const reload = el('button', 'btn');
      reload.type = 'button';
      reload.textContent = t('hud.options.reloadNow');
      reload.addEventListener('click', () => {
        audio.click();
        location.reload();
      });
      alert.append(text, reload);
      detail.appendChild(alert);
    }

    // Keybind-conflict alert (spec section 3): a persistent .error-banner linking to
    // Keybinds when any keyboard binding conflicts or is fully unbound, shown only
    // where the Keybinds category is reachable (it hides on touch).
    if (this.computeConflicts().keyboardWarning && !this.env().touch) {
      const alert = el('div', 'error-banner');
      const text = document.createElement('span');
      text.textContent = t('hudChrome.options.overviewConflictAlert');
      const goto = el('button', 'btn');
      goto.type = 'button';
      const keybindsName = t(
        CATEGORIES.find((c) => c.id === 'keybinds')?.nameKey ?? ('' as TranslationKey),
      );
      goto.textContent = t('hudChrome.options.searchGoTo', { category: keybindsName });
      goto.addEventListener('click', () => this.setActiveCategory('keybinds'));
      alert.append(text, goto);
      detail.appendChild(alert);
    }

    // Pinned essentials: mirror rows writing their HOME key (no second home).
    const hooks = this.deps.options();
    const source = hooks ? this.settingsSource(hooks) : null;
    const pinsSection = el('div', 'opt-section');
    const pinsHead = el('div', 'opt-section-head');
    const pinsTitle = document.createElement('span');
    pinsTitle.textContent = t('hudChrome.options.ia.catOverviewName');
    pinsHead.appendChild(pinsTitle);
    pinsSection.appendChild(pinsHead);
    for (const pin of OVERVIEW_PINS) {
      if (pin.nonSettingsHome === 'language') {
        this.languageRow(pinsSection);
      } else if (pin.nonSettingsHome === 'themePreset') {
        this.themeRow(pinsSection);
      } else if (pin.key && hooks && source) {
        const homeRow = settingRow(pin.key);
        if (!homeRow) continue;
        const control = buildControlFromRow(source, homeRow);
        if (control) this.applyControls(pinsSection, [control], hooks, () => this.render());
      }
      const crumb = el('div', 'opt-pin-home');
      const home = CATEGORIES.find((c) => c.id === pin.homeCategory);
      if (home) crumb.textContent = t(home.nameKey);
      pinsSection.appendChild(crumb);
    }
    detail.appendChild(pinsSection);

    // Status block: version, online/offline, total changed-from-defaults.
    const status = el('div', 'opt-status');
    const { version, build } = appVersionInfo();
    const ver = document.createElement('span');
    ver.textContent = t('hudChrome.options.version', { version, build });
    const mode = document.createElement('span');
    mode.textContent = this.online()
      ? t('hudChrome.options.modeOnline')
      : t('hudChrome.options.modeOffline');
    const changed = document.createElement('span');
    const n = hooks ? totalChangedCount((key) => this.isChanged(hooks, key)) : 0;
    changed.textContent = t('hudChrome.options.changedSummary', {
      count: formatNumber(n, { maximumFractionDigits: 0 }),
    });
    status.append(ver, mode, changed);
    detail.appendChild(status);
  }

  private quickActionAvailable(id: QuickActionId): boolean {
    if (id === 'reportBug') return this.deps.bugReport() !== null;
    // Logout stays reachable in both modes: offline logout reloads to the title
    // screen (a meaningful action), so today's unconditional reachability is kept.
    return true;
  }

  private runQuickAction(id: QuickActionId): void {
    audio.click();
    if (id === 'resume') {
      this.close();
    } else if (id === 'reportBug') {
      this.activeCategory = 'system';
      this.subView = 'bugreport';
      this.render();
    } else if (id === 'logout') {
      this.deps.options()?.logout();
    } else {
      this.confirmResetAll();
    }
  }

  // -------------------------------------------------------------------------
  // System: perf overlay (delegated) + support (bug report) + about
  // -------------------------------------------------------------------------

  private renderSystem(detail: HTMLElement): void {
    this.categoryHead(detail, 'system', 'hudChrome.options.ia.catSystemName');
    const sub = el('div', 'opt-cat-sub');
    sub.textContent = t('hudChrome.options.ia.catSystemSub');
    detail.appendChild(sub);

    // Performance: the delegated overlay config panel (its master toggle is
    // showFps). Placement drag stays gated to this category being open.
    const hooks = this.deps.options();
    if (hooks) {
      const perfHost = el('div', 'opt-perf-host');
      detail.appendChild(perfHost);
      this.perfSettings ??= new PerfOverlaySettingsPanel(this.perfSettingsHost(hooks));
      this.perfSettings.render(perfHost);
    }

    // Support: Report a Bug (online) pushes the bug-report sub-view.
    if (this.deps.bugReport() !== null) {
      const support = el('div', 'opt-section');
      const supportHead = el('div', 'opt-section-head');
      const supportTitle = document.createElement('span');
      supportTitle.textContent = t('hudChrome.options.sec.support');
      supportHead.appendChild(supportTitle);
      support.appendChild(supportHead);
      const { row, control } = this.optRow(t('hudChrome.bugReport.menuButton'));
      const btn = el('button', 'btn');
      btn.type = 'button';
      btn.textContent = t('hudChrome.bugReport.menuButton');
      btn.addEventListener('click', () => {
        audio.click();
        this.subView = 'bugreport';
        this.renderRail();
        this.renderDetail();
      });
      control.appendChild(btn);
      support.appendChild(row);
      detail.appendChild(support);
    }

    // About: the running build.
    const about = el('div', 'opt-section');
    const aboutHead = el('div', 'opt-section-head');
    const aboutTitle = document.createElement('span');
    aboutTitle.textContent = t('hudChrome.options.sec.about');
    aboutHead.appendChild(aboutTitle);
    about.appendChild(aboutHead);
    const { version, build } = appVersionInfo();
    const ver = el('div', 'opt-version');
    ver.textContent = t('hudChrome.options.version', { version, build });
    about.appendChild(ver);
    detail.appendChild(about);
  }

  private perfSettingsHost(hooks: OptionsHooks): PerfSettingsHost {
    return {
      perf: hooks.perfOverlay,
      getShowFps: () => hooks.settings.get('showFps'),
      setShowFps: (on) => hooks.onSettingChange('showFps', on),
      click: () => audio.click(),
      onClose: () => this.close(),
      onBack: () => this.setActiveCategory('overview'),
      closeIconHtml: svgIcon('close'),
      backIconHtml: svgIcon('prev'),
    };
  }

  // -------------------------------------------------------------------------
  // Footer
  // -------------------------------------------------------------------------

  private renderFooter(footer: HTMLElement): void {
    footer.replaceChildren();
    // Controller button-legend strip: rendered only while a pad is connected
    // (spec section 5), full-width above the footer actions.
    const legend = this.buildLegend();
    if (legend) footer.appendChild(legend);
    const resetAll = el('button', 'btn is-danger');
    resetAll.type = 'button';
    resetAll.textContent = t('hud.options.resetToDefaults');
    resetAll.addEventListener('click', () => {
      audio.click();
      this.confirmResetAll();
    });
    footer.appendChild(resetAll);

    const right = el('div', 'opt-footer-actions');
    if (this.deps.bugReport() !== null) {
      const bug = el('button', 'btn-ghost btn');
      bug.type = 'button';
      bug.textContent = t('hudChrome.bugReport.menuButton');
      bug.addEventListener('click', () => {
        audio.click();
        this.activeCategory = 'system';
        this.subView = 'bugreport';
        this.render();
      });
      right.appendChild(bug);
    }
    // Log out stays reachable offline (it reloads to the title screen).
    const logout = el('button', 'btn is-danger');
    logout.type = 'button';
    logout.textContent = t('hud.options.logout');
    logout.addEventListener('click', () => {
      audio.click();
      this.deps.options()?.logout();
    });
    right.appendChild(logout);

    const done = el('button', 'btn is-primary');
    done.type = 'button';
    done.textContent = t('hudChrome.options.done');
    done.addEventListener('click', () => this.close());
    right.appendChild(done);
    footer.appendChild(right);
  }

  /** The controller button-legend strip (spec section 5), or null when no pad is
   *  connected. Live glyphs come from the detected brand; the meanings are t() keys. */
  private buildLegend(): HTMLElement | null {
    const hooks = this.deps.options();
    if (!hooks || !hooks.gamepad.connected()) return null;
    const kind = hooks.gamepad.kind();
    const glyph = (b: number): string => gamepadButtonLabel(b, kind);
    const items: { glyph: string; meaningKey: TranslationKey }[] = [
      {
        glyph: `${glyph(GP.LB)} / ${glyph(GP.RB)}`,
        meaningKey: 'hudChrome.options.legend.category',
      },
      { glyph: DPAD_GLYPH, meaningKey: 'hudChrome.options.legend.navigate' },
      { glyph: glyph(GP.A), meaningKey: 'hudChrome.options.legend.select' },
      { glyph: glyph(GP.B), meaningKey: 'hudChrome.options.legend.back' },
      { glyph: glyph(GP.Y), meaningKey: 'hudChrome.options.legend.reset' },
      { glyph: glyph(GP.X), meaningKey: 'hudChrome.options.legend.clear' },
      { glyph: `${glyph(GP.LT)} / ${glyph(GP.RT)}`, meaningKey: 'hudChrome.options.legend.page' },
    ];
    const legend = el('div', 'opt-legend');
    legend.setAttribute('aria-label', t('hudChrome.controller.title'));
    for (const item of items) {
      const cell = el('span', 'opt-legend-item');
      const g = el('span', 'opt-legend-glyph');
      g.textContent = item.glyph;
      const meaning = document.createElement('span');
      meaning.textContent = t(item.meaningKey);
      cell.append(g, meaning);
      legend.appendChild(cell);
    }
    return legend;
  }

  private confirmResetAll(): void {
    const doReset = () => {
      this.deps.options()?.settings.reset();
      const all = this.deps.options()?.settings.all();
      if (all)
        for (const k of Object.keys(all) as (keyof GameSettings)[])
          this.deps.options()?.onSettingChange(k, all[k]);
      this.render();
    };
    if (this.deps.confirmDialog) {
      this.deps.confirmDialog(
        t('hudChrome.options.resetAllTitle'),
        t('hudChrome.options.resetAllBody'),
        t('hud.options.resetToDefaults'),
        t('game.talents.cancel'),
        doReset,
      );
    } else {
      doReset();
    }
  }

  // -------------------------------------------------------------------------
  // Search results (basic all-scope view: grouped rows + breadcrumb + go-to)
  // -------------------------------------------------------------------------

  private renderSearchResults(detail: HTMLElement, query: string): void {
    const hooks = this.deps.options();
    const head = el('div', 'opt-cat-head');
    head.textContent = t('hudChrome.options.searchScopeAll');
    detail.appendChild(head);
    if (!hooks) return;
    const source = this.settingsSource(hooks);
    const env = this.env();
    const matches = buildSearchIndex().filter((r) =>
      rowMatchesQuery(t(r.labelKey), r.settingKey, query),
    );
    // Group matches by home category, honoring env gating (hidden rows never surface).
    let total = 0;
    const shownCats = new Set<CategoryId>();
    for (const cat of CATEGORIES) {
      const catMatches = matches.filter((m) => m.categoryId === cat.id);
      if (catMatches.length === 0) continue;
      const model = renderCategory(cat.id, env);
      const visibleKeys = new Set(
        model.sections.flatMap((s) => s.rows.map((r) => r.key).filter(Boolean)),
      );
      const rows = catMatches.filter((m) => visibleKeys.has(m.settingKey));
      if (rows.length === 0) continue;
      total += rows.length;
      shownCats.add(cat.id);
      const group = el('div', 'opt-result-group');
      const crumb = el('div', 'opt-result-crumb');
      const name = document.createElement('span');
      name.textContent = t(cat.nameKey);
      const goto = el('button', 'opt-goto');
      goto.type = 'button';
      goto.textContent = t('hudChrome.options.searchGoTo', { category: t(cat.nameKey) });
      // Go to section: jump to the home category and land a STEADY .is-active-row
      // highlight on the target row (no flash animation), driven through the shared
      // focus path so the cursor is identical to a keyboard/controller landing.
      const landKey = rows[0].settingKey;
      goto.addEventListener('click', () => {
        this.setActiveCategory(cat.id);
        this.highlightRow(landKey);
      });
      crumb.append(name, goto);
      group.appendChild(crumb);
      for (const m of rows) {
        const row = settingRow(m.settingKey);
        if (!row) continue;
        const control = buildControlFromRow(source, row);
        if (control) this.applyControls(group, [control], hooks, () => this.render());
      }
      detail.appendChild(group);
    }
    // Category-level synonym hits (P4): terms like "bind"/"hotkey"/"shortcut" surface
    // the bespoke Keybinds category, which has no settings-key rows to index. Skip a
    // category already shown above or hidden by the environment.
    for (const catId of categoriesForSearch(query)) {
      if (shownCats.has(catId)) continue;
      const cat = CATEGORIES.find((c) => c.id === catId);
      if (!cat || !this.categoryVisible(cat)) continue;
      total++;
      const group = el('div', 'opt-result-group');
      const crumb = el('div', 'opt-result-crumb');
      const name = document.createElement('span');
      name.textContent = t(cat.nameKey);
      const goto = el('button', 'opt-goto');
      goto.type = 'button';
      goto.textContent = t('hudChrome.options.searchGoTo', { category: t(cat.nameKey) });
      goto.addEventListener('click', () => this.setActiveCategory(cat.id));
      crumb.append(name, goto);
      const sub = el('div', 'opt-result-sub');
      sub.textContent = t(cat.subheadKey);
      group.append(crumb, sub);
      detail.appendChild(group);
    }
    if (total === 0) {
      const empty = el('div', 'opt-empty');
      empty.textContent = t('hudChrome.options.searchEmpty');
      detail.appendChild(empty);
    }
  }

  /** True when a category is revealed under the current host environment (touch-only
   *  hides on desktop; desktop-only hides on touch). Mirrors options_view gating. */
  private categoryVisible(cat: { env?: { touchOnly?: boolean; desktopOnly?: boolean } }): boolean {
    const e = this.env();
    if (cat.env?.touchOnly && !e.touch) return false;
    if (cat.env?.desktopOnly && e.touch) return false;
    return true;
  }

  /** Land a steady .is-active-row highlight on a target row (search go-to): focus its
   *  control, which fires the detail focusin cursor (the same steady inset the keyboard
   *  and controller cursors use), then scroll it into view. No flash animation. */
  private highlightRow(key: string): void {
    const row = this.deps.root().querySelector<HTMLElement>(`.opt-row[data-key="${key}"]`);
    if (!row) return;
    (row.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ?? row).focus();
    row.scrollIntoView?.({ block: 'nearest' });
  }

  // -------------------------------------------------------------------------
  // Keybinds (bind table + reset; the rebind UX is unchanged, P4 owns polish)
  // -------------------------------------------------------------------------

  private actionDisplayName(actionId: string, fallback: string): string {
    if (!actionId.startsWith('slot'))
      return BIND_ACTION_LABEL_KEYS[actionId] ? t(BIND_ACTION_LABEL_KEYS[actionId]) : fallback;
    const slot = Number(actionId.slice(4));
    if (slot === 0) return t('hud.keybinds.actions.attack');
    return (
      this.deps.slotActionName(slot) ?? t('hud.keybinds.actions.actionBarSlot', { slot: slot + 1 })
    );
  }

  /** The VISIBLE keyboard bind rows adapted for keybind_conflicts (the pure core
   *  wants only shown rows: Attack Move is omitted while its setting is off). */
  private keyboardConflictRows(): KeyboardBindRow[] {
    const attackMoveOn = !!this.deps.options()?.settings.get('attackMove');
    const kb = this.deps.keybinds();
    return BIND_ACTIONS.filter((a) => a.id !== 'attackMove' || attackMoveOn).map((a) => ({
      id: a.id,
      category: a.category,
      codes: [kb.codeAt(a.id, 0), kb.codeAt(a.id, 1)],
      allowShared: a.allowShared,
    }));
  }

  /** The controller bind rows adapted for keybind_conflicts (per-button action +
   *  its resolved brand glyph), or [] when the pad map is empty. */
  private controllerConflictRows(): ControllerBindRow[] {
    const hooks = this.deps.options();
    if (!hooks) return [];
    const kind = hooks.gamepad.kind();
    return hooks.gamepad.entries().map((e) => ({
      button: e.button,
      action: e.action,
      label: gamepadButtonLabel(e.button, kind),
    }));
  }

  /** The aggregate conflict state (rail dots, Overview alert, unbound banner,
   *  controller-duplicate chips) computed from the two live tables. */
  private computeConflicts(): KeybindConflicts {
    return computeKeybindConflicts(this.keyboardConflictRows(), this.controllerConflictRows());
  }

  private renderKeybindTable(parent: HTMLElement): void {
    const hooks = this.deps.options();
    // Persistent unbound banner (spec section 6): list every keyboard action left
    // with no key, fed by the same keybind_conflicts aggregate the rail dot reads.
    const conflicts = this.computeConflicts();
    if (conflicts.unbound.length > 0) {
      const banner = el('div', 'error-banner');
      const text = document.createElement('span');
      text.textContent = conflicts.unbound
        .map((id) =>
          t('hudChrome.options.keybindUnbound', { action: this.actionDisplayName(id, id) }),
        )
        .join('; ');
      banner.appendChild(text);
      parent.appendChild(banner);
    }
    const note = el('div', 'kb-note');
    note.textContent = this.keybindNote || t('hud.options.keybindHelpMouseCamera');
    parent.appendChild(note);
    const cols = el('div', 'kb-cols');
    const attackMoveOn = !!hooks?.settings.get('attackMove');
    for (const category of BIND_CATEGORIES) {
      const visible = BIND_ACTIONS.filter(
        (a) => a.category === category && (a.id !== 'attackMove' || attackMoveOn),
      );
      if (visible.length === 0) continue;
      const col = el('div', 'kb-col');
      const header = el('div', 'kb-cat');
      header.textContent = BIND_CATEGORY_LABEL_KEYS[category]
        ? t(BIND_CATEGORY_LABEL_KEYS[category])
        : category;
      col.appendChild(header);
      const rows = el('div', 'kb-rows');
      for (const action of visible) {
        const row = el('div', 'kb-row');
        row.dataset.action = action.id;
        const name = el('span', 'kb-name');
        const label = el('span', 'kb-label');
        label.textContent = this.actionDisplayName(action.id, action.label);
        const hint = el('span', 'kb-inline-key');
        const primary = this.deps.keybinds().labelAt(action.id, 0);
        hint.textContent = primary ? `(${primary})` : '';
        name.append(label, hint);
        // Transient eviction badge on a just-displaced row (spec section 6), painted
        // in the SAME render as the steal; cleared on the next rebind interaction.
        if (this.evictedRows.includes(action.id)) {
          const badge = el('span', 'ui-badge badge-warning kb-evicted');
          badge.textContent = t('hudChrome.options.keybindTaken');
          name.appendChild(badge);
        }
        row.appendChild(name);
        for (let index = 0; index < 2; index++) {
          const capturing =
            this.capturingKey?.action === action.id && this.capturingKey?.index === index;
          const key = el('button', `btn kb-key${capturing ? ' capturing' : ''}`);
          key.type = 'button';
          // Identify the slot for the controller X = clear verb (spec section 5) and
          // the keyboard Delete/Backspace unbind (spec section 6).
          key.dataset.action = action.id;
          key.dataset.index = String(index);
          key.textContent = capturing
            ? '...'
            : this.deps.keybinds().labelAt(action.id, index) || t('hud.options.unbound');
          key.title = index === 0 ? t('hud.options.primary') : t('hud.options.alternate');
          key.setAttribute(
            'aria-label',
            `${this.actionDisplayName(action.id, action.label)} ${key.title}`,
          );
          key.addEventListener('click', () => this.beginCapture(action.id, index, action.label));
          // Blur exit (spec section 6): losing focus while capturing cancels, so the
          // capture can never trap (a click/tap away, an alt-tab, all release it).
          if (capturing) key.addEventListener('blur', () => this.cancelCapture());
          row.appendChild(key);
          // On-screen Cancel affordance (spec section 6): a visible exit for pointer /
          // touch users, who have no physical Escape.
          if (capturing) {
            const cancel = el('button', 'btn kb-cancel');
            cancel.type = 'button';
            cancel.textContent = t('game.talents.cancel');
            cancel.setAttribute('aria-label', t('game.talents.cancel'));
            cancel.addEventListener('click', () => this.cancelCapture());
            row.appendChild(cancel);
          }
        }
        rows.appendChild(row);
      }
      col.appendChild(rows);
      cols.appendChild(col);
    }
    parent.appendChild(cols);
    const reset = el('button', 'btn');
    reset.type = 'button';
    reset.textContent = t('hud.options.resetToDefaults');
    reset.addEventListener('click', () => {
      audio.click();
      this.deps.keybinds().reset();
      this.capturingKey = null;
      this.evictedRows = [];
      this.keybindNote = t('hud.options.keybindReset');
      this.deps.refreshKeybindLabels();
      this.renderRail(); // reset restores the default (strafe-unbound) conflict state
      this.renderDetail();
    });
    parent.appendChild(reset);
    // Re-home focus onto the capturing cap after the repaint so the blur exit and
    // the keyboard capture both have a live target (the prior cap was detached).
    if (this.capturingKey) {
      this.deps
        .root()
        .querySelector<HTMLElement>(
          `.kb-key.capturing[data-action="${this.capturingKey.action}"][data-index="${this.capturingKey.index}"]`,
        )
        ?.focus();
    }
  }

  /** Cancel the in-flight rebind capture (the on-screen Cancel + blur exits). Fires
   *  the capture callback with null exactly once; a no-op when nothing is capturing. */
  private cancelCapture(): void {
    this.captureCancel?.();
  }

  private beginCapture(actionId: string, index: number, fallbackLabel: string): void {
    const hooks = this.deps.options();
    if (!hooks) return;
    const name = this.actionDisplayName(actionId, fallbackLabel);
    // A fresh capture clears any transient eviction badge from a prior rebind.
    this.evictedRows = [];
    this.capturingKey = { action: actionId, index };
    this.keybindNote = t('hud.options.keybindCapture', { action: name });
    // Assertive announce (spec section 6); the visible note stays the shorter cue.
    this.announce(t('hudChrome.options.keybindRebinding', { action: name }));
    // Snapshot the BEFORE table so a steal can name the exact evicted action(s).
    const before = this.keyboardConflictRows();
    this.renderDetail();
    this.captureCancel = hooks.captureKey((code) => {
      this.captureCancel = null;
      this.capturingKey = null;
      if (code === null) {
        this.keybindNote = t('hud.options.keybindCancelled');
        this.announce(t('hud.options.keybindCancelled'));
      } else if (isReservedCode(code)) {
        this.keybindNote = t('hud.options.keybindReserved', { key: keyLabel(code) });
        this.announce(t('hud.options.keybindReserved', { key: keyLabel(code) }));
      } else if (this.deps.keybinds().bind(actionId, index, code)) {
        const stored = this.deps.keybinds().codeAt(actionId, index);
        const key = keyLabel(stored);
        const evicted = stored ? evictedActions(before, actionId, stored) : [];
        if (evicted.length > 0) {
          this.evictedRows = evicted;
          const evictedNames = evicted.map((id) => this.actionDisplayName(id, id)).join(', ');
          const msg = t('hudChrome.options.keybindEvicted', {
            key,
            action: name,
            evicted: evictedNames,
          });
          this.keybindNote = msg;
          this.announce(msg);
        } else {
          const msg = t('hud.options.keybindBound', { action: name, key });
          this.keybindNote = msg;
          this.announce(msg);
        }
        this.deps.refreshKeybindLabels();
      }
      if (this.isOpen && this.activeCategory === 'keybinds' && this.subView === 'none') {
        // A steal/unbind changes the aggregate, so refresh the rail dot too (not just
        // the detail), or the rail could contradict the pane's banner.
        this.renderRail();
        this.renderDetail();
      }
    });
  }

  // -------------------------------------------------------------------------
  // Controller per-button remap (bespoke .ui-dd dropdowns)
  // -------------------------------------------------------------------------

  private gamepadActionOptions(): { value: string; label: string }[] {
    const opts: { value: string; label: string }[] = [
      { value: GAMEPAD_NONE, label: t('hud.options.unbound') },
      { value: 'escape', label: t('hudChrome.controller.menuAction') },
    ];
    for (const a of BIND_ACTIONS) {
      if (a.id === 'attackMove') continue;
      if (a.kind !== 'edge' && a.id !== 'jump') continue;
      opts.push({ value: a.id, label: this.actionDisplayName(a.id, a.label) });
    }
    return opts;
  }

  private renderControllerButtons(parent: HTMLElement): void {
    const hooks = this.deps.options();
    if (!hooks) return;
    const head = el('div', 'opt-section-head');
    const title = document.createElement('span');
    title.textContent = t('hudChrome.controller.buttons');
    head.appendChild(title);
    parent.appendChild(head);
    const entries = hooks.gamepad.entries();
    if (entries.length === 0) {
      const empty = el('div', 'opt-empty');
      empty.textContent = t('hudChrome.controller.help');
      parent.appendChild(empty);
      return;
    }
    const opts = this.gamepadActionOptions();
    const kind = hooks.gamepad.kind();
    // Duplicate groups (spec section 6): a pad MAY map two buttons to one action, so
    // a shared row gets a chip NAMING its sibling buttons rather than being prevented.
    const dupByAction = new Map<string, ControllerDuplicate>();
    for (const dup of this.computeConflicts().controllerDuplicates)
      dupByAction.set(dup.action, dup);
    for (const { button, action } of entries) {
      const buttonLabel = gamepadButtonLabel(button, kind);
      const { row, control } = this.optRow(buttonLabel);
      row.dataset.button = String(button);
      const dup = dupByAction.get(action);
      if (dup) {
        const others = dup.labels.filter((_, i) => dup.buttons[i] !== button);
        const chip = el('span', 'ui-badge badge-warning opt-dup-chip');
        chip.textContent = t('hudChrome.controller.duplicate', { buttons: others.join(', ') });
        control.appendChild(chip);
      }
      const dd = this.deps.buildDropdown(
        opts,
        action,
        (v) => {
          hooks.gamepad.bind(button, v);
          // Re-render so a duplicate created by THIS remap surfaces its chip live
          // (and the rail dot updates), then re-home focus to the remapped dropdown.
          this.renderRail();
          this.renderDetail();
          this.deps
            .root()
            .querySelector<HTMLElement>(`.opt-row[data-button="${button}"] .ui-dd-btn`)
            ?.focus();
        },
        undefined,
        {
          ariaLabel: buttonLabel,
        },
      );
      control.appendChild(dd);
      parent.appendChild(row);
    }
    const reset = el('button', 'btn');
    reset.type = 'button';
    reset.textContent = t('hudChrome.controller.resetButtons');
    reset.addEventListener('click', () => {
      audio.click();
      hooks.gamepad.reset();
      this.renderRail(); // reset clears duplicates, so refresh the rail dot too
      this.renderDetail();
    });
    parent.appendChild(reset);
  }

  // -------------------------------------------------------------------------
  // Bug report (pushed sub-view under System > Support)
  // -------------------------------------------------------------------------

  private renderBugReport(detail: HTMLElement): void {
    const hooks = this.deps.bugReport();
    if (!hooks) {
      this.subView = 'none';
      this.activeCategory = 'system';
      this.renderDetail();
      return;
    }
    const head = el('div', 'opt-cat-head');
    head.textContent = t('hudChrome.bugReport.menuButton');
    detail.appendChild(head);
    const back = el('button', 'btn');
    back.type = 'button';
    back.textContent = t('hud.options.back');
    back.addEventListener('click', () => {
      audio.click();
      this.subView = 'none';
      this.renderRail();
      this.renderDetail();
    });
    detail.appendChild(back);

    const info = buildBugReportInfo(this.deps.world().realm, this.deps.world().player);
    const realm = info.realmKnown ? info.realm : t('hudChrome.bugReport.unknown');
    const coords =
      `${formatNumber(info.pos.x, { maximumFractionDigits: 0, useGrouping: false })}, ` +
      `${formatNumber(info.pos.y, { maximumFractionDigits: 0, useGrouping: false })}, ` +
      `${formatNumber(info.pos.z, { maximumFractionDigits: 0, useGrouping: false })}`;
    const infoEl = el('div', 'bug-info');
    const infoRow = (label: string, value: string): string =>
      `<div class="bug-info-row"><span class="bug-info-label">${esc(label)}</span><span class="bug-info-val">${esc(value)}</span></div>`;
    infoEl.innerHTML =
      infoRow(t('hudChrome.bugReport.realm'), realm) +
      infoRow(t('hudChrome.bugReport.character'), info.characterName) +
      infoRow(t('hudChrome.bugReport.position'), coords);
    detail.appendChild(infoEl);

    const shot = hooks.capture();
    const descLabel = el('label', 'bug-label');
    descLabel.setAttribute('for', 'bug-desc');
    descLabel.textContent = t('hudChrome.bugReport.description');
    const desc = document.createElement('textarea');
    desc.id = 'bug-desc';
    desc.className = 'bug-desc';
    desc.maxLength = BUG_DESC_MAX_LEN;
    desc.setAttribute('placeholder', t('hudChrome.bugReport.descriptionPlaceholder'));
    desc.setAttribute('aria-describedby', 'bug-error');
    detail.append(descLabel, desc);

    let includeShot = shot !== null;
    if (shot) {
      const shotWrap = el('div', 'bug-shot');
      const img = document.createElement('img');
      img.className = 'bug-shot-img';
      img.src = shot;
      img.alt = t('hudChrome.bugReport.screenshotAlt');
      const toggle = el('button', 'btn set-toggle');
      toggle.type = 'button';
      const syncToggle = () => {
        toggle.textContent = includeShot ? t('hud.options.on') : t('hud.options.off');
        toggle.classList.toggle('off', !includeShot);
        toggle.setAttribute('aria-pressed', String(includeShot));
        toggle.setAttribute('aria-label', t('hudChrome.bugReport.includeScreenshot'));
        img.style.display = includeShot ? '' : 'none';
      };
      toggle.addEventListener('click', () => {
        audio.click();
        includeShot = !includeShot;
        syncToggle();
      });
      syncToggle();
      const toggleRow = el('div', 'set-row');
      const name = el('span', 'set-name');
      name.textContent = t('hudChrome.bugReport.includeScreenshot');
      toggleRow.append(name, toggle);
      shotWrap.append(toggleRow, img);
      detail.appendChild(shotWrap);
    }

    const error = el('div', 'report-error');
    error.id = 'bug-error';
    error.setAttribute('role', 'alert');
    detail.appendChild(error);

    const actions = el('div', 'report-actions');
    const submit = el('button', 'btn');
    submit.type = 'button';
    submit.textContent = t('hudChrome.bugReport.submit');
    actions.appendChild(submit);
    detail.appendChild(actions);

    submit.addEventListener('click', () => {
      const description = desc.value.trim();
      if (!description) {
        error.textContent = t('hudChrome.bugReport.describeFirst');
        return;
      }
      submit.disabled = true;
      error.textContent = '';
      const sentShot = includeShot && shot !== null;
      hooks
        .submit({ description, screenshot: includeShot ? shot : null, meta: hooks.collectMeta() })
        .then(({ screenshotStored }) => {
          const droppedShot = sentShot && !screenshotStored;
          this.deps.log(
            t(
              droppedShot ? 'hudChrome.bugReport.submittedNoShot' : 'hudChrome.bugReport.submitted',
            ),
          );
          this.subView = 'none';
          this.renderRail();
          this.renderDetail();
        })
        .catch((err: unknown) => {
          submit.disabled = false;
          error.textContent = this.localizeBugReportError(err);
        });
    });
    window.setTimeout(() => desc.focus(), 0);
  }

  private localizeBugReportError(err: unknown): string {
    const text = err instanceof Error ? err.message : '';
    const keyByMessage: Record<string, TranslationKey> = {
      'describe the bug': 'hudChrome.bugReport.describeFirst',
      'bug report too large': 'hudChrome.bugReport.tooLarge',
      'too many bug reports, try again later': 'hudChrome.bugReport.rateLimited',
    };
    const key = keyByMessage[text.toLowerCase()];
    return key ? t(key) : t('hudChrome.bugReport.failed');
  }
}
