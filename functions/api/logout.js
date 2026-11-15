/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { destroySession, clearSessionCookieHeader } from './_auth.js';

export async function onRequestPost({ request, env }) {
  await destroySession(request, env);
  const headers = new Headers({ 'Content-Type': 'application/json' });
  headers.append('Set-Cookie', clearSessionCookieHeader(request));
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
