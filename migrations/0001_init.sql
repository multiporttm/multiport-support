-- Initial schema for Multiport Support (anonymous discussion board)

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  author_name TEXT NOT NULL DEFAULT 'Anonymous',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_activity_at TEXT NOT NULL DEFAULT (datetime('now')),
  reply_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL REFERENCES topics(id),
  body TEXT NOT NULL,
  author_name TEXT NOT NULL DEFAULT 'Anonymous',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_topics_category ON topics(category_id);
CREATE INDEX IF NOT EXISTS idx_topics_last_activity ON topics(last_activity_at);
CREATE INDEX IF NOT EXISTS idx_replies_topic ON replies(topic_id);

INSERT INTO categories (slug, name, description, sort_order) VALUES
  ('getting-started', 'Getting Started', 'New to Multiport? Ask setup and onboarding questions here.', 1),
  ('troubleshooting', 'Troubleshooting', 'Having an issue? Get help from the community.', 2),
  ('feature-requests', 'Feature Requests', 'Suggest new features and improvements.', 3),
  ('general-discussion', 'General Discussion', 'Anything else Multiport related.', 4);
