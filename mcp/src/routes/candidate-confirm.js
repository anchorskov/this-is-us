// mcp/src/routes/candidate-confirm.js

export default async function handleCandidateConfirm(request, env) {
  try {
    const { key, name, office, location } = await request.json();

    // Validate
    if (!key || !name || !office || !location) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Insert into D1
    await env.CANDIDATES_DB.prepare(`
      INSERT INTO candidates (pdf_key, name, office, location)
      VALUES (?, ?, ?, ?)
    `)
    .bind(key, name, office, location)
    .run();

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("❌ handleCandidateConfirm error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
