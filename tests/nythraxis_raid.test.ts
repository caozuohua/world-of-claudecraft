import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim/sim';
import { dist2d, type Entity } from '../src/sim/types';
import { DUNGEONS, MOBS, instanceOrigin } from '../src/sim/data';
import { isBlocked } from '../src/sim/colliders';
import { groundHeight } from '../src/sim/world';
import { NYTHRAXIS_LAYOUT } from '../src/sim/dungeon_layout';
import { visualKeyFor } from '../src/render/characters/manifest';

function makeWorld(lockoutNowMs?: () => number) {
  return new Sim({ seed: 42, playerClass: 'warrior', noPlayer: true, lockoutNowMs });
}

function teleport(sim: Sim, pid: number, x: number, z: number) {
  const e = sim.entities.get(pid)!;
  e.pos.x = x;
  e.pos.z = z;
  e.pos.y = groundHeight(x, z, sim.cfg.seed);
  e.prevPos = { ...e.pos };
}

function attune(sim: Sim, pid: number) {
  sim.players.get(pid)!.questsDone.add('q_nythraxis_bound_guardian');
}

function enterRaid(sim: Sim, pid: number) {
  attune(sim, pid);
  sim.enterDungeon('nythraxis_boss_arena', pid);
  const p = sim.entities.get(pid)!;
  return instanceOrigin(DUNGEONS.nythraxis_boss_arena.index, sim.instanceSlotAt(p.pos)!);
}

function mob(sim: Sim, templateId: string): Entity {
  const found = [...sim.entities.values()].find((e) => e.kind === 'mob' && e.templateId === templateId && !e.dead);
  expect(found).toBeTruthy();
  return found!;
}

function objects(sim: Sim, itemId: string, near?: { x: number; z: number }): Entity[] {
  return [...sim.entities.values()].filter((e) =>
    e.kind === 'object'
    && e.objectItemId === itemId
    && (!near || dist2d(e.pos, { x: near.x, y: 0, z: near.z }) < 140));
}

function engage(boss: Entity, tank: Entity) {
  boss.inCombat = true;
  boss.aiState = 'attack';
  boss.aggroTargetId = tank.id;
  boss.threat.set(tank.id, 1000);
}

function tickSeconds(sim: Sim, seconds: number) {
  for (let i = 0; i < seconds * 20; i++) sim.tick();
}

function killMob(sim: Sim, mob: Entity, killer: Entity) {
  (sim as unknown as {
    dealDamage(source: Entity, target: Entity, amount: number, crit: boolean, school: string, ability: string | null, kind: 'hit', noRage?: boolean): void;
  }).dealDamage(killer, mob, mob.hp, false, 'physical', null, 'hit', true);
}

