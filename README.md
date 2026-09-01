# PLUS CARD — سوق البطاقات الرقمية

Arabic-first (RTL), mobile-first gift-card marketplace. Dark premium UI, orange accent, fully
database-driven — no hardcoded categories, products, banners, prices or balances.

## Stack

- **Next.js 16** (App Router, TypeScript) — storefront, admin dashboard and API in one codebase
- **Tailwind CSS v4** — design tokens in `src/app/globals.css`
- **Prisma 7 + SQLite** (dev) — swap the adapter/provider for PostgreSQL in production
- **jose + bcryptjs** — JWT session cookie, `USER` / `ADMIN` roles
- **Embla Carousel** — banner slider (RTL, swipe, autoplay)
- **Zod** — request/form validation · **Sonner** — toasts · **lucide-react** — UI icons only

## Getting started

```bash
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

Open <http://localhost:3000>.

Seeded accounts:

| Role  | Email               | Password     |
| ----- | ------------------- | ------------ |
| Admin | admin@pluscard.ly   | Admin@12345  |
| User  | user@pluscard.ly    | User@12345   |

## Scripts

| Script               | Purpose                          |
| -------------------- | -------------------------------- |
| `npm run dev`        | Development server               |
| `npm run build`      | Production build                 |
| `npm run typecheck`  | TypeScript check                 |
| `npm run db:migrate` | Create/apply a Prisma migration  |
| `npm run db:seed`    | Seed baseline data               |
| `npm run db:studio`  | Prisma Studio (browse the DB)    |

## Project structure

```
prisma/            schema.prisma · migrations · seed.ts
public/uploads/    banners/ · categories/ · products/   (admin-uploaded artwork, git-ignored)
src/
  app/
    (shop)/        storefront: home · category/[slug] · product/[slug] · search
    api/           route handlers
  components/
    shop/          storefront components
    ui/            shared primitives
  lib/             db · session · money · search · queries · utils
  generated/prisma Prisma client (generated, git-ignored)
