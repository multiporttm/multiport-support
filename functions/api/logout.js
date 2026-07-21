import { destroySession, clearSessionCookieHeader } from './_auth.js';

export async function onRequestPost({ request, env }) {
  await destroySession(request, env);
  const headers = new Headers({ 'Content-Type': 'application/json' });
  headers.append('Set-Cookie', clearSessionCookieHeader(request));
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
