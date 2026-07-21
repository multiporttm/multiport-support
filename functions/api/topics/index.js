import { MAX_TITLE, MAX_BODY, cleanAuthorName } from '../_limits.js';
import { isLoggedIn, RESERVED_AUTHOR_NAME } from '../_auth.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const categorySlug = url.searchParams.get('category');

  if (!categorySlug) {
    return Response.json({ error: 'category is required' }, { status: 400 });
  }

  const category = await env.DB.prepare('SELECT id FROM categories WHERE slug = ?')
    .bind(categorySlug)
    .first();

  if (!category) {
    return Response.json({ error: 'category not found' }, { status: 404 });
  }

  const { results } = await env.DB.prepare(
    `SELECT id, title, author_name, created_at, last_activity_at, reply_count
     FROM topics
     WHERE category_id = ?
     ORDER BY last_activity_at DESC`
  ).bind(category.id).all();

  return Response.json(results);
}

export async function onRequestPost({ request, env }) {
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

  const title = String(data.title || '').trim();
  const body = String(data.body || '').trim();
  const categorySlug = String(data.category || '').trim();
  const requestedName = cleanAuthorName(data.author_name);

  if (!title || !body || !categorySlug) {
    return Response.json({ error: 'title, body, and category are required' }, { status: 400 });
  }
  if (title.length > MAX_TITLE || body.length > MAX_BODY) {
    return Response.json({ error: 'input too long' }, { status: 400 });
  }

  const loggedIn = await isLoggedIn(request, env);
  if (!loggedIn && requestedName.toLowerCase() === RESERVED_AUTHOR_NAME) {
    return Response.json(
      { error: '"Developer" is a reserved name. Please choose another name, or log in.' },
      { status: 403 }
    );
  }
  const authorName = loggedIn ? 'Developer' : requestedName;

  const category = await env.DB.prepare('SELECT id FROM categories WHERE slug = ?')
    .bind(categorySlug)
    .first();

  if (!category) {
    return Response.json({ error: 'category not found' }, { status: 404 });
  }

  const result = await env.DB.prepare(
    `INSERT INTO topics (category_id, title, body, author_name) VALUES (?, ?, ?, ?)`
  ).bind(category.id, title, body, authorName).run();

  return Response.json({ id: result.meta.last_row_id }, { status: 201 });
}
