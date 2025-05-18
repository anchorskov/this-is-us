// mcp/tools/insertParsedCandidate.js

export default async function insertParsedCandidate({ name, office, location, pdf_url }, env) {
  if (!name || !office || !location || !pdf_url) {
    return { error: "Missing required fields" };
  }

  const stmt = env.CANDIDATES_DB.prepare(`
    INSERT INTO candidates (name, office, location, pdf_url)
    VALUES (?, ?, ?, ?)
  `);

  try {
    await stmt.bind(name, office, location, pdf_url).run();
    return { success: true };
  } catch (e) {
    return { error: "Failed to insert candidate", message: e.message };
  }
}
