// SimContext: the shared seam every extracted game-system module talks to instead
// of reaching into the 17.5k-line `Sim` monolith.
//
// Session S0b DEFINES this seam and threads it through the tick path; it MOVES NO
// behavior. Every callback below ROUTES to a method that still lives on `Sim`
// (the "points-at = Sim" column of 02-WORKING-MEMORY.md's callback registry). As a
// later slice extracts an owner, it reimplements that callback inside its own module
// WITHOUT renaming it here, so consumers never change. Treat the surface as
// APPEND-ONLY: add callbacks, never repurpose or rename one.
//
// This module is `src/sim`-pure: it imports only sibling sim types (no render/ui/
// game/net/DOM/Three, no `Math.random`/`Date.now`), so it runs unchanged in Node,
// the browser, and the headless RL env (enforced by tests/architecture.test.ts).

import type { TalentModifiers } from './content/talents';
import type { DelayedEvent, GroundAoE } from './entity_roster';
import type { Rng } from './rng';
import type {
  ArenaMatch,
  DuelState,
  InstanceSlot,
  Party,
  PetState,
  PlayerMeta,
  TradeSession,
} from './sim';
import type { SpatialGrid } from './spatial';
import type {
  Aura,
  CrowdControlDrCategory,
  DelveRun,
  Entity,
  ErrorReason,
  PlayerClass,
  QuestProgress,
  SimEvent,
  Vec3,
} from './types';

// Live primitive views onto the running Sim. These are GETTERS, not snapshots:
// `time`/`tickCount` advance every tick, and the `rng`/`entities` identities are
// shared so a consumer observes the same mutable world the Sim does (the engine
// mutates entities in place under the refactor's immutability waiver).
export interface SimContextPrimitives {
  readonly rng: Rng;
  readonly time: number;
  readonly tickCount: number;
  readonly entities: Map<number, Entity>;
  // Live player roster (keyed by pid). Read-write entity state lives on the entity;
  // this view is the metadata map the systems iterate. (Also added by A1/C1 with the
  // same signature; dedupe to one declaration at integration.)
  readonly players: Map<number, PlayerMeta>;
  // The monotonically increasing entity-id counter. Read-write so spawners (I1's
  // claimInstance) allocate ids exactly as `this.nextId++` did on Sim.
  nextId: number;
  // Spatial indexes kept roster-exact alongside `entities` (E1). Stay public on Sim
  // too (server/game.ts queries them); exposed here as live views for the roster ops.
  readonly grid: SpatialGrid;
  readonly playerGrid: SpatialGrid;
  // Sim-owned tick-prologue collections (E1). The drains (drainDelayedEvents /
  // tickGroundAoEs) live in entity_roster; the SCHEDULING push sites stay on Sim
  // (N1/M3 delayed events, C1/C4b ground AoEs), so the fields stay on Sim and are
  // reached here as live views. `delayedEvents` is read-write (the drain reassigns
  // the pending list); `groundAoEs` is mutated in place (splice), so read-only.
  delayedEvents: DelayedEvent[];
  readonly groundAoEs: GroundAoE[];
  // dungeon-door registry (I1) appended to on dungeon_door spawn; null until built.
  // Read-write: I1's updateDoorTriggers lazily assigns the array on first build.
  dungeonDoorIds: number[] | null;
  // The dungeon-instance slot pool (I1), seeded in the Sim ctor. The dungeons module
  // reads/finds/iterates it and mutates slot fields in place; the array identity
  // stays Sim-owned (like delayedEvents/groundAoEs), so this is a live read-only view.
  readonly instances: InstanceSlot[];
  // live arena bouts keyed by every participant pid (A2); release-spirit early-bails
  // when the dead player is mid-bout.
  readonly arenaMatches: Map<number, ArenaMatch>;
  // I2a delve runs: the live run pool (seeded in the Sim ctor, never reassigned) and
  // the transient pet stash both stay Sim-owned (the disconnect path + serializePet
  // poke them); exposed here as live views the run module reads/mutates in place.
  readonly delveRuns: DelveRun[];
  readonly delvePetStash: Map<number, PetState>;
  // Host-supplied UTC day string ('' = unknown) gating the delve daily reset.
  readonly utcDay: string;
}

// Cross-system callbacks. Each signature mirrors the still-on-`Sim` method it
// currently delegates to, EXACTLY (arg order + types preserved), so a delegation is
// a faithful move-not-rewrite. Grouped by the slice that will eventually own them.
export interface SimContextCallbacks {
  // Event sink (core). Routes to `Sim.emit`.
  emit(ev: SimEvent): void;
  // Player-facing error notice (core; also added by A1/G1a with the same signature,
  // dedupe at integration). Routes to `Sim.error`.
  error(pid: number, text: string, reason?: ErrorReason): void;

