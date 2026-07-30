/**
 * Minimal ambient declaration for the environment the Edge function reads.
 *
 * Declared by hand rather than pulling in @types/node, which would drag Node's
 * global typings into a file that runs on the Edge runtime and would collide
 * with the DOM lib's fetch/Request/Response types.
 */
declare const process: {
  env: Record<string, string | undefined>
}
