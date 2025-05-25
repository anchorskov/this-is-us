// src/routes/candidate-upload.js
export default async function handleCandidateUpload(request, env) {
  const form = await request.formData();
  const file = form.get("file");
  if (!file || file.type !== "application/pdf") {
    return new Response(
      JSON.stringify({ error: "Invalid or missing PDF file." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Generate a unique key for the PDF
  const key = `candidate-${crypto.randomUUID()}.pdf`;
  console.log("🆕 Generated PDF key:", key);
  await env.CANDIDATE_PDFS.put(key, file.stream());

  // Build the public URL for retrieving the PDF
  const origin = new URL(request.url).origin;
  const pdf_url = `${origin}/api/files/${key}`;

  // Return both the raw key and the public URL
  return new Response(JSON.stringify({
    success: true,
    key,
    pdf_url,
    parsed: {}  // You can replace this with real parsed data later
  }), {
      headers: { "Content-Type": "application/json" }
  });
}