  // I1 dungeon instancing. `lockoutNowMs` is the shared raid-lockout clock (stays on
  // Sim; N1 also writes lockouts through it). instanceKeyFor/instanceOriginOf/
  // enterDungeon/leaveDungeon are exposed so foreign spawn/interaction/party code
  // (N1, the delve slice, quest spawns, the interaction dispatchers) reaches them
  // through the seam; implemented in instances/dungeons, Sim keeps thin delegates so
  // existing `this.enterDungeon` etc. call sites resolve unchanged.
  lockoutNowMs(): number;
  instanceKeyFor(pid: number): string;
  instanceOriginOf(inst: InstanceSlot): { x: number; z: number };
  enterDungeon(dungeonId: string, pid?: number): void;
  leaveDungeon(pid?: number): void;

  // C1 damage/death hub + the casting/leash/arena/duel/fiesta/loot teardown it
  // drives mid-tick. `dealDamage` is the post-mitigation entry (crit/dodge/miss and
  // armor are resolved upstream in meleeSwing/rangedSwing).
  dealDamage(
    source: Entity | null,
    target: Entity,
    amount: number,
    crit: boolean,
    school: string,
    ability: string | null,
    kind: 'hit' | 'miss' | 'dodge',
    noRage?: boolean,
    threatOpts?: { flat?: number; mult?: number },
  ): void;
  handleDeath(entity: Entity, killer: Entity | null): void;
  cancelCast(entity: Entity): void;
  pushbackCast(entity: Entity): void;
  refreshMobLeashFromAction(source: Entity | null, target: Entity): void;
  retargetMob(mob: Entity): void;
  isArenaCrossTeam(match: ArenaMatch, attackerPid: number, targetPid: number): boolean;
  arenaTeamOf(match: ArenaMatch, pid: number): 'A' | 'B' | null;
  endArenaMatch(
    match: ArenaMatch,
    winnerTeam: 'A' | 'B' | null,
    reason: 'defeat' | 'timeout' | 'forfeit',
  ): void;
  endDuel(duel: DuelState, winnerPid: number | null): void;
  fiestaTakedown(match: ArenaMatch, killerPid: number, victim: Entity): void;
  fiestaDown(match: ArenaMatch, victim: Entity, killerPid: number | null): void;
  rollLoot(mob: Entity, meta: PlayerMeta, eligible?: PlayerMeta[]): void;

  // C2/C3/C4b heal, aura, knockback, and crowd-control surface.
  applyHeal(source: Entity, target: Entity, amount: number, ability: string): void;
  applyAura(target: Entity, aura: Aura): void;
  applyRootAura(
    source: Entity,
    target: Entity,
    name: string,
    id: string,
    duration: number,
    school: Aura['school'],
  ): void;
  applyKnockback(source: Entity, target: Entity, distance: number): number;
  diminishedCrowdControlDuration(
    source: Entity,
    target: Entity,
    category: CrowdControlDrCategory,
    duration: number,
  ): number | null;
  hostilesInRadius(source: Entity, pos: Vec3, radius: number): Entity[];
  breakStealth(entity: Entity): void;

  // Shared entry point (stays on Sim, exposed here): taunt forces a mob's target.
  applyTaunt(target: Entity, mob: Entity): void;

  // P1 pet lifecycle.
  summonPet(owner: Entity, templateId: string): void;
  petOf(ownerPid: number, includeDead?: boolean): Entity | null;
  completeTame(player: Entity, target: Entity): void;

  // A1/T1 raid markers + party; Q1 quest-credit trio (kill/collect/turn-in credit,
  // foreign-called from handleDeath + the inventory hub + the interaction/crypt
  // dispatchers), reading inventory via countItem (stays on Sim / L2 inventory hub).
  clearEntityMarker(entityId: number): void;
  partyOf(pid: number): Party | null;
  removeFromParty(pid: number, verb: string): void;
  onMobKilledForQuests(mob: Entity, meta: PlayerMeta): void;
  onInventoryChangedForQuests(meta: PlayerMeta): void;
  checkQuestReady(qp: QuestProgress, meta: PlayerMeta): void;
  countItem(itemId: string, pid?: number): number;

  // E1 entity roster: the moved roster ops, exposed so the foreign callers across
  // not-yet-extracted slices reach them through the seam. Implemented in
  // entity_roster; Sim retains thin delegating methods so existing `this.addEntity`
  // / test `sim.addEntity` call sites resolve unchanged.
  addEntity(e: Entity): void;
  dropEntity(id: number): void;
  rebucket(e: Entity): void;

