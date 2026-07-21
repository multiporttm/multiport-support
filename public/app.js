const app = document.getElementById('app');
let loggedIn = false;

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(sqlUtcString) {
  if (!sqlUtcString) return '';
  const iso = sqlUtcString.replace(' ', 'T') + 'Z';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return sqlUtcString;
  return d.toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}

async function api(path, options) {
  const res = await fetch(path, options);
  let data = null;
  try { data = await res.json(); } catch { /* no body */ }
  if (!res.ok) {
    const message = (data && data.error) || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

function render(html) {
  app.innerHTML = html;
}

function breadcrumbs(items) {
  const parts = items.map((item, i) => {
    if (i === items.length - 1) return `<span>${escapeHtml(item.label)}</span>`;
    return `<a href="#${item.href}">${escapeHtml(item.label)}</a>`;
  });
  return `<div class="breadcrumbs">${parts.join('<span class="sep">/</span>')}</div>`;
}

function quoteOf(authorName, body) {
  const quoted = body.split('\n').map(line => `> ${line}`).join('\n');
  return `${authorName} wrote:\n${quoted}\n\n`;
}

// ---- Auth ----

async function refreshAuthStatus() {
  try {
    const session = await api('/api/session');
    loggedIn = !!session.loggedIn;
  } catch {
    loggedIn = false;
  }
  renderAuthStatus();
}

function renderAuthStatus() {
  const el = document.getElementById('auth-status');
  if (!el) return;
  if (loggedIn) {
    el.innerHTML = `<span class="dev-badge">Logged in as Developer</span><a href="#" id="logout-link">Log out</a>`;
    document.getElementById('logout-link').addEventListener('click', async (e) => {
      e.preventDefault();
      try { await api('/api/logout', { method: 'POST' }); } catch { /* ignore */ }
      loggedIn = false;
      renderAuthStatus();
      router();
    });
  } else {
    el.innerHTML = `<a href="#/login">Developer log in</a>`;
  }
}

async function renderLogin() {
  render(`
    <h1 class="page-title">Developer log in</h1>
    <p class="page-desc">This is just for the site owner. Replies and topics posted while logged in show as "Developer" instead of a made-up name.</p>
    <form id="login-form" class="stack">
      <label>Password
        <input type="password" name="password" required autofocus>
      </label>
      <div class="form-error" id="login-error"></div>
      <div class="form-actions">
        <a class="btn secondary" href="#/">Cancel</a>
        <button type="submit" class="btn">Log in</button>
      </div>
    </form>
  `);

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const errorEl = document.getElementById('login-error');
    errorEl.textContent = '';
    try {
      await api('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: form.password.value }),
      });
      loggedIn = true;
      renderAuthStatus();
      location.hash = '#/';
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });
}

// ---- Views ----

async function renderHome() {
  render('<div class="loading">Loading communities…</div>');
  let categories;
  try {
    categories = await api('/api/categories');
  } catch (err) {
    render(`<div class="empty-state">Couldn't load communities: ${escapeHtml(err.message)}</div>`);
    return;
  }

  const cards = categories.map(c => `
    <div class="card">
      <h2 class="card-title"><a href="#/c/${encodeURIComponent(c.slug)}">${escapeHtml(c.name)}</a></h2>
      <p class="card-desc">${escapeHtml(c.description)}</p>
      <div class="card-meta">${c.topic_count} topic${c.topic_count === 1 ? '' : 's'}${c.last_activity_at ? ' · last activity ' + escapeHtml(formatDate(c.last_activity_at)) : ''}</div>
    </div>
  `).join('');

  render(`
    <h1 class="page-title">Communities</h1>
    <p class="page-desc">Pick a topic area to browse questions, or start a new one. Anyone can post — no account required.</p>
    <div class="card-list">${cards || '<div class="empty-state">No communities yet.</div>'}</div>
  `);
}

async function renderCategory(slug) {
  render('<div class="loading">Loading topics…</div>');
  let categories, topics;
  try {
    categories = await api('/api/categories');
    topics = await api(`/api/topics?category=${encodeURIComponent(slug)}`);
  } catch (err) {
    render(`<div class="empty-state">Couldn't load topics: ${escapeHtml(err.message)}</div>`);
    return;
  }

  const category = categories.find(c => c.slug === slug);
  const categoryName = category ? category.name : slug;

  const rows = topics.map(t => `
    <div class="card">
      <h2 class="card-title"><a href="#/t/${t.id}">${escapeHtml(t.title)}</a></h2>
      <div class="card-meta">by ${escapeHtml(t.author_name)} · ${t.reply_count} repl${t.reply_count === 1 ? 'y' : 'ies'} · last activity ${escapeHtml(formatDate(t.last_activity_at))}</div>
    </div>
  `).join('');

  render(`
    ${breadcrumbs([{ label: 'Communities', href: '/' }, { label: categoryName, href: `/c/${slug}` }])}
    <div class="toolbar">
      <div>
        <h1 class="page-title">${escapeHtml(categoryName)}</h1>
        ${category ? `<p class="page-desc">${escapeHtml(category.description)}</p>` : ''}
      </div>
      <a class="btn" href="#/c/${encodeURIComponent(slug)}/new">Ask a question</a>
    </div>
    <div class="card-list">${rows || '<div class="empty-state">No topics yet. Be the first to ask!</div>'}</div>
  `);
}

