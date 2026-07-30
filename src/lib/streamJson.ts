/**
 * Incremental reader for a JSON object that is still arriving.
 *
 * The model streams one large JSON object. Waiting for the closing brace before
 * rendering anything means ~30 seconds of blank screen, so instead the buffer is
 * rescanned as chunks land and whatever has *definitively* finished arriving is
 * handed to the UI.
 *
 * The scan is deliberately conservative: a value is only reported once its
 * terminator has been seen, so a half-written string is never shown. It stops at
 * the first thing it cannot complete, which is always the tail of the buffer.
 *
 * Isomorphic — no DOM or Node APIs.
 */

export type PartialScan = {
  /**
   * Raw JSON text of each top-level value that has fully arrived, keyed by
   * property name. Values are unparsed so the caller decides how to validate.
   */
  values: Record<string, string>;
  /**
   * For top-level array properties, the raw JSON text of each element that has
   * fully arrived — populated even while the array itself is still open. This is
   * what makes level-by-level streaming possible.
   */
  arrayItems: Record<string, string[]>;
};

const WHITESPACE = new Set([' ', '\t', '\n', '\r']);

/**
 * Given the index of an opening quote, return the index of the closing quote, or
 * -1 if the string has not finished arriving. Handles backslash escapes.
 */
function scanString(source: string, start: number): number {
  let i = start + 1;
  while (i < source.length) {
    const char = source[i];
    if (char === '\\') {
      i += 2; // skip the escape and whatever it escapes
      continue;
    }
    if (char === '"') return i;
    i++;
  }
  return -1;
}

/**
 * Given the index of an opening `{` or `[`, return the index of its matching
 * close, or -1 if it has not finished arriving.
 *
 * When `arrayKey` is set the container is an array whose direct child objects
 * are collected into `arrayItems[arrayKey]`, including on the -1 path so that
 * partial progress is still reported.
 */
function scanContainer(
  source: string,
  start: number,
  arrayKey: string | null,
  arrayItems: Record<string, string[]>,
): number {
  const items: string[] = [];
  let depth = 0;
  let itemStart = -1;
  let i = start;

  const record = () => {
    if (arrayKey !== null) arrayItems[arrayKey] = items;
  };

  while (i < source.length) {
    const char = source[i];

    if (char === '"') {
      const end = scanString(source, i);
      if (end < 0) break; // string still arriving, so the container is too
      i = end + 1;
      continue;
    }

    if (char === '{' || char === '[') {
      // A container opened at depth 1 is a direct element of this array.
      if (depth === 1 && arrayKey !== null && itemStart === -1) itemStart = i;
      depth++;
      i++;
      continue;
    }

    if (char === '}' || char === ']') {
      depth--;
      if (depth === 1 && itemStart !== -1) {
        items.push(source.slice(itemStart, i + 1));
        itemStart = -1;
      }
      if (depth === 0) {
        record();
        return i;
      }
      i++;
      continue;
    }

    i++;
  }

  record();
  return -1;
}

/** Scan a partially-received JSON object for values that have fully arrived. */
export function scanPartialJson(source: string): PartialScan {
  const values: Record<string, string> = {};
  const arrayItems: Record<string, string[]> = {};
  const result = { values, arrayItems };

  // Start at the first brace rather than insisting the buffer begins with one.
  // Plenty of models ignore "no markdown" and open with a ```json fence, or a
  // line of preamble, even when a schema was supplied.
  let i = source.indexOf('{');
  if (i < 0) return result; // no object has started yet
  i++;

  const skipWhitespace = () => {
    while (i < source.length && WHITESPACE.has(source[i])) i++;
  };

  while (i < source.length) {
    // Position on the next key.
    while (i < source.length && (source[i] === ',' || WHITESPACE.has(source[i]))) i++;
    if (i >= source.length) break;
    if (source[i] === '}') break; // object closed
    if (source[i] !== '"') break; // malformed, or the key has not started

    const keyEnd = scanString(source, i);
    if (keyEnd < 0) break; // key still arriving

    let key: string;
    try {
      key = JSON.parse(source.slice(i, keyEnd + 1)) as string;
    } catch {
      break; // unparseable key; give up rather than guess
    }
    i = keyEnd + 1;

    skipWhitespace();
    if (source[i] !== ':') break;
    i++;
    skipWhitespace();
    if (i >= source.length) break;

    const valueStart = i;
    const char = source[i];

    if (char === '"') {
      const end = scanString(source, i);
      if (end < 0) break;
      values[key] = source.slice(valueStart, end + 1);
      i = end + 1;
      continue;
    }

    if (char === '{' || char === '[') {
      const end = scanContainer(source, i, char === '[' ? key : null, arrayItems);
      if (end < 0) break; // container still arriving; any partial items were recorded
      values[key] = source.slice(valueStart, end + 1);
      i = end + 1;
      continue;
    }

    // Number, boolean, or null: complete only once a delimiter proves it ended.
    let end = i;
    while (end < source.length && source[end] !== ',' && source[end] !== '}') end++;
    if (end >= source.length) break;
    values[key] = source.slice(valueStart, end).trim();
    i = end;
  }

  return result;
}

/**
 * Pull the outermost JSON object out of a buffer that may be wrapped in a
 * markdown code fence or padded with commentary. Returns null if there is no
 * plausible object. Cheap by design — the result still has to parse.
 */
export function sliceJsonObject(source: string): string | null {
  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  return source.slice(start, end + 1);
}

/** Parse a raw JSON fragment, returning null instead of throwing. */
export function tryParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}
