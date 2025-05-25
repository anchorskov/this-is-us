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
// mcp/src/routes/candidate-file.js
export default async function handleCandidateFile(request, env) {
  const url = new URL(request.url);
  const segments = url.pathname.split("/");
  const key = segments[segments.length - 1];

  if (!key) {
    return new Response("Missing file key", {
      status: 400,
      headers: { "Content-Type": "text/plain" }
    });
  }

  try {
    // Attempt to fetch the PDF from R2
    const obj = await env.CANDIDATE_PDFS.get(key, { allowScripting: true });
    if (!obj || !obj.body) {
      return new Response("File not found", {
        status: 404,
        headers: { "Content-Type": "text/plain" }
      });
    }

    // Stream back the PDF with proper headers
    return new Response(obj.body, {
      status: 200,
      headers: {
        "Content-Type": obj.httpMetadata.contentType || "application/pdf",
        // Inline display; change to "attachment" to force download
        "Content-Disposition": `inline; filename="${key}"`,
        // Prevent caching on the client
        "Cache-Control": "private, max-age=0, must-revalidate"
      }
    });
  } catch (err) {
    console.error(`❌ Error fetching PDF ${key}:`, err);
    // Graceful HTML error page
    return new Response(
      `<html>
         <head><title>PDF Error</title></head>
         <body style="font-family:sans-serif">
           <h1>We’re sorry, there was a problem retrieving your PDF.</h1>
           <p>Please try again later.</p>
         </body>
       </html>`,
      {
        status: 500,
        headers: { "Content-Type": "text/html" }
      }
    );
  }
}
