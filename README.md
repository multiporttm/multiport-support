# Multiport Support™

By Multiport LLC.

A lightweight, Apple Discussions–style community support board for Multiport.
Anyone can browse and post — starting a topic or replying requires no account.
Every post is attributed to "Anonymous"; there's no way to set a custom name.

Built on **Cloudflare Pages** (static frontend + Pages Functions API) and
**Cloudflare D1** (SQLite-compatible database) for storage.

## Structure

- `public/` — static frontend (vanilla HTML/CSS/JS, hash-based router)
- `functions/api/` — Pages Functions API routes
  - `GET /api/categories`
  - `GET /api/topics?category=<slug>`
  - `POST /api/topics` — create a topic `{ category, title, body }`
  - `GET /api/topics/:id` — topic + its replies
  - `POST /api/topics/:id/replies` — post a reply `{ body }`
  - `POST /api/login` — developer login `{ password }`, sets a session cookie
  - `POST /api/logout` — clears the session cookie
  - `GET /api/session` — `{ loggedIn: boolean }`
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

Nobody needs an account to browse or post. There's no name field at all —
every topic and reply is stored (and server-forced) as author "Anonymous"
unless posted from a logged-in developer session. Both the new-topic and
reply forms include a hidden honeypot field to deter basic spam bots, and
input length is capped server-side. The reply form on a topic also has a
"Reply" link under each post that quotes it into the textarea, so you can
reply directly to what someone said.

## Developer login

There's a single site-owner login (no username, just a password) at `#/login`.
Logging in makes everything you post show as **"Developer"** instead of
"Anonymous", so readers can tell when the site owner is responding. This is
enforced entirely server-side — the client never gets to choose the author
name, so there's no way for a regular visitor to post as "Developer".

The password is **not stored in this repo**. It's read from the `DEV_PASSWORD`
environment variable/secret at request time:

- **Locally**: already set in `.dev.vars` (git-ignored) for `npm run dev`.
- **Production**: set it once via
  ```
  npx wrangler pages secret put DEV_PASSWORD
  ```
  (or in the dashboard under Pages project → Settings → Environment variables →
  add `DEV_PASSWORD` as an **encrypted** variable). If it's never set, the
  login endpoint refuses all attempts instead of falling back to a default.

Login is rate-limited per IP address (tracked in the `login_attempts` D1
table from `migrations/0002_auth.sql`): **2 incorrect guesses locks that IP
out for 15 minutes** before it can try again. A successful login stores a
random session token in the `sessions` table and sets an HttpOnly cookie
(12-hour expiry); "Log out" in the header clears both.
