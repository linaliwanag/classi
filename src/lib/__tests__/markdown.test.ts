import { describe, expect, it } from 'vitest';
import { MAX_LEVEL } from '../build';
import { buildFilename, buildToMarkdown } from '../markdown';
import { sampleBuild } from './fixtures';

describe('buildToMarkdown', () => {
  const markdown = buildToMarkdown(sampleBuild, 'a drow rogue who wants to multiclass');

  it('leads with the title and the concept that produced it', () => {
    expect(markdown).toContain('# The Half-Orc Shadow-Step Duelist');
    expect(markdown).toContain('> a drow rogue who wants to multiclass');
  });

  it('includes the stat line and the facts', () => {
    expect(markdown).toContain('**Race:** Half-Orc (Standard)');
    expect(markdown).toContain('**Background:** Charlatan');
    expect(markdown).toContain('STR 16 · DEX 17 · CON 14 · INT 8 · WIS 10 · CHA 12');
  });

  it('writes one section per level with its entries', () => {
    expect(markdown).toContain('### Level 3 — Rogue 3 (Thief)');
    expect(markdown).toContain('- **Subclass:** Thief, for the second bonus action.');
  });

  it('preserves hyphenated words verbatim', () => {
    // The bug this replaced turned "Half-Orc" into a stray bullet point.
    expect(markdown).toContain('Half-Orc');
    expect(markdown).not.toMatch(/^-\s*Orc/m);
  });

  it('notes when a build is short of the level cap', () => {
    expect(markdown).toContain(`stops at level 3 of ${MAX_LEVEL}`);
  });

  it('omits the shortfall note for a full build', () => {
    const levels = Array.from({ length: MAX_LEVEL }, (_, index) => ({
      level: index + 1,
      progression: `Rogue ${index + 1}`,
      entries: [{ label: 'Note', detail: 'Steady progress.' }],
    }));
    expect(buildToMarkdown({ ...sampleBuild, levels }, 'x')).not.toContain('cut short');
  });

  it('omits empty prose sections instead of leaving bare headings', () => {
    const bare = buildToMarkdown({ ...sampleBuild, summary: '', roleplayNotes: '  ' }, 'x');
    expect(bare).not.toContain('## Summary');
    expect(bare).not.toContain('## Roleplay');
  });

  it('carries the fan-made disclaimer', () => {
    expect(markdown).toContain('fan-made tool');
  });
});

describe('buildFilename', () => {
  it('slugifies the title', () => {
    expect(buildFilename(sampleBuild)).toBe('the-half-orc-shadow-step-duelist.md');
  });

  it('falls back when the title has no usable characters', () => {
    expect(buildFilename({ ...sampleBuild, title: '???' })).toBe('classi-build.md');
    expect(buildFilename({ ...sampleBuild, title: '' })).toBe('classi-build.md');
  });

  it('keeps the name a sane length', () => {
    const name = buildFilename({ ...sampleBuild, title: 'word '.repeat(40) });
    expect(name.length).toBeLessThanOrEqual(64);
    expect(name.endsWith('.md')).toBe(true);
    expect(name).not.toContain('--');
  });
});
