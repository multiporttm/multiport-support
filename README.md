# Multiport Support

A lightweight, Apple Discussions–style community support board for Multiport.
Anyone can browse and post — starting a topic or replying requires no account,
just an optional display name (defaults to "Anonymous").

Built on **Cloudflare Pages** (static frontend + Pages Functions API) and
**Cloudflare D1** (SQLite-compatible database) for storage.

## Structure

- `public/` — static frontend (vanilla HTML/CSS/JS, hash-based router)
- `functions/api/` — Pages Functions API routes
  - `GET /api/categories`
  - `GET /api/topics?category=<slug>`
  - `POST /api/topics` — create a topic `{ category, title, body, author_name }`
  - `GET /api/topics/:id` — topic + its replies
  - `POST /api/topics/:id/replies` — post a reply `{ body, author_name }`
- `migrations/` — D1 schema + seed data for the default categories

## Local setup

1. Install dependencies:
   ```
   npm install
   ```
2. Create the D1 database (one-time):
   ```
   npx wrangler d1 create multiport-support-db
   ```
   Copy the `database_id` it prints into `wrangler.toml`.
3. Apply the schema locally:
   ```
   npm run db:migrate:local
   ```
4. Run the dev server:
   ```
   npm run dev
   ```
   Visit the printed local URL.

## Deploying

1. Apply migrations to the remote (production) database:
   ```
   npm run db:migrate:remote
   ```
2. Deploy:
   ```
   npm run deploy
   ```

This deploys the `public/` directory as a Cloudflare Pages project with the
`functions/` directory automatically wired up as the API, bound to the `DB`
D1 database declared in `wrangler.toml`.

## Anonymous posting & spam protection

There is no login or account system. Every topic and reply stores only a
free-text display name (defaulting to "Anonymous") alongside the content.
Both the new-topic and reply forms include a hidden honeypot field to deter
basic spam bots, and input length is capped server-side.
