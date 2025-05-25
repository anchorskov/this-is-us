// mcp/src/routes/candidate-confirm.js
export default async function handleCandidateConfirm(request, env) {
  try {
    // Parse and log incoming payload
    const payload = await request.json();
    console.log("📨 Confirm payload:", payload);

    const { key: pdf_key, name, office, location } = payload;

    // Validate
    if (!pdf_key || !name || !office || !location) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: pdf_key, name, office, location" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Compute the public URL for the PDF
    const origin = new URL(request.url).origin;
    const pdf_url = `${origin}/api/files/${pdf_key}`;

    // Insert into D1 and retrieve new record ID
    const insert = await env.CANDIDATES_DB.prepare(
      `INSERT INTO candidates (pdf_key, pdf_url, name, office, location)
       VALUES (?, ?, ?, ?, ?);`
    )
    .bind(pdf_key, pdf_url, name, office, location)
    .run();

    const lastId = insert.lastInsertRowid || null;

    return new Response(
      JSON.stringify({ success: true, id: lastId, pdf_key, pdf_url, name, office, location }),
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
