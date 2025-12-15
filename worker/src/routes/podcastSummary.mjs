// worker/src/routes/podcastSummary.mjs
export async function handleGetPodcastSummary(req, env) {
  try {
    const url = new URL(req.url);
    console.log(`[podcast/summary] pathname: ${url.pathname}, query: ${url.search}`);
    
    const guest = url.searchParams.get("guest");
    const episodeDate = url.searchParams.get("date");
    const partNumber = parseInt(url.searchParams.get("part") || "", 10);
    console.log(`[podcast/summary] guest=${guest}, date=${episodeDate}, part=${partNumber}`);

    if (!guest || !episodeDate || Number.isNaN(partNumber)) {
      return jsonResponse(
        { error: "guest, date, and part are required" },
        400
      );
    }

    const columns = await env.EVENTS_DB.prepare(
      "PRAGMA table_info('podcast_uploads')"
    ).all();
    const hasSummary = (columns?.results || []).some(
      (col) => col.name === "summary"
    );
    if (!hasSummary) {
      return jsonResponse({
        summary: null,
        available: false,
        reason: "summary column not available",
      });
    }

    const row = await env.EVENTS_DB.prepare(
      "SELECT guest_slug, episode_date, part_number, r2_key, summary FROM podcast_uploads WHERE guest_slug = ? AND episode_date = ? AND part_number = ? LIMIT 1"
    )
      .bind(guest, episodeDate, partNumber)
      .first();

    if (!row) {
      return jsonResponse({
        summary: null,
        available: false,
        reason: "summary not found",
      });
    }

    return jsonResponse({
      guest_slug: row.guest_slug,
      episode_date: row.episode_date,
      part_number: row.part_number,
      r2_key: row.r2_key,
      summary: row.summary,
    });
  } catch (err) {
    console.error("podcast summary error", err);
    return jsonResponse({ error: "Server error" }, 500);
  }
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