  // E1 forward references the moved code consumes; all still on Sim. `resolve`,
  // `groundPos`, `playerMods` are core; `delveRunForPlayer`/`delveModuleEntry`/
  // `failDelveRun` are delve-slice internals release-spirit calls; `pulseGroundAoE`
  // is the shared ground-AoE entry point the drain pulses.
  resolve(pid?: number): { meta: PlayerMeta; e: Entity } | null;
  groundPos(x: number, z: number): Vec3;
  playerMods(meta: PlayerMeta): TalentModifiers;
  delveRunForPlayer(pid: number): DelveRun | null;
  delveModuleEntry(run: DelveRun): Vec3;
  failDelveRun(run: DelveRun): void;
  pulseGroundAoE(effect: GroundAoE, threatOpts?: { flat?: number; mult?: number }): void;

  // I2a delve run lifecycle (delves/runs.ts). delveRunForMob/onDelveBossDefeated/
  // delveDetectMult/startDelveRaiseDeadChannel (+ delveRunForPlayer/delveModuleEntry/
  // failDelveRun above) are the reach-in callbacks foreign mob-death/summon/detection
  // hot paths use; they resolve to the moved body via the Sim delegate. The rest still
  // live on their owning slice (points-at Sim): the shared helpers (partyMembersForKey/
  // grantXp/addItem/spawnBossAdds), the gate predicates (tradeFor/duelFor), the P1 pet
  // seam (serializePet/restorePet/despawnPet/despawnPersistentPet/isPetClass), the I2b
  // lockpick controller (abandonLockpick/tickLockpickTimeout), and the I2c companion AI
  // (spawnDelveCompanion/despawnDelveCompanion/maybeCompanionBark).
  partyMembersForKey(key: string): number[];
  grantXp(amount: number, meta: PlayerMeta, opts?: { fromKill?: boolean }): void;
  addItem(itemId: string, count: number, pid?: number): void;
  // L2 World Market escrow (marketList) pulls the listed stack from the seller's
  // bags via removeItem; the inventory hub stays on Sim (points-at Sim).
  removeItem(itemId: string, count: number, pid?: number): void;
  spawnBossAdds(boss: Entity, mobId: string, count: number): void;
  tradeFor(pid: number): TradeSession | null;
  duelFor(pid: number): DuelState | null;
  serializePet(ownerPid: number): PetState | null;
  restorePet(owner: Entity, state: PetState): void;
  despawnPet(pet: Entity): void;
  despawnPersistentPet(pet: Entity): void;
  isPetClass(cls: PlayerClass): boolean;
  spawnDelveCompanion(run: DelveRun, pid: number, companionId: string): void;
  despawnDelveCompanion(run: DelveRun): void;
  maybeCompanionBark(run: DelveRun, pid: number, barkId: string): void;
  abandonLockpick(run: DelveRun): void;
  tickLockpickTimeout(run: DelveRun): void;
  delveRunForMob(mobId: number): DelveRun | null;
  onDelveBossDefeated(run: DelveRun): void;
  delveDetectMult(player: Entity): number;
  startDelveRaiseDeadChannel(run: DelveRun, boss: Entity, mobId: string, count: number): boolean;

  // I2c delve companion AI (delves/companion.ts). updateDelveCompanion is the per-tick
  // brain the mob-AI dispatch invokes for an owned, non-stunned companion mob (before
  // the pet branch); points-at delves/companion. It consumes the shared mob/movement/
  // hostility helpers below, which STAY on Sim (mobSwing/moveToward are shared entry
  // points; isHostileTo/isRooted/moveSpeedMult/swingIntervalMult are Sim predicates).
  // M2/T1/C3 register these six with identical signatures on the integrated base ->
  // dedupe to one each at integration.
  updateDelveCompanion(companion: Entity): void;
  mobSwing(mob: Entity, target: Entity): void;
  moveToward(e: Entity, dest: Vec3, speed: number, ignoreObstacles?: boolean): boolean;
  isHostileTo(attacker: Entity, target: Entity): boolean;
  isRooted(e: Entity): boolean;
  moveSpeedMult(e: Entity): number;
  swingIntervalMult(e: Entity): number;
}

// The seam consumed by extracted modules.
export interface SimContext extends SimContextPrimitives, SimContextCallbacks {}

// What `Sim` supplies to build a SimContext. Structurally identical to SimContext
// today, but kept as its own name to make the data flow explicit (Sim -> host ->
// context) and to let the consumed seam narrow independently of the provider later.
export interface SimContextHost extends SimContextPrimitives, SimContextCallbacks {}

