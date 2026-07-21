import { MAX_BODY, cleanAuthorName } from '../../_limits.js';

export async function onRequestPost({ request, env, params }) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) {
    return Response.json({ error: 'invalid topic id' }, { status: 400 });
  }

  let data;
  try {
    data = await request.json();
  } catch {
    return Response.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  // Honeypot field: real users never fill this in. Pretend success to bots.
  if (data.website) {
    return Response.json({ id: 0 }, { status: 201 });
  }

  const body = String(data.body || '').trim();
  const authorName = cleanAuthorName(data.author_name);

  if (!body) {
    return Response.json({ error: 'body is required' }, { status: 400 });
  }
  if (body.length > MAX_BODY) {
    return Response.json({ error: 'input too long' }, { status: 400 });
  }

  const topic = await env.DB.prepare('SELECT id FROM topics WHERE id = ?').bind(id).first();
  if (!topic) {
    return Response.json({ error: 'topic not found' }, { status: 404 });
  }

  const result = await env.DB.prepare(
    `INSERT INTO replies (topic_id, body, author_name) VALUES (?, ?, ?)`
  ).bind(id, body, authorName).run();

  await env.DB.prepare(
    `UPDATE topics SET reply_count = reply_count + 1, last_activity_at = datetime('now') WHERE id = ?`
  ).bind(id).run();

  return Response.json({ id: result.meta.last_row_id }, { status: 201 });
}
