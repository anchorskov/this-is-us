export default async function listCandidates({ location }, env) {
  const query = location 
    ? "SELECT * FROM candidates WHERE location = ?"
    : "SELECT * FROM candidates";
  const { results } = location
    ? await env.CANDIDATES_DB.prepare(query).bind(location).all()
    : await env.CANDIDATES_DB.prepare(query).all();
  return results;
}
