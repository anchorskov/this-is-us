export default async function handleCandidateUpload(request, env) {
  const form = await request.formData();
  const file = form.get("file");

  if (!file || file.type !== "application/pdf") {
    return new Response(JSON.stringify({ error: "Invalid or missing PDF file." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const key = `candidate-${crypto.randomUUID()}.pdf`;
  console.log("🆕 Generated PDF key:", key);
  await env.CANDIDATE_PDFS.put(key, file.stream());

  const origin = new URL(request.url).origin;
  const pdf_url = `${origin}/api/files/${key}`;

  return new Response(JSON.stringify({ success: true, pdf_url }), {
    headers: { "Content-Type": "application/json" }
  });
}
