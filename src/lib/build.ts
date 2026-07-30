/**
 * The Classi build data model.
 *
 * This module is isomorphic — it is imported by both the browser bundle and the
 * serverless function in `api/`, so it must not touch DOM or Node APIs.
 */

export const MAX_LEVEL = 12;

export type AbilityScores = {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
};

export const ABILITY_KEYS = [
  'strength',
  'dexterity',
  'constitution',
  'intelligence',
  'wisdom',
  'charisma',
] as const satisfies readonly (keyof AbilityScores)[];

/** Three-letter labels, in the order the game's character sheet shows them. */
export const ABILITY_LABELS: Record<keyof AbilityScores, string> = {
  strength: 'STR',
  dexterity: 'DEX',
  constitution: 'CON',
  intelligence: 'INT',
  wisdom: 'WIS',
  charisma: 'CHA',
};

/** One labelled choice within a level, e.g. "Feat" → "Sharpshooter". */
export type BuildEntry = {
  label: string;
  detail: string;
};

export type BuildLevel = {
  /** 1 through {@link MAX_LEVEL}. */
  level: number;
  /** Cumulative class split, e.g. "Rogue 3 (Thief) / Fighter 1". */
  progression: string;
  entries: BuildEntry[];
};

export type Build = {
  title: string;
  race: string;
  background: string;
  abilityScores: AbilityScores;
  summary: string;
  levels: BuildLevel[];
  roleplayNotes: string;
};

/**
 * JSON schema sent to OpenRouter as `response_format.json_schema`.
 *
 * Key order matters: it is the order most models emit fields in, and the UI
 * streams fields in as they arrive. The identity fields come first so the
 * header renders within a second or two, then `levels` (the bulk of the
 * response) streams in row by row, then the prose fields land last.
 *
 * Strict mode requires every property to be listed in `required` and
 * `additionalProperties: false` on every object, so nothing here is optional.
 */
export const BUILD_JSON_SCHEMA = {
  name: 'bg3_build',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'title',
      'race',
      'background',
      'abilityScores',
      'levels',
      'summary',
      'roleplayNotes',
    ],
    properties: {
      title: {
        type: 'string',
        description:
          'A short evocative name for this build, e.g. "The Shadow-Step Duelist". No quotation marks.',
      },
      race: {
        type: 'string',
        description:
          'Race and subrace as they appear in character creation, e.g. "Half-Elf (Wood Half-Elf)".',
      },
      background: {
        type: 'string',
        description: 'One of the BG3 backgrounds, e.g. "Charlatan".',
      },
      abilityScores: {
        type: 'object',
        additionalProperties: false,
        description:
          'Final level 1 ability scores after racial bonuses. Point buy allows 8-15 before racial bonuses, so no score may exceed 17.',
        required: [...ABILITY_KEYS],
        properties: Object.fromEntries(
          ABILITY_KEYS.map((key) => [key, { type: 'integer', minimum: 8, maximum: 17 }]),
        ),
      },
      levels: {
        type: 'array',
        description: `Exactly ${MAX_LEVEL} entries, one per level, in ascending order from 1 to ${MAX_LEVEL}.`,
        minItems: MAX_LEVEL,
        maxItems: MAX_LEVEL,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['level', 'progression', 'entries'],
          properties: {
            level: { type: 'integer', minimum: 1, maximum: MAX_LEVEL },
            progression: {
              type: 'string',
              description:
                'Cumulative class split at this level including subclasses, e.g. "Rogue 3 (Thief) / Fighter 1".',
            },
            entries: {
              type: 'array',
              description:
                'The concrete choices made at this level. 1-4 entries; only what actually changes at this level.',
              minItems: 1,
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['label', 'detail'],
                properties: {
                  label: {
                    type: 'string',
                    description:
                      'Short category, e.g. "Subclass", "Feat", "Spells", "Fighting Style".',
                  },
                  detail: {
                    type: 'string',
                    description:
                      'What was picked and why it matters, in one or two sentences. Plain prose with no bullet characters or markdown.',
                  },
                },
              },
            },
          },
        },
      },
      summary: {
        type: 'string',
        description:
          'Two or three sentences on how the build plays and what it is good at. Plain prose, no markdown.',
      },
      roleplayNotes: {
        type: 'string',
        description:
          'Two or three sentences tying the mechanics to the character concept. Plain prose, no markdown.',
      },
    },
  },
};

// --- Runtime validation -----------------------------------------------------
//
// The model is asked for this shape, but a response that does not match must
// produce a readable error rather than a crash deep inside a component.

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asInt(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : null;
}

function parseEntry(value: unknown): BuildEntry | null {
  if (!isRecord(value)) return null;
  const label = asString(value.label);
  const detail = asString(value.detail);
  if (label === null || detail === null) return null;
  return { label, detail };
}

/**
 * Validate one element of the `levels` array. Returns null rather than throwing
 * because this runs against objects plucked out of a partial stream, where a
 * malformed element should simply be skipped until the full parse at the end.
 */
export function parseBuildLevel(value: unknown): BuildLevel | null {
  if (!isRecord(value)) return null;

  const level = asInt(value.level);
  const progression = asString(value.progression);
  if (level === null || progression === null) return null;
  if (level < 1 || level > MAX_LEVEL) return null;

  if (!Array.isArray(value.entries)) return null;
  const entries: BuildEntry[] = [];
  for (const raw of value.entries) {
    const entry = parseEntry(raw);
    if (entry !== null) entries.push(entry);
  }
  if (entries.length === 0) return null;

  return { level, progression, entries };
}

function parseAbilityScores(value: unknown): AbilityScores | null {
  if (!isRecord(value)) return null;
  const scores: Partial<AbilityScores> = {};
  for (const key of ABILITY_KEYS) {
    const score = asInt(value[key]);
    if (score === null) return null;
    scores[key] = score;
  }
  return scores as AbilityScores;
}

export class BuildParseError extends Error {}

/** Validate a complete build. Throws {@link BuildParseError} if it cannot. */
export function parseBuild(value: unknown): Build {
  if (!isRecord(value)) {
    throw new BuildParseError('The model did not return a build object.');
  }

  const title = asString(value.title);
  const race = asString(value.race);
  const background = asString(value.background);
  const summary = asString(value.summary);
  const roleplayNotes = asString(value.roleplayNotes);
  const abilityScores = parseAbilityScores(value.abilityScores);

  const missing = [
    title === null && 'title',
    race === null && 'race',
    background === null && 'background',
    summary === null && 'summary',
    roleplayNotes === null && 'roleplayNotes',
    abilityScores === null && 'abilityScores',
  ].filter((field): field is string => typeof field === 'string');

  if (missing.length > 0) {
    throw new BuildParseError(`The build is missing these fields: ${missing.join(', ')}.`);
  }

  if (!Array.isArray(value.levels)) {
    throw new BuildParseError('The build has no level progression.');
  }

  const levels: BuildLevel[] = [];
  for (const raw of value.levels) {
    const level = parseBuildLevel(raw);
    if (level !== null) levels.push(level);
  }
  if (levels.length === 0) {
    throw new BuildParseError('The build has no usable levels.');
  }
  levels.sort((a, b) => a.level - b.level);

  // Non-fatal: a model that returns 10 of 12 levels still produces a useful
  // page, so the shortfall is surfaced in the UI rather than thrown here.
  return {
    // The nulls are excluded by the `missing` check above.
    title: title as string,
    race: race as string,
    background: background as string,
    abilityScores: abilityScores as AbilityScores,
    summary: summary as string,
    levels,
    roleplayNotes: roleplayNotes as string,
  };
}