async function renderNewTopic(slug) {
  render('<div class="loading">Loading…</div>');
  let categories;
  try {
    categories = await api('/api/categories');
  } catch (err) {
    render(`<div class="empty-state">${escapeHtml(err.message)}</div>`);
    return;
  }
  const category = categories.find(c => c.slug === slug);
  const categoryName = category ? category.name : slug;

  render(`
    ${breadcrumbs([{ label: 'Communities', href: '/' }, { label: categoryName, href: `/c/${slug}` }, { label: 'New topic', href: `/c/${slug}/new` }])}
    <h1 class="page-title">Ask a question</h1>
    <p class="page-desc">Posting in <strong>${escapeHtml(categoryName)}</strong>. No account needed — you can post as Anonymous.</p>
    <form id="new-topic-form" class="stack">
      ${loggedIn
        ? '<div class="dev-badge">Posting as Developer</div>'
        : `<label>Your name (optional)
        <input type="text" name="author_name" placeholder="Anonymous" maxlength="60">
      </label>`}
      <label>Title
        <input type="text" name="title" required maxlength="200">
      </label>
      <label>Details
        <textarea name="body" required rows="8" maxlength="10000"></textarea>
      </label>
      <label class="hp-field" aria-hidden="true">Website
        <input type="text" name="website" tabindex="-1" autocomplete="off">
      </label>
      <div class="form-error" id="new-topic-error"></div>
      <div class="form-actions">
        <a class="btn secondary" href="#/c/${encodeURIComponent(slug)}">Cancel</a>
        <button type="submit" class="btn">Post question</button>
      </div>
    </form>
  `);

  document.getElementById('new-topic-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const errorEl = document.getElementById('new-topic-error');
    errorEl.textContent = '';
    const payload = {
      category: slug,
      author_name: form.author_name ? form.author_name.value : '',
      title: form.title.value,
      body: form.body.value,
      website: form.website.value,
    };
    try {
      const result = await api('/api/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      location.hash = `#/t/${result.id}`;
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });
}

async function renderTopic(id) {
  render('<div class="loading">Loading topic…</div>');
  let data;
  try {
    data = await api(`/api/topics/${encodeURIComponent(id)}`);
  } catch (err) {
    render(`<div class="empty-state">Couldn't load topic: ${escapeHtml(err.message)}</div>`);
    return;
  }

  const { topic, replies } = data;

  const repliesHtml = replies.map((r, idx) => `
    <div class="reply">
      <div class="post-author">${escapeHtml(r.author_name)}</div>
      <div class="post-meta">${escapeHtml(formatDate(r.created_at))}</div>
      <p class="post-body">${escapeHtml(r.body)}</p>
      <button type="button" class="link-btn quote-btn" data-idx="${idx}">Reply</button>
    </div>
  `).join('');

  render(`
    ${breadcrumbs([
      { label: 'Communities', href: '/' },
      { label: topic.category_name, href: `/c/${topic.category_slug}` },
      { label: topic.title, href: `/t/${topic.id}` },
    ])}
    <div class="topic-post">
      <h1 class="page-title">${escapeHtml(topic.title)}</h1>
      <div class="post-author">${escapeHtml(topic.author_name)}</div>
      <div class="post-meta">${escapeHtml(formatDate(topic.created_at))}</div>
      <p class="post-body">${escapeHtml(topic.body)}</p>
      <button type="button" class="link-btn quote-btn" data-idx="topic">Reply</button>
    </div>

    <h2 class="replies-heading">${replies.length} repl${replies.length === 1 ? 'y' : 'ies'}</h2>
    ${repliesHtml}

    <form id="reply-form" class="stack">
      ${loggedIn
        ? '<div class="dev-badge">Posting as Developer</div>'
        : `<label>Your name (optional)
        <input type="text" name="author_name" placeholder="Anonymous" maxlength="60">
      </label>`}
      <label>Your reply
        <textarea name="body" required rows="5" maxlength="10000"></textarea>
      </label>
      <label class="hp-field" aria-hidden="true">Website
        <input type="text" name="website" tabindex="-1" autocomplete="off">
      </label>
      <div class="form-error" id="reply-error"></div>
      <div class="form-actions">
        <button type="submit" class="btn">Post reply</button>
      </div>
    </form>
  `);

  document.querySelectorAll('.quote-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = btn.getAttribute('data-idx');
      const source = idx === 'topic' ? topic : replies[Number(idx)];
      const textarea = document.querySelector('#reply-form textarea[name=body]');
      textarea.value = quoteOf(source.author_name, source.body);
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });

  document.getElementById('reply-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const errorEl = document.getElementById('reply-error');
    errorEl.textContent = '';
    const payload = {
      author_name: form.author_name ? form.author_name.value : '',
      body: form.body.value,
      website: form.website.value,
    };
    try {
      await api(`/api/topics/${encodeURIComponent(id)}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      renderTopic(id);
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });
}

// ---- Router ----

function router() {
  const hash = location.hash.replace(/^#/, '') || '/';
  const newTopicMatch = hash.match(/^\/c\/([^/]+)\/new$/);
  const categoryMatch = hash.match(/^\/c\/([^/]+)$/);
  const topicMatch = hash.match(/^\/t\/(\d+)$/);

  window.scrollTo(0, 0);

  if (hash === '/') {
    renderHome();
  } else if (hash === '/login') {
    renderLogin();
  } else if (newTopicMatch) {
    renderNewTopic(decodeURIComponent(newTopicMatch[1]));
  } else if (categoryMatch) {
    renderCategory(decodeURIComponent(categoryMatch[1]));
  } else if (topicMatch) {
    renderTopic(topicMatch[1]);
  } else {
    render('<div class="empty-state">Page not found. <a href="#/">Go home</a></div>');
  }
}

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', async () => {
  await refreshAuthStatus();
  router();
});
