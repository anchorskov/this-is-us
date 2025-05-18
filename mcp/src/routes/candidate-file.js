// mcp/src/routes/candidate-file.js
export default async function handleCandidateFile(request, env) {
  const url = new URL(request.url);
  const segments = url.pathname.split("/");
  const key = segments[segments.length - 1];

  if (!key) {
    return new Response("Missing file key", { status: 400 });
  }

  const obj = await env.CANDIDATE_PDFS.get(key);
  if (!obj || !obj.body) {
    return new Response("File not found", { status: 404 });
  }

  return new Response(obj.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Cache-Control": "public, max-age=31536000"
    }
  });
}