describe('Nythraxis raid encounter', () => {
  it('registers the Abandoned Crypt as a 10-player dark raid instance', () => {
    const crypt = DUNGEONS.nythraxis_crypt;
    const dungeon = DUNGEONS.nythraxis_boss_arena;
    expect(crypt.interior).toBe('crypt');
    expect(crypt.objects?.some((o) => o.templateId === 'dungeon_door' && o.dungeonId === 'nythraxis_boss_arena' && o.z >= 109)).toBe(true);
    // The crypt's interactables are the three attunement relics that summon the
    // guardian undead. The Royal Graves belong to the overworld q_nythraxis_graves
    // quest (ZONE3_OBJECTS) — they must not be duplicated inside the crypt.
    expect(crypt.objects?.map((o) => o.itemId)).toEqual(expect.arrayContaining([
      'captains_crest',
      'priests_sigil',
      'royal_seal',
    ]));
    expect(crypt.objects?.some((o) => o.itemId.startsWith('grave_'))).toBe(false);
    expect(dungeon.interior).toBe('nythraxis');
    expect(dungeon.suggestedPlayers).toBe(10);
    expect(dungeon.spawns).toEqual([{ mobId: 'nythraxis_scourge_of_thornpeak', x: 0, z: 96 }]);
    expect(NYTHRAXIS_LAYOUT.wallX).toBeGreaterThanOrEqual(230);
    expect(MOBS.nythraxis_scourge_of_thornpeak.boss).toBe(true);
    expect(MOBS.nythraxis_scourge_of_thornpeak.ccImmune).toBe(true);
    expect(MOBS.nythraxis_scourge_of_thornpeak.moveSpeed).toBe(10.5);

    const sim = makeWorld();
    const pid = sim.addPlayer('warrior', 'Tank');
    const origin = enterRaid(sim, pid);
    expect(sim.entities.get(pid)!.pos.x).toBeGreaterThan(3000);
    const boss = mob(sim, 'nythraxis_scourge_of_thornpeak');
    expect(visualKeyFor(boss)).toBe('skel_golem');
    expect(boss.scale).toBeGreaterThanOrEqual(3);
    expect(boss.facing).toBe(Math.PI);
    expect(objects(sim, 'bastion_ward_stone', origin)).toHaveLength(3);
    expect(isBlocked(sim.cfg.seed, origin.x + 0, origin.z + 96)).toBe(false);
    expect(isBlocked(sim.cfg.seed, origin.x + 18, origin.z + 82)).toBe(false);
    expect(isBlocked(sim.cfg.seed, origin.x + 230, origin.z + 82)).toBe(true);
  });

  it('keeps Nythraxis fixed at his throne facing the entrance before pull', () => {
    const sim = makeWorld();
    const pid = sim.addPlayer('warrior', 'Tank');
    enterRaid(sim, pid);
    const boss = mob(sim, 'nythraxis_scourge_of_thornpeak');
    const spawn = { ...boss.spawnPos };

    tickSeconds(sim, 8);

    expect(dist2d(boss.pos, spawn)).toBeLessThan(0.01);
    expect(boss.facing).toBe(Math.PI);
    expect(boss.aiState).toBe('idle');
    expect(boss.inCombat).toBe(false);
  });

  it('keeps the three Abandoned Crypt attunement relics and summons their undead', () => {
    const sim = makeWorld();
    const pid = sim.addPlayer('warrior', 'Attuning');
    sim.players.get(pid)!.questLog.set('q_nythraxis_sealed_crypt', {
      questId: 'q_nythraxis_sealed_crypt',
      counts: [0, 0, 0],
      state: 'active',
    });
    sim.enterDungeon('nythraxis_crypt', pid);
    const p = sim.entities.get(pid)!;
    const origin = instanceOrigin(DUNGEONS.nythraxis_crypt.index, sim.instanceSlotAt(p.pos)!);
    const relics = [
      ['captains_crest', 'fallen_captain_aldren'],
      ['priests_sigil', 'corrupted_priest_malric'],
      ['royal_seal', 'deathstalker_voss'],
    ] as const;
    for (const [itemId, summonId] of relics) {
      const relic = objects(sim, itemId, origin)[0];
      expect(relic, itemId).toBeTruthy();
      teleport(sim, pid, relic.pos.x, relic.pos.z);
      sim.pickUpObject(relic.id, pid);
      expect(mob(sim, summonId), summonId).toBeTruthy();
    }
  });

  it('Nythraxis keeps autoattacking while normal mechanics are active', () => {
    const sim = makeWorld();
    const tankPid = sim.addPlayer('warrior', 'Tank');
    enterRaid(sim, tankPid);
    const tank = sim.entities.get(tankPid)!;
    const boss = mob(sim, 'nythraxis_scourge_of_thornpeak');
    teleport(sim, tankPid, boss.pos.x, boss.pos.z - 4);
    engage(boss, tank);
    boss.aiState = 'attack';
    boss.swingTimer = 0;
    const hp = tank.hp;
    sim.tick();
    expect(tank.hp).toBeLessThan(hp);
  });

  it('Nythraxis chases back into swing range when his target runs away', () => {
    const sim = makeWorld();
    const tankPid = sim.addPlayer('warrior', 'Tank');
    const origin = enterRaid(sim, tankPid);
    const tank = sim.entities.get(tankPid)!;
    tank.maxHp = 1e7;
    tank.hp = tank.maxHp;
    const boss = mob(sim, 'nythraxis_scourge_of_thornpeak');
    engage(boss, tank);
    teleport(sim, tankPid, origin.x, origin.z + 36);
    boss.aiState = 'chase';
    boss.swingTimer = 0;

    const hp = tank.hp;
    for (let i = 0; i < 20 * 12 && tank.hp === hp; i++) sim.tick();

    expect(dist2d(boss.pos, tank.pos)).toBeLessThanOrEqual(12);
    expect(tank.hp).toBeLessThan(hp);
    expect(boss.aiState).toBe('attack');
  });

  it('forces an engaged but idle Nythraxis into chase and melee swings', () => {
    const sim = makeWorld();
    const tankPid = sim.addPlayer('warrior', 'Tank');
    const origin = enterRaid(sim, tankPid);
    const tank = sim.entities.get(tankPid)!;
    tank.maxHp = 1e7;
    tank.hp = tank.maxHp;
    const boss = mob(sim, 'nythraxis_scourge_of_thornpeak');
    teleport(sim, tankPid, origin.x, origin.z + 36);
    boss.inCombat = true;
    boss.aiState = 'idle';
    boss.aggroTargetId = tank.id;
    boss.threat.set(tank.id, 1000);
    boss.swingTimer = 0;

    sim.tick();
    expect(boss.aiState).toBe('chase');

    const hp = tank.hp;
    for (let i = 0; i < 20 * 12 && tank.hp === hp; i++) sim.tick();

    expect(dist2d(boss.pos, tank.pos)).toBeLessThanOrEqual(12);
    expect(tank.hp).toBeLessThan(hp);
    expect(boss.aiState).toBe('attack');
  });

  it('raised skeleton adds chase back into swing range', () => {
    const sim = makeWorld();
    const tankPid = sim.addPlayer('warrior', 'Tank');
    const origin = enterRaid(sim, tankPid);
    const tank = sim.entities.get(tankPid)!;
    tank.maxHp = 1e7;
    tank.hp = tank.maxHp;
    const boss = mob(sim, 'nythraxis_scourge_of_thornpeak');
    engage(boss, tank);
    boss.nythraxis = {
      phase: 1,
      introSpoken: true,
      transitionStarted: false,
      transitionTimer: 0,
      transitionCues: [],
      transitionReleased: false,
      gravebreakerTimer: 99,
      raiseFallenTimer: 0,
      soulRendTimer: 99,
      soulRendMarks: [],
      soulRendLockout: 0,
      deathlessTimer: 99,
      deathlessCastRemaining: 0,
      deathlessStunRemaining: 0,
      wardChannels: [],
      finalStand: false,
      deathSpoken: false,
    };
    sim.tick();
    const add = mob(sim, 'nythraxis_skeleton_warrior');
    teleport(sim, tankPid, origin.x + 34, origin.z + 82);
    add.aiState = 'chase';
    add.swingTimer = 0;

    for (let i = 0; i < 20 * 12; i++) sim.tick();

    expect(dist2d(add.pos, tank.pos)).toBeLessThanOrEqual(6);
    expect(add.aiState).toBe('attack');
  });

  it('allows the outer crypt but blocks un-attuned players at the inner royal door', () => {
    const sim = makeWorld();
    const pid = sim.addPlayer('warrior', 'Unready');
    sim.enterDungeon('nythraxis_crypt', pid);
    expect(sim.entities.get(pid)!.pos.x).toBeGreaterThan(3000);
    const before = { ...sim.entities.get(pid)!.pos };
    sim.enterDungeon('nythraxis_boss_arena', pid);
    expect(dist2d(sim.entities.get(pid)!.pos, before)).toBeLessThan(0.1);
  });

  it('transitions at 50 percent, stuns the room, spawns Aldric, and lights wardstones', () => {
    const sim = makeWorld();
    const tankPid = sim.addPlayer('warrior', 'Tank');
    enterRaid(sim, tankPid);
    const tank = sim.entities.get(tankPid)!;
    const boss = mob(sim, 'nythraxis_scourge_of_thornpeak');
    teleport(sim, tankPid, boss.pos.x, boss.pos.z - 6);
    engage(boss, tank);
    boss.hp = Math.floor(boss.maxHp * 0.49);

    sim.tick();
    expect(boss.nythraxis?.phase).toBe('transition');
    expect(tank.auras.some((a) => a.id === 'nythraxis_transition_stun')).toBe(true);
    expect(mob(sim, 'brother_aldric_raid')).toBeTruthy();

    tickSeconds(sim, 8);
    expect(objects(sim, 'bastion_ward_stone', boss.spawnPos).every((w) => w.auras.some((a) => a.id === 'nythraxis_wardstone_lit'))).toBe(true);
    tickSeconds(sim, 7);
    expect(boss.nythraxis?.phase).toBe(2);
    expect(tank.auras.some((a) => a.id === 'nythraxis_transition_stun')).toBe(false);
    expect(visualKeyFor(mob(sim, 'brother_aldric_raid'))).toBe('npc_aldric');
  });

  it('splits Soul Rend among stacked marked players and kills isolated marks', () => {
    const sim = makeWorld();
    const tankPid = sim.addPlayer('warrior', 'Tank');
    const origin = enterRaid(sim, tankPid);
    const boss = mob(sim, 'nythraxis_scourge_of_thornpeak');
    const tank = sim.entities.get(tankPid)!;
    engage(boss, tank);
    const pids = ['A', 'B', 'C'].map((name) => {
      const pid = sim.addPlayer('mage', name);
      teleport(sim, pid, origin.x, origin.z + 82);
      return pid;
    });
    boss.nythraxis = {
      phase: 2,
      introSpoken: true,
      transitionStarted: true,
      transitionTimer: 0,
      transitionCues: [],
      transitionReleased: true,
      gravebreakerTimer: 99,
      raiseFallenTimer: 99,
      soulRendTimer: 99,
      soulRendMarks: pids.map((pid) => ({ playerId: pid, remaining: 0 })),
      soulRendLockout: 0,
      deathlessTimer: 99,
      deathlessCastRemaining: 0,
      deathlessStunRemaining: 0,
      wardChannels: [],
      finalStand: false,
      deathSpoken: false,
    };
    sim.tick();
    for (const pid of pids) {
      const p = sim.entities.get(pid)!;
      expect(p.dead).toBe(false);
      expect(p.hp).toBeLessThanOrEqual(Math.ceil(p.maxHp * 0.7));
    }

    for (let i = 0; i < pids.length; i++) {
      teleport(sim, pids[i], origin.x + i * 10, origin.z + 82);
      const p = sim.entities.get(pids[i])!;
      p.dead = false;
      p.hp = p.maxHp;
    }
    boss.nythraxis.soulRendMarks = pids.map((pid) => ({ playerId: pid, remaining: 0 }));
    sim.tick();
    expect(pids.every((pid) => sim.entities.get(pid)!.dead)).toBe(true);
  });

  it('marks non-tank raid members with Soul Rend and skips the aggro target', () => {
    const sim = makeWorld();
    const tankPid = sim.addPlayer('warrior', 'Tank');
    const origin = enterRaid(sim, tankPid);
    const boss = mob(sim, 'nythraxis_scourge_of_thornpeak');
    const tank = sim.entities.get(tankPid)!;
    engage(boss, tank);
    const pids = ['A', 'B', 'C', 'D'].map((name, i) => {
      const pid = sim.addPlayer('mage', name);
      teleport(sim, pid, origin.x + i, origin.z + 82);
      return pid;
    });
    boss.nythraxis = {
      phase: 2,
      introSpoken: true,
      transitionStarted: true,
      transitionTimer: 0,
      transitionCues: [],
      transitionReleased: true,
      gravebreakerTimer: 99,
      raiseFallenTimer: 99,
      soulRendTimer: 0,
      soulRendMarks: [],
      soulRendLockout: 0,
      deathlessTimer: 99,
      deathlessCastRemaining: 0,
      deathlessStunRemaining: 0,
      wardChannels: [],
      finalStand: false,
      deathSpoken: false,
    };

    sim.tick();

    const marked = boss.nythraxis.soulRendMarks.map((m) => m.playerId);
    expect(marked).toHaveLength(3);
    expect(marked).not.toContain(tankPid);
    expect(marked.every((pid) => pids.includes(pid))).toBe(true);
    for (const pid of marked) {
      expect(sim.entities.get(pid)?.auras.some((a) => a.id === 'nythraxis_soul_rend')).toBe(true);
    }
  });

  it('interrupts Deathless Rage when three players channel the wardstones', () => {
    const sim = makeWorld();
    const tankPid = sim.addPlayer('warrior', 'Tank');
    const origin = enterRaid(sim, tankPid);
    const boss = mob(sim, 'nythraxis_scourge_of_thornpeak');
    engage(boss, sim.entities.get(tankPid)!);
    boss.nythraxis = {
      phase: 2,
      introSpoken: true,
      transitionStarted: true,
      transitionTimer: 0,
      transitionCues: [],
      transitionReleased: true,
      gravebreakerTimer: 99,
      raiseFallenTimer: 99,
      soulRendTimer: 99,
      soulRendMarks: [],
      soulRendLockout: 0,
      deathlessTimer: 0,
      deathlessCastRemaining: 0,
      deathlessStunRemaining: 0,
      wardChannels: [],
      finalStand: false,
      deathSpoken: false,
    };
    sim.tick();
    expect(boss.castingAbility).toBe('nythraxis_deathless_rage');

    const wards = objects(sim, 'bastion_ward_stone', origin);
    const channelers = wards.map((ward, i) => {
      const pid = sim.addPlayer('priest', `Ward${i}`);
      teleport(sim, pid, ward.pos.x, ward.pos.z);
      sim.targetEntity(ward.id, pid);
      sim.interact(pid);
      return pid;
    });
    tickSeconds(sim, 6);

    expect(boss.castingAbility).toBeNull();
    expect(boss.nythraxis?.deathlessStunRemaining).toBeGreaterThan(0);
    expect(channelers.every((pid) => sim.entities.get(pid)!.castingAbility === null)).toBe(true);
    expect(objects(sim, 'bastion_ward_stone', origin)).toHaveLength(3);
    expect(origin.x).toBeGreaterThan(3000);
  });

  it('does not reset a wardstone channel when the same player interacts again', () => {
    const sim = makeWorld();
    const tankPid = sim.addPlayer('warrior', 'Tank');
    const origin = enterRaid(sim, tankPid);
    const boss = mob(sim, 'nythraxis_scourge_of_thornpeak');
    engage(boss, sim.entities.get(tankPid)!);
    boss.nythraxis = {
      phase: 2,
      introSpoken: true,
      transitionStarted: true,
      transitionTimer: 0,
      transitionCues: [],
      transitionReleased: true,
      gravebreakerTimer: 99,
      raiseFallenTimer: 99,
      soulRendTimer: 99,
      soulRendMarks: [],
      soulRendLockout: 0,
      deathlessTimer: 0,
      deathlessCastRemaining: 0,
      deathlessStunRemaining: 0,
      wardChannels: [],
      finalStand: false,
      deathSpoken: false,
    };
    sim.tick();

    const ward = objects(sim, 'bastion_ward_stone', origin)[0];
    const pid = sim.addPlayer('priest', 'WardSpam');
    teleport(sim, pid, ward.pos.x, ward.pos.z);
    sim.targetEntity(ward.id, pid);
    sim.interact(pid);
    tickSeconds(sim, 2);
    const remaining = boss.nythraxis!.wardChannels.find((c) => c.objectId === ward.id)!.remaining;
    expect(remaining).toBeLessThan(4);

    sim.interact(pid);
    expect(boss.nythraxis!.wardChannels.find((c) => c.objectId === ward.id)!.remaining).toBeCloseTo(remaining);
  });

  it('does not interrupt Deathless Rage unless all three wardstone channels complete', () => {
    const sim = makeWorld();
    const tankPid = sim.addPlayer('warrior', 'Tank');
    const origin = enterRaid(sim, tankPid);
    const tank = sim.entities.get(tankPid)!;
    tank.maxHp = 1e7;
    tank.hp = tank.maxHp;
    const boss = mob(sim, 'nythraxis_scourge_of_thornpeak');
    engage(boss, tank);
    boss.nythraxis = {
      phase: 2,
      introSpoken: true,
      transitionStarted: true,
      transitionTimer: 0,
      transitionCues: [],
      transitionReleased: true,
      gravebreakerTimer: 99,
      raiseFallenTimer: 99,
      soulRendTimer: 99,
      soulRendMarks: [],
      soulRendLockout: 0,
      deathlessTimer: 0,
      deathlessCastRemaining: 0,
      deathlessStunRemaining: 0,
      wardChannels: [],
      finalStand: false,
      deathSpoken: false,
    };
    sim.tick();

    const ward = objects(sim, 'bastion_ward_stone', origin)[0];
    teleport(sim, tankPid, ward.pos.x, ward.pos.z);
    sim.targetEntity(ward.id, tankPid);
    sim.interact(tankPid);
    sim.tick();

    expect(tank.castingAbility).toBe('nythraxis_ward_channel');
    expect(tank.channeling).toBe(true);
    expect(boss.castingAbility).toBe('nythraxis_deathless_rage');
    expect(boss.nythraxis?.wardChannels.every((c) => c.complete)).toBe(false);

    tickSeconds(sim, 6);

    expect(boss.nythraxis?.wardChannels.filter((c) => c.complete)).toHaveLength(1);
    expect(boss.nythraxis?.deathlessStunRemaining).toBe(0);
    tickSeconds(sim, 5);
    expect(boss.castingAbility).toBeNull();
    expect(boss.nythraxis?.deathlessStunRemaining).toBe(0);
    expect(tank.hp).toBeLessThan(tank.maxHp);
  });

  it('does not interrupt Deathless Rage when one player completes all wardstones', () => {
    const sim = makeWorld();
    const tankPid = sim.addPlayer('warrior', 'Tank');
    const origin = enterRaid(sim, tankPid);
    const tank = sim.entities.get(tankPid)!;
    tank.maxHp = 1e7;
    tank.hp = tank.maxHp;
    const boss = mob(sim, 'nythraxis_scourge_of_thornpeak');
    engage(boss, tank);
    boss.nythraxis = {
      phase: 2,
      introSpoken: true,
      transitionStarted: true,
      transitionTimer: 0,
      transitionCues: [],
      transitionReleased: true,
      gravebreakerTimer: 99,
      raiseFallenTimer: 99,
      soulRendTimer: 99,
      soulRendMarks: [],
      soulRendLockout: 0,
      deathlessTimer: 0,
      deathlessCastRemaining: 0,
      deathlessStunRemaining: 0,
      wardChannels: [],
      finalStand: false,
      deathSpoken: false,
    };
    sim.tick();

    expect(objects(sim, 'bastion_ward_stone', origin)).toHaveLength(3);
    for (const channel of boss.nythraxis!.wardChannels) {
      channel.playerId = tankPid;
      channel.complete = true;
      channel.remaining = 0;
    }
    sim.tick();

    expect(boss.castingAbility).toBe('nythraxis_deathless_rage');
    expect(boss.nythraxis?.deathlessStunRemaining).toBe(0);
    tickSeconds(sim, 10);
    expect(boss.nythraxis?.deathlessStunRemaining).toBe(0);
    expect(tank.hp).toBeLessThan(tank.maxHp);
  });

  it('starts wardstone channels through the object click pickup path', () => {
    const sim = makeWorld();
    const tankPid = sim.addPlayer('warrior', 'Tank');
    const origin = enterRaid(sim, tankPid);
    const boss = mob(sim, 'nythraxis_scourge_of_thornpeak');
    engage(boss, sim.entities.get(tankPid)!);
    boss.nythraxis = {
      phase: 2,
      introSpoken: true,
      transitionStarted: true,
      transitionTimer: 0,
      transitionCues: [],
      transitionReleased: true,
      gravebreakerTimer: 99,
      raiseFallenTimer: 99,
      soulRendTimer: 99,
      soulRendMarks: [],
      soulRendLockout: 0,
      deathlessTimer: 0,
      deathlessCastRemaining: 0,
      deathlessStunRemaining: 0,
      wardChannels: [],
      finalStand: false,
      deathSpoken: false,
    };
    sim.tick();

    const ward = objects(sim, 'bastion_ward_stone', origin)[0];
    const pid = sim.addPlayer('priest', 'Clicker');
    teleport(sim, pid, ward.pos.x, ward.pos.z);
    sim.pickUpObject(ward.id, pid);

    const channel = boss.nythraxis!.wardChannels.find((c) => c.objectId === ward.id)!;
    expect(channel.playerId).toBe(pid);
    expect(sim.entities.get(pid)!.castingAbility).toBe('nythraxis_ward_channel');
    expect(ward.lootable).toBe(true);
    expect(sim.players.get(pid)!.inventory.some((slot) => slot?.itemId === 'bastion_ward_stone')).toBe(false);
  });

  it('never leashes/resets when kited — keeps chasing instead of evading home', () => {
    const sim = makeWorld();
    const tankPid = sim.addPlayer('warrior', 'Tank');
    const origin = enterRaid(sim, tankPid);
    const tank = sim.entities.get(tankPid)!;
    tank.maxHp = 1e7; tank.hp = tank.maxHp; // survive so a wipe can't muddy the test
    const boss = mob(sim, 'nythraxis_scourge_of_thornpeak');
    engage(boss, tank);
    sim.tick(); // init the encounter
    // drag the boss far from its home (further than any leash) but keep the tank
    // alive in the room; a normal mob would evade — Nythraxis must not.
    teleport(sim, tankPid, origin.x + 150, origin.z + 96);
    boss.pos.x = origin.x + 140; boss.pos.z = origin.z + 96; boss.prevPos = { ...boss.pos };
    tickSeconds(sim, 3);
    expect(boss.nythraxis).toBeTruthy();        // encounter still live
    expect(boss.dead).toBe(false);
    expect(boss.aiState).not.toBe('evade');
    expect(boss.aiState).not.toBe('idle');
  });

  it('resets only on a full wipe (every player in the arena dead)', () => {
    const sim = makeWorld();
    const tankPid = sim.addPlayer('warrior', 'Tank');
    enterRaid(sim, tankPid);
    const tank = sim.entities.get(tankPid)!;
    const boss = mob(sim, 'nythraxis_scourge_of_thornpeak');
    engage(boss, tank);
    sim.tick();
    expect(boss.nythraxis).toBeTruthy();
    boss.hp = Math.floor(boss.maxHp * 0.4); // mid-fight
    tank.dead = true; tank.hp = 0;            // raid wipes
    tickSeconds(sim, 1);
    expect(boss.nythraxis).toBeUndefined();             // encounter reset
    expect(boss.hp).toBe(boss.maxHp);                   // back to full
    expect(dist2d(boss.pos, boss.spawnPos)).toBeLessThan(1); // sent home
    expect(boss.inCombat).toBe(false);
  });

  it('seals the royal door while engaged and reopens it when Nythraxis dies', () => {
    const sim = makeWorld();
    const tankPid = sim.addPlayer('warrior', 'Tank');
    enterRaid(sim, tankPid);
    const tank = sim.entities.get(tankPid)!;
    const boss = mob(sim, 'nythraxis_scourge_of_thornpeak');
    engage(boss, tank);
    sim.tick(); // engage -> encounter live -> door sealed
    const inside = { ...tank.pos };
    sim.leaveDungeon(tankPid);
    expect(dist2d(tank.pos, inside)).toBeLessThan(0.1); // could not flee
    expect(tank.pos.x).toBeGreaterThan(3000);
    // boss dies -> seal lifts
    boss.dead = true; boss.hp = 0;
    sim.tick();
    sim.leaveDungeon(tankPid);
    expect(tank.pos.x).toBeLessThan(3000); // back out to Thornpeak
  });

  it('locks raid members out of the Nythraxis arena for 24 hours after boss defeat', () => {
    let now = 1_000_000;
    const sim = makeWorld(() => now);
    const tankPid = sim.addPlayer('warrior', 'Tank');
    enterRaid(sim, tankPid);
    const tank = sim.entities.get(tankPid)!;
    const boss = mob(sim, 'nythraxis_scourge_of_thornpeak');
    engage(boss, tank);
    killMob(sim, boss, tank);
    expect(sim.players.get(tankPid)?.raidLockouts.get('nythraxis_boss_arena')).toBe(now + 24 * 60 * 60 * 1000);

    sim.leaveDungeon(tankPid);
    expect(tank.pos.x).toBeLessThan(3000);
    sim.enterDungeon('nythraxis_boss_arena', tankPid);
    expect(tank.pos.x).toBeLessThan(3000);

    now += 24 * 60 * 60 * 1000 + 1;
    sim.enterDungeon('nythraxis_boss_arena', tankPid);
    expect(tank.pos.x).toBeGreaterThan(3000);
  });

  it('does not allow dueling inside the Nythraxis boss arena', () => {
    const sim = makeWorld();
    const a = sim.addPlayer('warrior', 'Tank');
    const b = sim.addPlayer('mage', 'Mage');
    attune(sim, a);
    attune(sim, b);
    sim.enterDungeon('nythraxis_boss_arena', a);
    sim.enterDungeon('nythraxis_boss_arena', b);
    const ae = sim.entities.get(a)!;
    const be = sim.entities.get(b)!;
    be.pos = { ...ae.pos, x: ae.pos.x + 3 };
    be.prevPos = { ...be.pos };

    sim.duelRequest(b, a);
    sim.duelAccept(b);

    expect(sim.duelFor(a)).toBeNull();
    expect(sim.duelFor(b)).toBeNull();
  });
});
