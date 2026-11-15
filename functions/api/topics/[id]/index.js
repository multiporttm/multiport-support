/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export async function onRequestGet({ params, env }) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) {
    return Response.json({ error: 'invalid topic id' }, { status: 400 });
  }

  const topic = await env.DB.prepare(
    `SELECT t.id, t.title, t.body, t.author_name, t.created_at, t.reply_count,
            c.name AS category_name, c.slug AS category_slug
     FROM topics t
     JOIN categories c ON c.id = t.category_id
     WHERE t.id = ?`
  ).bind(id).first();

  if (!topic) {
    return Response.json({ error: 'topic not found' }, { status: 404 });
  }

  const { results: replies } = await env.DB.prepare(
    `SELECT id, body, author_name, created_at
     FROM replies
     WHERE topic_id = ?
     ORDER BY created_at ASC`
  ).bind(id).all();

  return Response.json({ topic, replies });
}
