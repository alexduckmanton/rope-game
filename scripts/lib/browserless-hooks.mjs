/**
 * Node resolution hooks that let the game's own modules run outside a browser.
 *
 * `config.js` imports `tokens.js` (which reads CSS custom properties off a live
 * document) and the i18n runtime (whose message dictionary is bound by a
 * Vite-only alias). Neither has anything to do with puzzle generation, but both
 * are unimportable in plain Node, so the generation modules cannot be exercised
 * offline without them stubbed.
 *
 * Register before importing anything under `src/`:
 *
 *   import { register } from 'node:module';
 *   register('./lib/browserless-hooks.mjs', import.meta.url);
 *   const { generateSolutionPath } = await import('../src/generator.js');
 */

const STUBS = new Map([
  ['./tokens.js', './stub-tokens.mjs'],
  ['../tokens.js', './stub-tokens.mjs'],
  ['./i18n/index.js', './stub-i18n.mjs'],
  ['../i18n/index.js', './stub-i18n.mjs'],
]);

export function resolve(specifier, context, nextResolve) {
  const stub = STUBS.get(specifier);
  if (stub) {
    return { url: new URL(stub, import.meta.url).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
