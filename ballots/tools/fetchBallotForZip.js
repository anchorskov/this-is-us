// ballots/tools/fetchBallotForZip.js

export default async function fetchBallotForZip({ zip }, env) {
  if (!zip) return { error: "Missing ZIP code" };

  try {
    const query = `
      SELECT * FROM ballot_sources
      WHERE location LIKE ? OR location = ?
      ORDER BY election_cycle DESC, updated_at DESC
    `;
    const { results } = await env.BALLOT_DB.prepare(query)
      .bind(`%${zip}%`, zip)
      .all();

    if (results.length === 0) {
      return { message: "No ballot data found for this ZIP code." };
    }

    return {
      zip,
      sources: results.map(row => ({
        label: row.label,
        url: row.url,
        type: row.type,
        notes: row.notes,
        election_cycle: row.election_cycle
      }))
    };
  } catch (err) {
    return { error: "Database query failed", message: err.message };
  }
}
