import { ABILITIES, CLASSES, ITEMS, MOBS, NPCS, QUESTS } from '../sim/data';
import type { PlayerClass } from '../sim/types';
import {
  en,
  getLanguage,
  hasTranslation,
  supportedLanguages,
  tOptional,
  type InterpolationValues,
  type SupportedLanguage,
} from './i18n';

export type EntityTranslationPhase = 'phase7' | 'phase8' | 'phase9';
export type EntityTranslationKind = 'class' | 'ability' | 'item' | 'mob' | 'npc' | 'quest' | 'questObjective';
export type EntityTranslationField = 'name' | 'description' | 'title' | 'text' | 'completion' | 'greeting' | 'label';

export type EntityTranslationRequest =
  | { kind: 'class'; id: PlayerClass; field: 'name' | 'description'; values?: InterpolationValues }
  | { kind: 'ability'; id: string; field: 'name' | 'description'; values?: InterpolationValues }
  | { kind: 'item'; id: string; field: 'name'; values?: InterpolationValues }
  | { kind: 'mob'; id: string; field: 'name'; values?: InterpolationValues }
  | { kind: 'npc'; id: string; field: 'name' | 'title' | 'greeting'; values?: InterpolationValues }
  | { kind: 'quest'; id: string; field: 'title' | 'text' | 'completion'; values?: InterpolationValues }
  | { kind: 'questObjective'; questId: string; objectiveIndex: number; field: 'label'; values?: InterpolationValues };

export interface EntityTranslationManifestEntry {
  kind: EntityTranslationKind;
  id: string;
  field: EntityTranslationField;
  key: string;
  source: string;
  phase: EntityTranslationPhase;
}

export interface MissingEntityTranslation extends EntityTranslationManifestEntry {
  missingLocales: SupportedLanguage[];
}

export interface EntityTranslationFallback extends EntityTranslationManifestEntry {
  language: SupportedLanguage;
  value: string;
}

const CLASS_NAME_KEYS: Record<PlayerClass, string> = {
  warrior: 'classes.warrior',
  paladin: 'classes.paladin',
  hunter: 'classes.hunter',
  rogue: 'classes.rogue',
  priest: 'classes.priest',
  shaman: 'classes.shaman',
  mage: 'classes.mage',
  warlock: 'classes.warlock',
  druid: 'classes.druid',
};

const CLASS_DESCRIPTION_KEYS: Record<PlayerClass, string> = {
  warrior: 'classDetails.lore.warrior',
  paladin: 'classDetails.lore.paladin',
  hunter: 'classDetails.lore.hunter',
  rogue: 'classDetails.lore.rogue',
  priest: 'classDetails.lore.priest',
  shaman: 'classDetails.lore.shaman',
  mage: 'classDetails.lore.mage',
  warlock: 'classDetails.lore.warlock',
  druid: 'classDetails.lore.druid',
};

const fallbackLog = new Map<string, EntityTranslationFallback>();

function entityPathSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9_]/g, '_');
}

function entry(
  kind: EntityTranslationKind,
  id: string,
  field: EntityTranslationField,
  source: string,
  phase: EntityTranslationPhase,
  key: string,
): EntityTranslationManifestEntry {
  return { kind, id, field, source, phase, key };
}

function compareById<T extends { id: string }>(a: T, b: T): number {
  return a.id.localeCompare(b.id);
}

function interpolateSource(source: string, values?: InterpolationValues): string {
  if (!values) return source;
  const legacy = source
    .replace(/\$N/g, String(values.playerName ?? values.name ?? '$N'))
    .replace(/\$C/g, String(values.className ?? '$C'))
    .replace(/\$d/g, String(values.damage ?? values.d ?? '$d'));
  return legacy.replace(/\{([A-Za-z0-9_]+)\}/g, (match, name: string) => {
    const value = values[name];
    return value === undefined ? match : String(value);
  });
}

function classDescriptionSource(id: PlayerClass): string {
  return en.classDetails.lore[id];
}

function canonicalEntityText(request: EntityTranslationRequest): string {
  switch (request.kind) {
    case 'class':
      return request.field === 'name'
        ? CLASSES[request.id]?.name ?? request.id
        : classDescriptionSource(request.id);
    case 'ability': {
      const ability = ABILITIES[request.id];
      if (!ability) return request.id;
      return request.field === 'name' ? ability.name : ability.description;
    }
    case 'item':
      return ITEMS[request.id]?.name ?? request.id;
    case 'mob':
      return MOBS[request.id]?.name ?? request.id;
    case 'npc': {
      const npc = NPCS[request.id];
      if (!npc) return request.id;
      if (request.field === 'title') return npc.title;
      if (request.field === 'greeting') return npc.greeting;
      return npc.name;
    }
    case 'quest': {
      const quest = QUESTS[request.id];
      if (!quest) return request.id;
      if (request.field === 'text') return quest.text;
      if (request.field === 'completion') return quest.completionText;
      return quest.name;
    }
    case 'questObjective':
      return QUESTS[request.questId]?.objectives[request.objectiveIndex]?.label ?? `${request.questId}.${request.objectiveIndex}`;
  }
}

export function entityTranslationKey(request: EntityTranslationRequest): string {
  switch (request.kind) {
    case 'class':
      return request.field === 'name' ? CLASS_NAME_KEYS[request.id] : CLASS_DESCRIPTION_KEYS[request.id];
    case 'ability':
      return `entities.abilities.${entityPathSegment(request.id)}.${request.field}`;
    case 'item':
      return `entities.items.${entityPathSegment(request.id)}.name`;
    case 'mob':
      return `entities.mobs.${entityPathSegment(request.id)}.name`;
    case 'npc':
      return `entities.npcs.${entityPathSegment(request.id)}.${request.field}`;
    case 'quest':
      return `entities.quests.${entityPathSegment(request.id)}.${request.field}`;
    case 'questObjective':
      return `entities.quests.${entityPathSegment(request.questId)}.objectives.${request.objectiveIndex}.label`;
  }
}

