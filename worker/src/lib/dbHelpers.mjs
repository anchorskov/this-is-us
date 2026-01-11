/**
 * Helper to safely retrieve a D1 binding by name, defaulting to WY_DB.
 * Allows defensive coding when bindings are misconfigured.
 */
export function getDb(env, name = "WY_DB") {
  if (!env) return null;
  if (env[name]) return env[name];
  if (env.WY_DB) return env.WY_DB;
  return null;
}

export function getCivicDb(env) {
  return getDb(env, "WY_DB");
}

export function getEventsDb(env) {
  return getDb(env, "EVENTS_DB");
}

export async function hasTable(db, table) {
  if (!db || !table) return false;
  try {
    const res = await db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=? LIMIT 1`)
      .bind(table)
      .first();
    return !!res?.name;
  } catch {
    return false;
  }
}

export async function hasColumn(db, table, column) {
  if (!db || !table || !column) return false;
  try {
    const res = await db
      .prepare(`PRAGMA table_info(${table})`)
      .all();
    const columns = res?.results?.map((row) => row.name) || [];
    return columns.includes(column);
  } catch {
    return false;
  }
}
