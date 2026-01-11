// worker/src/routes/devD1Identity.mjs
// DEV ONLY: Diagnostic endpoint to identify which D1 instances are active and their state

export async function handleDevD1Identity(request, env) {
  // Security: local-only and non-production
  const host = new URL(request.url).hostname;
  const isLocal = host === "127.0.0.1" || host === "localhost";
  const isProd = env.ENVIRONMENT === "production";

  if (!isLocal || isProd) {
    return new Response(JSON.stringify({ error: "Not available" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const result = {
    timestamp: new Date().toISOString(),
    environment: env.ENVIRONMENT || "unknown",
    bindings: {},
  };

  // Check each D1 binding
  const bindings = [
    { name: "WY_DB", db: env.WY_DB },
    { name: "EVENTS_DB", db: env.EVENTS_DB },
    { name: "BALLOT_DB", db: env.BALLOT_DB },
  ];

  for (const { name, db } of bindings) {
    result.bindings[name] = await checkDatabaseIdentity(name, db);
  }

  return new Response(JSON.stringify(result, null, 2), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Check the identity and state of a single D1 database
 */
async function checkDatabaseIdentity(bindingName, db) {
  const info = {
    binding_name: bindingName,
    accessible: false,
    tables: [],
    row_counts: {},
    latest_migrations: [],
    error: null,
  };

  if (!db) {
    info.error = "Database binding not available";
    return info;
  }

  try {
    // Try to list tables
    const tables = await db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
      )
      .all();

    if (tables.results) {
      info.accessible = true;
      info.tables = tables.results.map((r) => r.name);

      // Count rows in key tables
      const keyTables = [
        "civic_items",
        "hot_topics",
        "hot_topic_civic_items",
        "user_topic_prefs",
        "user_preferences",
        "topics",
        "bill_topics",
        "ingestion_runs",
        "d1_migrations",
        "bill_sponsors",
        "civic_item_sources",
      ];

      for (const table of keyTables) {
        if (info.tables.includes(table)) {
          try {
            const countResult = await db
              .prepare(`SELECT COUNT(*) as count FROM ${table}`)
              .first();
            info.row_counts[table] = countResult?.count ?? 0;
          } catch (err) {
            info.row_counts[table] = `error: ${err.message.slice(0, 50)}`;
          }
        }
      }

      // Get latest migrations
      if (info.tables.includes("d1_migrations")) {
        try {
          const migrations = await db
            .prepare(
              `SELECT name FROM d1_migrations ORDER BY id DESC LIMIT 5`
            )
            .all();
          info.latest_migrations = migrations.results?.map((r) => r.name) ?? [];
        } catch (err) {
          info.latest_migrations = [`error: ${err.message.slice(0, 50)}`];
        }
      }
    }
  } catch (err) {
    info.error = err.message;
  }

  return info;
}
