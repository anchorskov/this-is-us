// worker/src/townhall/verifiedUserHelper.mjs
// Helper functions for verified voter checks in Town Hall operations

/**
 * Get verified user record from D1
 * @param {Object} env - Cloudflare environment with WY_DB binding
 * @param {string} userId - Firebase user ID
 * @returns {Promise<Object|null>} Verified user object or null if not verified
 */
export async function getVerifiedUser(env, userId) {
  if (!userId || !env.WY_DB) {
    return null;
  }

  try {
    const { results } = await env.WY_DB.prepare(`
      SELECT
        user_id as userId,
        voter_id as voterId,
        county,
        house,
        senate,
        verified_at as verifiedAt,
        status
      FROM verified_users
      WHERE user_id = ?1 AND status = 'verified'
      LIMIT 1
    `)
      .bind(userId)
      .all();

    return results && results.length > 0 ? results[0] : null;
  } catch (err) {
    console.error(`[verifiedUserHelper] Error checking verified status for ${userId}:`, err);
    return null;
  }
}

/**
 * Create a verified user record after voter verification
 * @param {Object} env - Cloudflare environment with WY_DB binding
 * @param {string} userId - Firebase user ID
 * @param {string} voterId - voter_id from voters_addr_norm
 * @param {Object} voterInfo - Optional object with { county, house, senate }
 * @returns {Promise<boolean>} true if created successfully, false otherwise
 */
export async function createVerifiedUser(env, userId, voterId, voterInfo = {}) {
  if (!userId || !voterId || !env.WY_DB) {
    return false;
  }

  try {
    const verifiedAt = new Date().toISOString();
    const { county, house, senate } = voterInfo;

    await env.WY_DB.prepare(`
      INSERT INTO verified_users (
        user_id,
        voter_id,
        county,
        house,
        senate,
        verified_at,
        status
      )
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'verified')
    `)
      .bind(userId, voterId, county || null, house || null, senate || null, verifiedAt)
      .run();

    return true;
  } catch (err) {
    console.error(
      `[verifiedUserHelper] Error creating verified user ${userId}:`,
      err
    );
    return false;
  }
}

/**
 * Revoke verified status for a user
 * @param {Object} env - Cloudflare environment with WY_DB binding
 * @param {string} userId - Firebase user ID
 * @returns {Promise<boolean>} true if revoked successfully, false otherwise
 */
export async function revokeVerifiedUser(env, userId) {
  if (!userId || !env.WY_DB) {
    return false;
  }

  try {
    await env.WY_DB.prepare(`
      UPDATE verified_users
      SET status = 'revoked'
      WHERE user_id = ?1
    `)
      .bind(userId)
      .run();

    return true;
  } catch (err) {
    console.error(
      `[verifiedUserHelper] Error revoking verified user ${userId}:`,
      err
    );
    return false;
  }
}
