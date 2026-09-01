# PLUS CARD — Design

The visual system. Strategy and audience live in [PRODUCT.md](PRODUCT.md).

## Theme

**Dark by default.** The customer is on a phone at night, half a minute of patience, buying a game top-up. Light is offered and fully supported, but dark is the room this app is used in.

Both themes are the same layout with a different palette. Every colour is a CSS variable in `src/app/globals.css`; switching theme never changes a single dimension.

## Colour

**Strategy: restrained.** Tinted neutrals plus one accent, and the accent stays under about a tenth of any screen. This is deliberate and structural: the merchandise is loud — magenta telecom logos, green, PUBG key art — and a shop whose chrome competes with its shelves is a shop you cannot scan. The interface is the frame.

The ramp is built in OKLCH at a single hue (**262°**, a cool blue) with a little chroma carried into the neutrals, so the greys belong to the accent instead of merely sitting beside it. Values ship as hex because that is what the stylesheet speaks.

### Dark

| Token | Hex | OKLCH | Role |
|---|---|---|---|
| `--pc-ink` | `#0c1118` | 0.175 0.018 262 | page |
| `--pc-ink-2` | `#131821` | 0.208 0.020 262 | bottom nav, raised chrome |
| `--pc-surface` | `#1a202b` | 0.243 0.022 262 | cards |
| `--pc-surface-2` | `#242b37` | 0.288 0.024 262 | inputs, hover |
| `--pc-line` | `#313948` | 0.345 0.028 262 | hairlines |
| `--pc-fg` | `#f5f7f9` | 0.975 0.004 262 | primary text |
| `--pc-muted` | `#a9b0bb` | 0.755 0.018 262 | secondary text |
| `--pc-muted-2` | `#7c8491` | 0.610 0.022 262 | timestamps, hints |
| `--pc-brand` | `#0789f2` | 0.625 0.185 252 | accent |

The ground is deliberately deeper than the usual dark-UI grey. This is a wall of artwork, and every step darker underneath it is contrast the artwork gets for free.

### Light

`#f4f7fb` page, `#ffffff` cards, `#212938` text, `#60697b` secondary, `#677182` tertiary, `#0067da` accent.

### Status vocabulary — reserved

Green `--pc-success` delivered · red `--pc-danger` failed · amber `--pc-warn` pending. **The accent must never be confusable with any of them**, which is why the brand stays in the blue family: those three own the rest of the useful wheel.

### Contrast — measured, not assumed

Every text token clears 4.5:1 against its own background in both themes, tertiary text included. Measured in the browser, not by eye:

| | dark | light |
|---|---|---|
| primary text on page | 17.6 | 13.6 |
| secondary on page | 8.7 | 5.1 |
| tertiary on page | 5.0 | 4.6 |
| accent on page | 5.3 | 4.9 |
| **input placeholder** | **7.5** | **4.9** |

The accent carries white at bold weight on filled buttons (3.6:1, above the 3:1 large-text floor). Brand-as-text and white-on-brand pull in opposite directions; `#0789f2` is where both hold.

## Type

One family, many weights — `IBM Plex Sans Arabic` by default, with ten other Arabic faces selectable from the admin. No pairing: two Arabic sans faces on one screen is noise, not contrast.

**Arabic descenders are a layout constraint, not a detail.** `line-clamp` and `truncate` are `overflow: hidden`, and Arabic hangs a long way below the baseline — the dots under ي, the tail of و, the bowls of ج and ح. Tight leading crops exactly those and turns "ببجي" into a word missing its dots. Every clamped label carries generous leading plus bottom padding; see `TILE_LABEL_CLASS`.

### Numerals

Latin digits, always. Two utilities, and the difference matters:

- `.num` — `direction: ltr` + `unicode-bidi: isolate`. For a bare number that must not be reordered by the text around it.
- `.tnum` — tabular figures only, no direction opinion. For dates and anything where an isolated run would throw the day to the wrong side of the month.

Money reads `12.5 د.ل` — symbol to the **left** of the number, which is not what RTL would do on its own. `MoneyText` composes the two runs by hand.

## Motion

`--ease-smooth: cubic-bezier(0.22, 1, 0.36, 1)` — ease-out quint. No bounce.

- **Page slides**, 500ms: forward enters from the left, back from the right. Physical direction, deliberately not mirrored for RTL.
- **Grid reveal**, 460ms with a 30ms stagger capped at twelve tiles. It runs on load, not on an observer, so a headless render or a background tab never leaves the shop blank.
- Every animation has a `prefers-reduced-motion` path.

## Components

Cards where a card is the right affordance, and nowhere else. The cart, the order list and the support thread deliberately use dividers and bare rows instead — nested cards are always wrong.

- **Tiles** (`tile-layout.ts`) — square artwork on `bg-ink`, never `bg-surface`: category art is transparent PNG, and a white square would show through the cut-outs in light mode.
- **Bottom navigation** — five tabs, hidden entirely on the support chat, which owns its screen.
- **Composer** (support) — 16px font, because iOS zooms the page on any field below that and the zoom is what makes the screen lurch. It rides on `--pc-keyboard`, written from the visual viewport, so it sits on the keyboard instead of under it.
- **Empty states** are drawn inline as flat SVG — cheaper than an image request, sharp at any size, and they take the theme with them.

## Anti-patterns in this codebase

Do not introduce: gradient text, glassmorphism as decoration, side-stripe accent borders, uppercase tracked eyebrows above sections, hero metrics, or a second typeface.
