# PLUS CARD

## Register

**Product.** Every screen is a step in buying something: browse → pick a denomination → pay from the wallet → read the code. Design serves the transaction; it is not the thing being sold.

## What it is

An Arabic (RTL) storefront for digital goods in Libya — telecom top-ups, game currency, streaming and store gift cards. A customer funds a wallet, spends it on a card, and receives the code in the app. Fulfilment is automatic through supplier APIs, with per-line refunds when a supplier fails.

There is a full admin behind it: catalog, suppliers and their pricing rules, orders, wallet top-up review, users, and support.

## Who uses it

**The customer.** On a phone, in Arabic, almost always at night, often in a hurry — a game top-up before friends start a match, credit before a call. The scene that decides the design: a dim room, one hand on the phone, thirty seconds of patience. Dark is the default theme for that reason, not for fashion.

They are not shopping. They know what they want before they open the app. Every screen is measured by how little it delays them.

**The shop owner.** One person running the whole thing from the admin on a laptop, checking top-up receipts and answering support between other work.

## What it must feel like

- **Fast and certain.** Prices that do not change under you, a code that appears where you expect it, a refund that happens without asking.
- **Quiet.** The products are loud — game art, telecom logos in magenta and green. The interface is the frame, never a competing voice.
- **Local.** Arabic first, Libyan dinar, numerals that read the way a Libyan reads them.

Three words: **quick, trustworthy, unfussy.**

## Anti-references

- **Crypto / fintech dashboards.** Charts, gradients, glass panels, a hero metric. Nothing here is a dashboard.
- **The purple SaaS storefront.** The nearest local competitor is violet and heavily carded; matching it would make the shop look like a clone.
- **Loud sales pressure.** No countdowns, no fake scarcity, no "only 3 left".
- **Anything that makes the customer read.** Long explanations on a screen whose only job is to hand over a code.

## Constraints that shape the design

- **RTL throughout**, including the parts that must *not* mirror: money reads `12.5 د.ل` with the symbol on the left of the number, and the page-slide direction is physical, not logical.
- **Arabic descenders clip easily.** Any line-clamp or truncate needs breathing room under the baseline; this has bitten the project more than once.
- **The status vocabulary is spoken for.** Green means delivered, red means failed, amber means pending. The brand accent must never be confusable with any of them.
- **Product artwork carries the colour.** The palette works underneath it, not against it.

## Accessibility

Body text at 4.5:1 or better against its own background, in both themes — tertiary text included, which is where this project was failing. Every animation has a reduced-motion path. Touch targets stay finger-sized (40px minimum) on a phone held one-handed.
