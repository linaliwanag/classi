import { describe, expect, it } from 'vitest';
import { finalizeBuild } from '../api';
import { BuildParseError, parseBuild, parseBuildLevel } from '../build';
import { ConceptError, normalizeConcept } from '../prompt';
import { sampleBuild, sampleBuildJson } from './fixtures';

describe('parseBuildLevel', () => {
  it('accepts a well-formed level', () => {
    expect(parseBuildLevel(sampleBuild.levels[0])).toEqual(sampleBuild.levels[0]);
  });

  it('rejects levels outside 1-12', () => {
    for (const level of [0, 13, -1]) {
      expect(parseBuildLevel({ ...sampleBuild.levels[0], level })).toBeNull();
    }
  });

  it('rejects missing or malformed fields rather than throwing', () => {
    expect(parseBuildLevel(null)).toBeNull();
    expect(parseBuildLevel('level 1')).toBeNull();
    expect(parseBuildLevel({ level: 1 })).toBeNull();
    expect(parseBuildLevel({ level: 1, progression: 'Rogue 1', entries: [] })).toBeNull();
    expect(
      parseBuildLevel({ level: 1, progression: 'Rogue 1', entries: [{ label: 'x' }] }),
    ).toBeNull();
  });

  it('drops individually malformed entries but keeps the good ones', () => {
    const level = parseBuildLevel({
      level: 4,
      progression: 'Rogue 4',
      entries: [{ label: 'Feat', detail: 'Sharpshooter' }, { label: 'broken' }],
    });
    expect(level?.entries).toEqual([{ label: 'Feat', detail: 'Sharpshooter' }]);
  });
});

describe('parseBuild', () => {
  it('round-trips a full build', () => {
    expect(parseBuild(JSON.parse(sampleBuildJson()))).toEqual(sampleBuild);
  });

  it('names the fields that are missing', () => {
    const incomplete: Record<string, unknown> = { ...sampleBuild };
    delete incomplete.race;
    delete incomplete.summary;

    expect(() => parseBuild(incomplete)).toThrow(BuildParseError);
    expect(() => parseBuild(incomplete)).toThrow(/race/);
    expect(() => parseBuild(incomplete)).toThrow(/summary/);
  });

  it('rejects a build with no usable levels', () => {
    expect(() => parseBuild({ ...sampleBuild, levels: [] })).toThrow(/no usable levels/);
    expect(() => parseBuild({ ...sampleBuild, levels: 'Rogue' })).toThrow(/no level progression/);
  });

  it('sorts levels into ascending order', () => {
    const shuffled = [sampleBuild.levels[2], sampleBuild.levels[0], sampleBuild.levels[1]];
    expect(parseBuild({ ...sampleBuild, levels: shuffled }).levels.map((l) => l.level)).toEqual([
      1, 2, 3,
    ]);
  });
});

describe('finalizeBuild', () => {
  it('parses a complete response', () => {
    expect(finalizeBuild(sampleBuildJson())).toEqual(sampleBuild);
  });

  it('salvages the levels from a response cut off mid-flight', () => {
    const full = sampleBuildJson();
    // Truncate part-way through the third level object.
    const cut = full.indexOf('"Rogue 3 (Thief)"') + 4;
    const salvaged = finalizeBuild(full.slice(0, cut));

    expect(salvaged.levels.map((level) => level.level)).toEqual([1, 2]);
    expect(salvaged.title).toBe(sampleBuild.title);
    // Prose that never arrived is blank rather than fabricated.
    expect(salvaged.summary).toBe('');
  });

  it('recovers a build wrapped in a markdown code fence', () => {
    const fenced = `Here is your build:\n\`\`\`json\n${sampleBuildJson()}\n\`\`\``;
    expect(finalizeBuild(fenced)).toEqual(sampleBuild);
  });

  it('throws a readable error when nothing usable arrived', () => {
    expect(() => finalizeBuild('{"title":"Half')).toThrow(/could not be read as a build/);
  });
});

describe('normalizeConcept', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeConcept('  a  drow\n\nrogue ')).toBe('a drow rogue');
  });

  it('rejects empty and non-string input', () => {
    for (const input of ['', '   ', undefined, null, 42]) {
      expect(() => normalizeConcept(input)).toThrow(ConceptError);
    }
  });

  it('rejects an over-long concept and says how long it was', () => {
    expect(() => normalizeConcept('x'.repeat(601))).toThrow(/601 characters/);
  });
});
