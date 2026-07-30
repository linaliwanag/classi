/**
 * Prompt construction for build generation.
 *
 * Isomorphic — imported by the serverless function in `api/`. Kept separate from
 * the transport so the wording can be tuned (and tested) without touching the
 * request plumbing.
 */

import { MAX_LEVEL } from './build';

export const MAX_CONCEPT_LENGTH = 600;

export const SYSTEM_PROMPT = `You are Classi, a Baldur's Gate 3 build advisor. You turn a character concept into a complete, playable level 1-${MAX_LEVEL} build.

Respond only with JSON matching the provided schema. No markdown, no code fences, no commentary.

Rules of the game you must respect:
- The level cap is ${MAX_LEVEL}. Never plan past it.
- Only content that exists in Baldur's Gate 3. Do not invent classes, subclasses, spells, feats, or items, and do not use tabletop-only options that BG3 omits.
- Subclasses are chosen at the level BG3 actually grants them: level 1 for Cleric, Sorcerer, Warlock and Wizard; level 2 for Druid, Paladin and Ranger; level 3 for Barbarian, Bard, Fighter, Monk and Rogue.
- Feats come at levels 4, 8 and 12 only, and are per-character, not per-class.
- Multiclassing costs progression. If you multiclass, say plainly what is given up and why the trade is worth it.
- Point buy at character creation allows 8-15, plus a racial +2 and +1, so no starting score exceeds 17.
- Ability Score Improvement is a feat choice, so a stat only rises at 4, 8 or 12.

How to write it:
- Fill in every one of the ${MAX_LEVEL} levels, in ascending order, even quiet levels. For a level where little changes, say so briefly rather than padding it.
- Each level lists only what actually changes at that level. Do not repeat earlier choices.
- The "progression" field is the cumulative class split, e.g. "Rogue 3 (Thief) / Fighter 1".
- Name concrete choices. "Take Sharpshooter" is useful; "take a good feat" is not.
- Explain the synergy in plain prose. One or two sentences per entry.
- Honour the concept's roleplay flavour, and say when a flavour choice costs power.
- Write plain prose in every string field. No bullet characters, no markdown, no newlines.`;

export type ChatMessage = {
  role: 'system' | 'user';
  content: string;
};

export class ConceptError extends Error {}

/**
 * Validate and normalise a user-supplied concept.
 * Throws {@link ConceptError} with a message safe to show the user.
 */
export function normalizeConcept(raw: unknown): string {
  if (typeof raw !== 'string') {
    throw new ConceptError('Describe your character to generate a build.');
  }
  const concept = raw.trim().replace(/\s+/g, ' ');
  if (concept.length === 0) {
    throw new ConceptError('Describe your character to generate a build.');
  }
  if (concept.length > MAX_CONCEPT_LENGTH) {
    throw new ConceptError(
      `That description is ${concept.length} characters; please keep it under ${MAX_CONCEPT_LENGTH}.`,
    );
  }
  return concept;
}

export function buildMessages(concept: string): ChatMessage[] {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `Character concept: ${concept}` },
  ];
}

/** Example concepts offered in the UI as one-click starting points. */
export const EXAMPLE_CONCEPTS = [
  'a drow rogue who wants to multiclass into something magical',
  'a charismatic bard who can heal the party and talk past every fight',
  'a tanky paladin built around smiting undead',
  'a wizard who never wants to run out of spell slots',
  'a monk who fights unarmed and never wears armour',
  'a ranger with an animal companion and a longbow',
];