// Assemble the immutable SimContext from its host. The primitives stay LIVE (each
// access reads through to the host, so `time`/`tickCount` reflect the current tick
// and `rng`/`entities` are the shared instances); the callbacks pass through
// unchanged (the host already binds them to the Sim). Pure: this constructs no
// state, draws no rng, and reads no clock, so installing the seam cannot perturb
// determinism.
export function createSimContext(host: SimContextHost): SimContext {
  return {
    get rng() {
      return host.rng;
    },
    get time() {
      return host.time;
    },
    get tickCount() {
      return host.tickCount;
    },
    get entities() {
      return host.entities;
    },
    get players() {
      return host.players;
    },
    get nextId() {
      return host.nextId;
    },
    set nextId(v) {
      host.nextId = v;
    },
    get grid() {
      return host.grid;
    },
    get playerGrid() {
      return host.playerGrid;
    },
    get delayedEvents() {
      return host.delayedEvents;
    },
    set delayedEvents(v) {
      host.delayedEvents = v;
    },
    get groundAoEs() {
      return host.groundAoEs;
    },
    get dungeonDoorIds() {
      return host.dungeonDoorIds;
    },
    set dungeonDoorIds(v) {
      host.dungeonDoorIds = v;
    },
    get instances() {
      return host.instances;
    },
    get arenaMatches() {
      return host.arenaMatches;
    },
    get delveRuns() {
      return host.delveRuns;
    },
    get delvePetStash() {
      return host.delvePetStash;
    },
    get utcDay() {
      return host.utcDay;
    },
    emit: host.emit,
    error: host.error,
    lockoutNowMs: host.lockoutNowMs,
    instanceKeyFor: host.instanceKeyFor,
    instanceOriginOf: host.instanceOriginOf,
    enterDungeon: host.enterDungeon,
    leaveDungeon: host.leaveDungeon,
    dealDamage: host.dealDamage,
    handleDeath: host.handleDeath,
    cancelCast: host.cancelCast,
    pushbackCast: host.pushbackCast,
    refreshMobLeashFromAction: host.refreshMobLeashFromAction,
    retargetMob: host.retargetMob,
    isArenaCrossTeam: host.isArenaCrossTeam,
    arenaTeamOf: host.arenaTeamOf,
    endArenaMatch: host.endArenaMatch,
    endDuel: host.endDuel,
    fiestaTakedown: host.fiestaTakedown,
    fiestaDown: host.fiestaDown,
    rollLoot: host.rollLoot,
    applyHeal: host.applyHeal,
    applyAura: host.applyAura,
    applyRootAura: host.applyRootAura,
    applyKnockback: host.applyKnockback,
    diminishedCrowdControlDuration: host.diminishedCrowdControlDuration,
    hostilesInRadius: host.hostilesInRadius,
    breakStealth: host.breakStealth,
    applyTaunt: host.applyTaunt,
    summonPet: host.summonPet,
    petOf: host.petOf,
    completeTame: host.completeTame,
    clearEntityMarker: host.clearEntityMarker,
    partyOf: host.partyOf,
    removeFromParty: host.removeFromParty,
    onMobKilledForQuests: host.onMobKilledForQuests,
    onInventoryChangedForQuests: host.onInventoryChangedForQuests,
    checkQuestReady: host.checkQuestReady,
    countItem: host.countItem,
    addEntity: host.addEntity,
    dropEntity: host.dropEntity,
    rebucket: host.rebucket,
    resolve: host.resolve,
    groundPos: host.groundPos,
    playerMods: host.playerMods,
    delveRunForPlayer: host.delveRunForPlayer,
    delveModuleEntry: host.delveModuleEntry,
    failDelveRun: host.failDelveRun,
    pulseGroundAoE: host.pulseGroundAoE,
    partyMembersForKey: host.partyMembersForKey,
    grantXp: host.grantXp,
    addItem: host.addItem,
    removeItem: host.removeItem,
    spawnBossAdds: host.spawnBossAdds,
    tradeFor: host.tradeFor,
    duelFor: host.duelFor,
    serializePet: host.serializePet,
    restorePet: host.restorePet,
    despawnPet: host.despawnPet,
    despawnPersistentPet: host.despawnPersistentPet,
    isPetClass: host.isPetClass,
    spawnDelveCompanion: host.spawnDelveCompanion,
    despawnDelveCompanion: host.despawnDelveCompanion,
    maybeCompanionBark: host.maybeCompanionBark,
    abandonLockpick: host.abandonLockpick,
    tickLockpickTimeout: host.tickLockpickTimeout,
    delveRunForMob: host.delveRunForMob,
    onDelveBossDefeated: host.onDelveBossDefeated,
    delveDetectMult: host.delveDetectMult,
    startDelveRaiseDeadChannel: host.startDelveRaiseDeadChannel,
    updateDelveCompanion: host.updateDelveCompanion,
    mobSwing: host.mobSwing,
    moveToward: host.moveToward,
    isHostileTo: host.isHostileTo,
    isRooted: host.isRooted,
    moveSpeedMult: host.moveSpeedMult,
    swingIntervalMult: host.swingIntervalMult,
  };
}
