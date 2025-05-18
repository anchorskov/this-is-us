export default async function getCandidatePdf({ id }, env) {
  const { results } = await env.CANDIDATES_DB.prepare(
    "SELECT pdf_url FROM candidates WHERE id = ?"
  ).bind(id).all();
  if (results.length === 0) return { error: "Candidate not found" };
  return { pdf_url: results[0].pdf_url };
}
