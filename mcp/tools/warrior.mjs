// mcp/src/tools/warrior.mjs
export default async function listWarriors({ location }, env) {
  // Use D1 to fetch by location (case-insensitive partial match)
  const { results } = await env.CANDIDATES_DB.prepare(`
    SELECT id, name, office, location, pdf_url, pdf_key
    FROM candidates
    WHERE LOWER(location) LIKE ?
    ORDER BY name
  `).bind(`%${(location||'').toLowerCase()}%`).all();

  // Ensure pdf_url is populated
  const origin = env.WORKER_ORIGIN || 'https://' + env.ACCOUNT_ID + '.workers.dev';
  return results.map(c => ({
    id:        c.id,
    name:      c.name,
    office:    c.office,
    location:  c.location,
    pdf_url:   c.pdf_url || `${origin}/api/files/${c.pdf_key}`
  }));
}