```

## Conventions

- **Money is always an integer in minor units** — `1.00 د.ل === 100`. Convert at the edges with
  `toMinor` / `formatMoney` from `src/lib/money.ts`. Never store floats.
- **Artwork is uploaded, never coded.** Category and product images come from the database
  (`/uploads/...`). No emojis and no icon-library artwork for categories or products —
  `lucide-react` is limited to interface chrome (nav, search, heart).
- **RTL first.** Use logical properties (`ps-*`, `pe-*`, `start-*`, `end-*`), never `left`/`right`.
  Numbers and prices get the `.num` class so they stay latin/LTR inside Arabic text.
- Storefront pages live in the `(shop)` group so they all inherit the header + bottom navigation.

## Environment

Copy `.env.example` to `.env`:

- `DATABASE_URL` — SQLite file in dev, PostgreSQL URL in production
- `AUTH_SECRET` — 32+ characters, required in production

## Switching to PostgreSQL

1. `datasource db { provider = "postgresql" }` in `prisma/schema.prisma`
2. `npm i @prisma/adapter-pg pg` and use `PrismaPg` in `src/lib/db.ts`
3. Point `DATABASE_URL` at the database and run `npx prisma migrate deploy`

## Build stages

1. ✅ Project setup, RTL + dark theme, database schema
2. ✅ Homepage — header search, banner slider, main categories, `كل الفئات` 3-column grid, bottom nav
3. ✅ Category page, search results page, product/denomination selection page
4. ✅ Global shopping cart — instant `+ / −` quantity control, floating cart bar, cart page
5. ✅ Authentication — email/password + OTP verification, password reset, Google & Apple OAuth
6. ⏳ Favorites, checkout, wallet, orders (placeholder pages exist today)
7. ✅ Admin dashboard — categories, products, variants + device image uploads (banners/orders/users/transactions are read-only for now)
8. ✅ Dark / Light / System appearance and the left→right page transition

## Admin dashboard

`/admin`, reachable from الحساب when signed in as an administrator.

- **Access**: `src/middleware.ts` rejects `/admin` and `/api/admin/*` before anything renders,
  and `requireAdminPage()` / `assertAdmin()` re-check the role against the database in every
  page and server action — the middleware is a fast gate, the server guard is the authority.
- **Promote an account**: `npm run db:make-admin -- someone@example.com` (the seeded
  `admin@pluscard.ly` is already an administrator).
- **Images**: choose a file on the device → preview → save. Uploads are validated by magic
  bytes (PNG/JPG/WebP, ≤ 4 MB), stored under a generated UUID name in
  `public/uploads/<categories|products|banners>/`, and the public path is written to the
  database. Replaced or deleted artwork is removed from disk.

## Appearance

Three modes — داكن / فاتح / حسب الجهاز — chosen in الحساب and stored in `localStorage`.
Every colour is a CSS variable (`--pc-*`) mapped through Tailwind's `@theme inline`, so the two
palettes share identical layout and dimensions. An inline boot script applies the saved theme
before first paint, and "system" keeps following the OS through a `matchMedia` listener.

## Page transition

Opening a category or product slides the new page in from the **left** to the right over 420ms
(`.page-enter-ltr` in `globals.css`, applied by `src/components/shop/page-transition.tsx`).
The direction is a physical `translateX`, deliberately not mirrored for RTL. The wrapper is keyed
by pathname, so it replays per navigation without touching router state, the cart or the session;
`overflow-x: clip` keeps it from ever widening the page, and `prefers-reduced-motion` disables it.

## Category artwork

Drop the four supplied images into `public/uploads/categories/`, named after the category slug:

```
public/uploads/categories/telecom.png     الاتصالات
public/uploads/categories/education.png   التعليم
public/uploads/categories/games.png       الألعاب
public/uploads/categories/stores.png      المتاجر
```

Then link them to the database rows (`.png`, `.jpg`, `.webp` and `.avif` are all accepted):

```bash
npm run db:images
```

## Layout rules

The search field, favorites heart and balance/login control belong to the **homepage only**
(`HomeHeader`) and are ordinary, non-sticky page content — they scroll away with the page.
Category, product and search pages render their own minimal header: a back arrow plus the title.
Only the bottom navigation and the floating cart bar are fixed.

## Authentication

Built on the project's own session (JWT in an httpOnly cookie) — no second auth stack.

- **Email + password** with bcrypt hashing (cost 12) and a 6-digit OTP email verification.
  Codes are HMAC-hashed, single-use, expire after 10 minutes, allow 5 attempts and have a
  60-second resend cooldown.
- **Password reset** by OTP. A successful reset bumps `users.sessionVersion`, which
  immediately invalidates every session issued before it.
- **Google / Apple** via real OAuth 2.0 + OIDC — authorization code with PKCE, `state` (CSRF)
  and `nonce` (replay), `id_token` verified against the provider JWKS. Secrets never leave the
  server. Providers are optional: with no credentials the buttons answer with an Arabic notice.
- **Account linking** keys on `(provider, providerAccountId)`. An email is only linked to an
  existing local account when the provider asserts the address is verified.
- **Rate limits** (database-backed) on login, OTP send and OTP verify. Redirect targets are
  validated, so `?next=` cannot be used as an open redirect.

Guests browse, search and fill the cart freely; authentication is required only at checkout.

## Cart architecture

One global cart for the whole storefront, provided by `CartProvider`
(`src/components/cart/cart-provider.tsx`) mounted in the `(shop)` layout:

- lines are keyed by **variantId**, so products from any number of categories coexist and
  pressing `+` on an existing variant increases its quantity instead of adding a second row
- `+ / −` mutate the cart immediately — no "update cart" step, no page reload
- persisted to `localStorage` through `src/lib/cart-storage.ts` (isolated so it can become the
  offline mirror of the authenticated user's `carts` / `cart_items` rows)
- `cartTotalQuantity` / `cartTotalPrice` in `src/lib/cart-types.ts` are pure functions reused by
  the floating bar, the nav badge and the cart page
- signing in merges the guest cart into the stored one **exactly once**: a `guest-dirty` flag is
  set whenever a signed-out visitor changes the cart and is claimed (and cleared) by the merge,
  so reloads and repeated effects load the stored cart instead of merging it into itself
