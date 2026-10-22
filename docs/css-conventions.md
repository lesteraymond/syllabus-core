# CSS conventions

`src/styles.css` is written with Tailwind's `@apply`: each rule keeps its class name, selector and place in the file, and its
declarations are utilities (`tw:grid`, `tw:[padding:14px]`). No markup changed when it was converted, and the compiled CSS is
equivalent to the plain CSS it replaced (proof below).

## How the pieces fit

| File | Role |
|---|---|
| `src/main.jsx` | loads one stylesheet entry, `tailwind.css` |
| `src/tailwind.css` | declares the layer order `theme < base < legacy < components < utilities`, loads the token theme and Tailwind's utilities, and puts `styles.css` and `theme.css` in the `legacy` layer |
| `src/tw-theme.css` | the only Tailwind theme: every value points at a design token in `theme.css`; utilities are prefixed `tw:` |
| `src/theme.css` | design tokens and screen-specific overrides, **plain CSS**, the single source of truth for colours, sizes, fonts |
| `src/styles.css` | the application's rules, written with `@apply` |

There is no Tailwind reset (Preflight), no Tailwind default theme, and no unprefixed Tailwind class, so Tailwind cannot change an
element it was not asked to.

## Writing CSS

- A new component may use `tw:` classes in its markup, or a rule in `styles.css`. Either works; tokens come from `tw-theme.css`.
- Add a missing token to `tw-theme.css`, pointing at the existing variable (`--color-brand: var(--blue)`), never a literal.
- In `@apply`, **never put two properties of one family in one statement** (`border` and `border-color`, `padding` and
  `padding-right`, `font` and `line-height`): Tailwind reorders utilities inside a statement, and a longhand must follow its
  shorthand. Use separate `@apply` statements, in the order you want.
- **No variants** (`hover:`, `md:`) inside `@apply`: `hover:` adds a `(hover: hover)` media wrapper, and the app has its own
  breakpoints. Write `.x:hover { @apply ... }` and `@media (...) { .x { @apply ... } }` as ordinary CSS.
- Plain declarations are fine in the same rule, and are required for: custom properties (`--x`), `!important`, vendor prefixes,
  quoted strings and `url()` values, repeated fallback properties, and any rule that uses `color-mix()` or another modern colour
  function (Tailwind wraps those in an `@supports` fallback).
- The printed syllabus form (`.paper`) and the base element rules stay plain.
- Tests that assert what a rule does read the compiled CSS (`src/lib/compiledCss.js`), not the source text.

## Converting or checking a stylesheet

```
npm run css:to-apply -- <in.css> <out.css>          # rewrite declarations as @apply (deterministic, idempotent)
npm run css:equivalence -- <before.css> <after.css>  # compile both with Tailwind and compare rule by rule
npm run build                                        # then compare the two builds in a real browser:
npm run css:browser-compare -- <built-before.css> <built-after.css>   # needs Edge or Chrome (EDGE_PATH)
```

`css:equivalence` checks, for every style rule: the same selector and at-rule context in the same position, the same value for every
declaration (spacing around commas and slashes aside), the same `!important` flags, and the same relative order of any two
properties of one family. `css:browser-compare` builds an element for each selector and compares its computed style at 1400px and
600px wide.

## Known side effect

Tailwind's compiler adds an `@supports (color: color-mix(in lab, red, red))` fallback around each existing `color-mix()`
declaration. Browsers that support `color-mix` are unaffected; older ones receive a static fallback colour.

## Going back

The plain version of `styles.css` is in git history (the commit before the conversion). Restoring it needs no other change: plain
CSS is valid inside the `legacy` layer.
