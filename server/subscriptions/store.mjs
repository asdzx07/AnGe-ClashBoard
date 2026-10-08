// 订阅管理：SQLite 存储。表由 ensureTables 创建，幂等。
export function ensureTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      refresh_interval_hours INTEGER NOT NULL DEFAULT 24,
      last_fetched_at TEXT,
      last_node_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS subscription_contents (
      subscription_id INTEGER PRIMARY KEY,
      content TEXT NOT NULL,
      fetched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE
    )
  `);
}

export function listSubscriptions(db) {
  return db
    .prepare(
      `SELECT id, name, url, enabled, refresh_interval_hours,
              last_fetched_at, last_node_count, last_error,
              created_at, updated_at
       FROM subscriptions ORDER BY id`,
    )
    .all()
    .map((r) => ({ ...r, enabled: !!r.enabled }));
}

export function addSubscription(db, { name, url, refresh_interval_hours = 24 }) {
  if (!name?.trim()) throw new Error('name 不能为空');
  if (!/^https?:\/\//i.test(url?.trim() || '')) throw new Error('url 必须是 http(s) 地址');
  const r = db
    .prepare(
      `INSERT INTO subscriptions (name, url, refresh_interval_hours)
       VALUES (?, ?, ?)`,
    )
    .run(name.trim(), url.trim(), refresh_interval_hours);
  return getSubscription(db, Number(r.lastInsertRowid));
}

export function getSubscription(db, id) {
  const row = db
    .prepare(`SELECT * FROM subscriptions WHERE id = ?`)
    .get(id);
  return row ? { ...row, enabled: !!row.enabled } : null;
}

export function updateSubscription(db, id, patch) {
  const cur = getSubscription(db, id);
  if (!cur) return null;
  const next = {
    name: patch.name?.trim() || cur.name,
    url: patch.url?.trim() || cur.url,
    enabled: patch.enabled === undefined ? cur.enabled : !!patch.enabled,
    refresh_interval_hours: patch.refresh_interval_hours ?? cur.refresh_interval_hours,
  };
  if (!/^https?:\/\//i.test(next.url)) throw new Error('url 必须是 http(s) 地址');
  db.prepare(
    `UPDATE subscriptions
     SET name = ?, url = ?, enabled = ?, refresh_interval_hours = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
  ).run(next.name, next.url, next.enabled ? 1 : 0, next.refresh_interval_hours, id);
  return getSubscription(db, id);
}

export function deleteSubscription(db, id) {
  db.prepare(`DELETE FROM subscription_contents WHERE subscription_id = ?`).run(id);
  const r = db.prepare(`DELETE FROM subscriptions WHERE id = ?`).run(id);
  return r.changes > 0;
}

/** 记录一次拉取结果：成功存内容，失败只记错误 */
export function recordFetch(db, id, { content = null, nodeCount = 0, error = null }) {
  const now = new Date().toISOString();
  if (content !== null) {
    db.prepare(
      `INSERT INTO subscription_contents (subscription_id, content, fetched_at)
       VALUES (?, ?, ?)
       ON CONFLICT (subscription_id) DO UPDATE
       SET content = excluded.content, fetched_at = excluded.fetched_at`,
    ).run(id, content, now);
  }
  db.prepare(
    `UPDATE subscriptions
     SET last_fetched_at = ?, last_node_count = ?, last_error = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
  ).run(now, nodeCount, error, id);
  return getSubscription(db, id);
}

/** 取最后一次拉取到的原始内容 */
export function getContent(db, id) {
  const row = db
    .prepare(`SELECT content, fetched_at FROM subscription_contents WHERE subscription_id = ?`)
    .get(id);
  return row || null;
}
