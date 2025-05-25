// mcp/src/routes/candidate-confirm.js
export default async function handleCandidateConfirm(request, env) {
  try {
    const { key: pdf_key, name, office, location } = await request.json();

    // Validate
    if (!pdf_key || !name || !office || !location) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: pdf_key, name, office, location" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Insert into D1 and get new record ID
    const insert = await env.CANDIDATES_DB.prepare(
      `INSERT INTO candidates (pdf_key, name, office, location)
       VALUES (?, ?, ?, ?);`
    )
    .bind(pdf_key, name, office, location)
    .run();

    // SQLite returns last inserted row ID via metadata
    const lastId = insert.lastInsertRowid || null;

    return new Response(
      JSON.stringify({ success: true, id: lastId, pdf_key, name, office, location }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("❌ handleCandidateConfirm error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
