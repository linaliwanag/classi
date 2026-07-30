import type { Build } from '../build';

/**
 * A build whose strings contain everything that used to break the old text
 * parser: hyphenated words, an escaped quote, a literal brace, and a colon.
 */
export const sampleBuild: Build = {
  title: 'The Half-Orc Shadow-Step Duelist',
  race: 'Half-Orc (Standard)',
  background: 'Charlatan',
  abilityScores: {
    strength: 16,
    dexterity: 17,
    constitution: 14,
    intelligence: 8,
    wisdom: 10,
    charisma: 12,
  },
  summary: 'A two-handed skirmisher who hits first: "alpha strike" is the whole plan.',
  levels: [
    {
      level: 1,
      progression: 'Rogue 1',
      entries: [
        { label: 'Skills', detail: 'Sleight of Hand and Stealth — the short-rest bread and butter.' },
        { label: 'Ability Scores', detail: 'Dexterity 17 after the racial bonus {see above}.' },
      ],
    },
    {
      level: 2,
      progression: 'Rogue 2',
      entries: [{ label: 'Cunning Action', detail: 'Dash, Disengage, or Hide as a bonus action.' }],
    },
    {
      level: 3,
      progression: 'Rogue 3 (Thief)',
      entries: [{ label: 'Subclass', detail: 'Thief, for the second bonus action.' }],
    },
  ],
  roleplayNotes: 'Plays the "harmless rogue" up front, then well-timed betrayal.',
};

export function sampleBuildJson(): string {
  // Key order matches BUILD_JSON_SCHEMA, which is the order a model streams in.
  return JSON.stringify({
    title: sampleBuild.title,
    race: sampleBuild.race,
    background: sampleBuild.background,
    abilityScores: sampleBuild.abilityScores,
    levels: sampleBuild.levels,
    summary: sampleBuild.summary,
    roleplayNotes: sampleBuild.roleplayNotes,
  });
}
