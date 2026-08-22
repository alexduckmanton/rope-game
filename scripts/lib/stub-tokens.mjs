/**
 * Stands in for `src/tokens.js` outside a browser.
 *
 * The real module reads every value off `getComputedStyle(document.documentElement)`.
 * Nothing in puzzle generation looks at a colour, so these only have to exist.
 */
const hint = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [i + 1, '#000000']));

const semantic = new Proxy({}, { get: () => '#000000' });

export const colors = { hint };
export { semantic };
export default { colors, semantic };
