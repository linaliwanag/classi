import { describe, expect, it } from 'vitest';
import { scanPartialJson, sliceJsonObject, tryParseJson } from '../streamJson';
import { sampleBuildJson } from './fixtures';

describe('sliceJsonObject', () => {
  it('trims a markdown fence off both ends', () => {
    expect(sliceJsonObject('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it('trims surrounding commentary', () => {
    expect(sliceJsonObject('Here you go: {"a":1} — enjoy!')).toBe('{"a":1}');
  });

  it('leaves clean JSON untouched', () => {
    expect(sliceJsonObject('{"a":{"b":1}}')).toBe('{"a":{"b":1}}');
  });

  it('returns null when there is no object', () => {
    expect(sliceJsonObject('no braces here')).toBeNull();
    expect(sliceJsonObject('}{')).toBeNull();
    expect(sliceJsonObject('')).toBeNull();
  });
});

describe('scanPartialJson', () => {
  it('reports nothing for an empty or non-object buffer', () => {
    for (const input of ['', '  ', '[1,2]', 'null', 'not json']) {
      expect(scanPartialJson(input)).toEqual({ values: {}, arrayItems: {} });
    }
  });

  // Several models ignore "respond with JSON only" and wrap the object in a
  // markdown fence anyway — gemma-4-26b:free does exactly this.
  it('sees through a leading markdown code fence', () => {
    const scan = scanPartialJson('```json\n{"title":"Rogue","race":"Drow"}\n```');
    expect(tryParseJson(scan.values.title)).toBe('Rogue');
    expect(tryParseJson(scan.values.race)).toBe('Drow');
  });

  it('sees through a line of preamble', () => {
    const scan = scanPartialJson('Sure! Here is your build:\n{"title":"Rogue"}');
    expect(tryParseJson(scan.values.title)).toBe('Rogue');
  });

  it('still streams array items when fenced', () => {
    const items = scanPartialJson('```json\n{"levels":[{"level":1},{"level":2},{"lev')
      .arrayItems.levels;
    expect(items).toHaveLength(2);
  });

  it('reads complete top-level scalars', () => {
    const scan = scanPartialJson('{"title":"Rogue","level":7,"ok":true,');
    expect(tryParseJson(scan.values.title)).toBe('Rogue');
    expect(tryParseJson(scan.values.level)).toBe(7);
    expect(tryParseJson(scan.values.ok)).toBe(true);
  });

  it('withholds a string value until its closing quote arrives', () => {
    expect(scanPartialJson('{"title":"The Half-Or').values).not.toHaveProperty('title');
    expect(scanPartialJson('{"title":"The Half-Orc"').values).toHaveProperty('title');
  });

  it('withholds a number until a delimiter proves it ended', () => {
    // "1" could still become "12", so it must not be reported yet.
    expect(scanPartialJson('{"level":1').values).not.toHaveProperty('level');
    expect(tryParseJson(scanPartialJson('{"level":12,').values.level)).toBe(12);
  });

  it('is not fooled by braces, colons or escaped quotes inside strings', () => {
    const source = '{"summary":"a {curly} note: he said \\"hi\\" once","race":"Half-Orc"}';
    const scan = scanPartialJson(source);
    expect(tryParseJson(scan.values.summary)).toBe('a {curly} note: he said "hi" once');
    expect(tryParseJson(scan.values.race)).toBe('Half-Orc');
  });

  it('yields array elements while the array is still open', () => {
    const source =
      '{"levels":[{"level":1,"progression":"Rogue 1"},{"level":2,"progression":"Rogue 2"},{"level":3';
    const items = scanPartialJson(source).arrayItems.levels;
    expect(items).toHaveLength(2);
    expect(tryParseJson(items[1])).toEqual({ level: 2, progression: 'Rogue 2' });
    // The array itself is unfinished, so it is not reported as a complete value.
    expect(scanPartialJson(source).values).not.toHaveProperty('levels');
  });

  it('does not mistake a nested object for an array element', () => {
    const source = '{"levels":[{"a":{"b":1},"c":[2,3]}]}';
    const items = scanPartialJson(source).arrayItems.levels;
    expect(items).toHaveLength(1);
    expect(tryParseJson(items[0])).toEqual({ a: { b: 1 }, c: [2, 3] });
  });

  it('keeps a brace inside an element string from closing the element early', () => {
    const source = '{"levels":[{"detail":"take }{ this"},{"detail":"then this"}]}';
    const items = scanPartialJson(source).arrayItems.levels;
    expect(items).toHaveLength(2);
    expect(tryParseJson(items[0])).toEqual({ detail: 'take }{ this' });
  });

  describe('against every prefix of a real response', () => {
    const full = sampleBuildJson();
    const complete = scanPartialJson(full);

    it('never reports a value that differs from the finished one', () => {
      for (let length = 0; length <= full.length; length++) {
        const scan = scanPartialJson(full.slice(0, length));

        for (const [key, raw] of Object.entries(scan.values)) {
          // Anything reported must be parseable and must match the final value.
          expect(tryParseJson(raw), `values.${key} at prefix ${length}`).not.toBeNull();
          expect(raw, `values.${key} at prefix ${length}`).toBe(complete.values[key]);
        }

        for (const [key, items] of Object.entries(scan.arrayItems)) {
          const finalItems = complete.arrayItems[key] ?? [];
          // Elements must be a strict prefix of the final list, in order.
          expect(items.length, `arrayItems.${key} at prefix ${length}`).toBeLessThanOrEqual(
            finalItems.length,
          );
          expect(items, `arrayItems.${key} at prefix ${length}`).toEqual(
            finalItems.slice(0, items.length),
          );
        }
      }
    });

    it('grows monotonically as more of the response arrives', () => {
      let seenLevels = 0;
      let seenValues = 0;
      for (let length = 0; length <= full.length; length++) {
        const scan = scanPartialJson(full.slice(0, length));
        const levels = scan.arrayItems.levels?.length ?? 0;
        const values = Object.keys(scan.values).length;
        expect(levels, `levels shrank at prefix ${length}`).toBeGreaterThanOrEqual(seenLevels);
        expect(values, `values shrank at prefix ${length}`).toBeGreaterThanOrEqual(seenValues);
        seenLevels = levels;
        seenValues = values;
      }
    });

    it('recovers the whole response once the last byte lands', () => {
      expect(complete.arrayItems.levels).toHaveLength(3);
      expect(tryParseJson(complete.values.title)).toBe('The Half-Orc Shadow-Step Duelist');
      expect(tryParseJson(complete.values.roleplayNotes)).toContain('harmless rogue');
    });
  });
});
