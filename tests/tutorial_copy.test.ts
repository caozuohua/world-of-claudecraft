import { describe, it, expect } from 'vitest';
import { tutorialBodyPlan } from '../src/ui/tutorial_copy';
import type { TutorialStep } from '../src/ui/tutorial';

describe('tutorialBodyPlan', () => {
  const STEPS: TutorialStep[] = ['move', 'seek', 'talk', 'slay', 'return', 'done'];

  it('uses the keyboard/mouse copy when touch is off', () => {
    for (const step of STEPS) {
      expect(tutorialBodyPlan(step, false).bodyKey).toBe(`hud.tutorial.${step}Body`);
    }
  });

  it('swaps in touch copy for control-referencing steps only', () => {
    // move/talk/return/done mention controls, so they get a touch variant.
    expect(tutorialBodyPlan('move', true).bodyKey).toBe('hudChrome.tutorial.moveBodyTouch');
    expect(tutorialBodyPlan('talk', true).bodyKey).toBe('hudChrome.tutorial.talkBodyTouch');
    expect(tutorialBodyPlan('return', true).bodyKey).toBe('hudChrome.tutorial.returnBodyTouch');
    expect(tutorialBodyPlan('done', true).bodyKey).toBe('hudChrome.tutorial.doneBodyTouch');
  });

  it('keeps the shared keyboard copy for steps that never mention controls', () => {
    // seek/slay describe the world, not the input device: identical on both.
    expect(tutorialBodyPlan('seek', true).bodyKey).toBe('hud.tutorial.seekBody');
    expect(tutorialBodyPlan('slay', true).bodyKey).toBe('hud.tutorial.slayBody');
  });

  it('drops keyboard-only params (moveKeys, interactKey, questKey) from touch copy', () => {
    expect(tutorialBodyPlan('move', true).params).toEqual([]);
    expect(tutorialBodyPlan('talk', true).params).toEqual([]);
    expect(tutorialBodyPlan('return', true).params).toEqual([]);
    // The done copy still personalizes with the player name on touch.
    expect(tutorialBodyPlan('done', true).params).toEqual(['name']);
  });

  it('keeps the interpolation params the keyboard copy needs', () => {
    expect(tutorialBodyPlan('move', false).params).toEqual(['moveKeys']);
    expect(tutorialBodyPlan('talk', false).params).toEqual(['interactKey']);
    expect(tutorialBodyPlan('return', false).params).toEqual(['interactKey']);
    expect(tutorialBodyPlan('done', false).params).toEqual(['name', 'questKey']);
  });
});