function requestManifestEntry(request: EntityTranslationRequest): EntityTranslationManifestEntry {
  const id = request.kind === 'questObjective'
    ? `${request.questId}.objectives.${request.objectiveIndex}`
    : request.id;
  const phase: EntityTranslationPhase =
    request.kind === 'class' || request.kind === 'ability' ? 'phase7'
      : request.kind === 'item' ? 'phase8'
        : 'phase9';
  return entry(request.kind, id, request.field, canonicalEntityText(request), phase, entityTranslationKey(request));
}

function recordFallback(request: EntityTranslationRequest, value: string): void {
  const manifestEntry = requestManifestEntry(request);
  const language = getLanguage();
  fallbackLog.set(`${language}:${manifestEntry.key}`, { ...manifestEntry, language, value });
}

export function tEntity(request: EntityTranslationRequest): string {
  const key = entityTranslationKey(request);
  const translated = tOptional(key, request.values);
  if (translated !== null) return translated;
  const fallback = interpolateSource(canonicalEntityText(request), request.values);
  recordFallback(request, fallback);
  return fallback;
}

export function resetEntityTranslationFallbackLog(): void {
  fallbackLog.clear();
}

export function entityTranslationFallbackLog(): EntityTranslationFallback[] {
  return [...fallbackLog.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export function entityTranslationManifest(): EntityTranslationManifestEntry[] {
  const entries: EntityTranslationManifestEntry[] = [];
  const classIds = Object.keys(CLASSES).sort() as PlayerClass[];
  for (const id of classIds) {
    entries.push(entry('class', id, 'name', CLASSES[id].name, 'phase7', CLASS_NAME_KEYS[id]));
    entries.push(entry('class', id, 'description', classDescriptionSource(id), 'phase7', CLASS_DESCRIPTION_KEYS[id]));
  }
  for (const ability of Object.values(ABILITIES).sort(compareById)) {
    entries.push(entry('ability', ability.id, 'name', ability.name, 'phase7', entityTranslationKey({ kind: 'ability', id: ability.id, field: 'name' })));
    entries.push(entry('ability', ability.id, 'description', ability.description, 'phase7', entityTranslationKey({ kind: 'ability', id: ability.id, field: 'description' })));
  }
  for (const item of Object.values(ITEMS).sort(compareById)) {
    entries.push(entry('item', item.id, 'name', item.name, 'phase8', entityTranslationKey({ kind: 'item', id: item.id, field: 'name' })));
  }
  for (const mob of Object.values(MOBS).sort(compareById)) {
    entries.push(entry('mob', mob.id, 'name', mob.name, 'phase9', entityTranslationKey({ kind: 'mob', id: mob.id, field: 'name' })));
  }
  for (const npc of Object.values(NPCS).sort(compareById)) {
    entries.push(entry('npc', npc.id, 'name', npc.name, 'phase9', entityTranslationKey({ kind: 'npc', id: npc.id, field: 'name' })));
    entries.push(entry('npc', npc.id, 'title', npc.title, 'phase9', entityTranslationKey({ kind: 'npc', id: npc.id, field: 'title' })));
    entries.push(entry('npc', npc.id, 'greeting', npc.greeting, 'phase9', entityTranslationKey({ kind: 'npc', id: npc.id, field: 'greeting' })));
  }
  for (const quest of Object.values(QUESTS).sort(compareById)) {
    entries.push(entry('quest', quest.id, 'title', quest.name, 'phase9', entityTranslationKey({ kind: 'quest', id: quest.id, field: 'title' })));
    entries.push(entry('quest', quest.id, 'text', quest.text, 'phase9', entityTranslationKey({ kind: 'quest', id: quest.id, field: 'text' })));
    entries.push(entry('quest', quest.id, 'completion', quest.completionText, 'phase9', entityTranslationKey({ kind: 'quest', id: quest.id, field: 'completion' })));
    quest.objectives.forEach((objective, objectiveIndex) => {
      entries.push(entry(
        'questObjective',
        `${quest.id}.objectives.${objectiveIndex}`,
        'label',
        objective.label,
        'phase9',
        entityTranslationKey({ kind: 'questObjective', questId: quest.id, objectiveIndex, field: 'label' }),
      ));
    });
  }
  return entries;
}

export function missingEntityTranslationsForPhases(
  completedPhases: readonly EntityTranslationPhase[],
): MissingEntityTranslation[] {
  const phaseSet = new Set(completedPhases);
  return entityTranslationManifest()
    .filter((manifestEntry) => phaseSet.has(manifestEntry.phase))
    .map((manifestEntry) => ({
      ...manifestEntry,
      missingLocales: supportedLanguages.filter((lang) => !hasTranslation(manifestEntry.key, lang)),
    }))
    .filter((manifestEntry) => manifestEntry.missingLocales.length > 0);
}

export function assertEntityTranslationsReady(completedPhases: readonly EntityTranslationPhase[]): void {
  const missing = missingEntityTranslationsForPhases(completedPhases);
  if (missing.length === 0) return;
  const preview = missing.slice(0, 5).map((entry) => entry.key).join(', ');
  throw new Error(`Missing entity translations: ${missing.length} keys. First missing keys: ${preview}`);
}
