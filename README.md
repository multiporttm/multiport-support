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
  - `GET /api/push/vapid-public-key` — public key for `pushManager.subscribe`
  - `POST /api/push/subscribe` — store a push subscription (developer session required)
  - `POST /api/push/unsubscribe` — remove a push subscription
- `migrations/` — D1 schema + seed data for the default categories
- `public/sw.js` — service worker that shows push notifications
- `public/icons/`, `public/manifest.json` — Home Screen icon + PWA manifest

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

## Home Screen icon

`public/manifest.json` + `public/icons/*.png` + the `<link rel="apple-touch-icon">`
tag in `index.html` give the site a proper icon (a speech-bubble/question-mark
mark) when added to a phone's Home Screen, instead of a screenshot thumbnail.
The source SVG isn't checked in — if you want to change the design, regenerate
the PNGs with `sharp` (or any SVG rasterizer) at 16/32/180/192/512px into
`public/icons/`.

## Developer push notifications

While logged in as Developer, you can turn on real push notifications (via
the "Enable notifications" link next to the "Logged in as Developer" badge)
for new topics and new replies anywhere on the site — they arrive even when
the site isn't open, using the Web Push API and a service worker
(`public/sw.js`). On iOS this requires adding the site to your Home Screen
first (iOS only allows web push for installed PWAs).

This needs a VAPID key pair (the identity keys the server signs push
requests with). Unlike `DEV_PASSWORD`, these are hardcoded directly in
`functions/api/_push.js` rather than read from an environment
variable/secret — this repo is public, so the private key is visible to
anyone who looks at the source. In practice that's low-risk here (signing
push requests alone isn't enough to reach a real subscriber without also
having their subscription record from the database), but if that ever
matters, rotate to a fresh pair:

```js
const { webcrypto } = require('node:crypto');
const subtle = webcrypto.subtle;
const b64url = (buf) => Buffer.from(buf).toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

(async () => {
  const keyPair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  console.log('VAPID_PUBLIC_KEY=' + b64url(await subtle.exportKey('raw', keyPair.publicKey)));
  console.log('VAPID_PRIVATE_KEY_JWK=' + JSON.stringify(await subtle.exportKey('jwk', keyPair.privateKey)));
})();
```

...and paste the new values into the `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY_JWK`
constants at the top of `functions/api/_push.js`. `VAPID_SUBJECT` (a `mailto:`
contact address included in push requests) is also a constant there, defaulting
to `mailto:admin@multiportllc.com`.

Push subscriptions are stored in the `push_subscriptions` D1 table
(`migrations/0003_push.sql`); a subscription that a push service reports as
gone (404/410) is pruned automatically the next time a notification is sent.
