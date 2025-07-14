// worker/src/db/users.js

/**
 * Upsert user preferences based on Firebase UID.
 * If the user already exists, updates fields; otherwise inserts a new row.
 */
export async function upsertUserPreferences(env, { uid, email, city, state }) {
  const stmt = env.EVENTS_DB.prepare(`
    INSERT INTO user_preferences (firebase_uid, email, city, state, last_updated)
    VALUES (?1, ?2, ?3, ?4, CURRENT_TIMESTAMP)
    ON CONFLICT(firebase_uid) DO UPDATE SET
      email = ?2,
      city = ?3,
      state = ?4,
      last_updated = CURRENT_TIMESTAMP
  `);
  return await stmt.bind(uid, email, city ?? null, state ?? null).run();
}

/**
 * Retrieve user preferences by Firebase UID.
 * Returns null if not found.
 */
export async function getUserPreferences(env, uid) {
  const stmt = env.EVENTS_DB.prepare(`
    SELECT firebase_uid, email, theme, notifications_enabled, last_updated
    FROM user_preferences WHERE firebase_uid = ?1
  `);
  const result = await stmt.bind(uid).first();
  return result ?? null;
}
