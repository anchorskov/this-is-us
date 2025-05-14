var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// node_modules/itty-router/index.mjs
var t = /* @__PURE__ */ __name(({ base: e = "", routes: t2 = [], ...r2 } = {}) => ({ __proto__: new Proxy({}, { get: /* @__PURE__ */ __name((r3, o2, a, s) => (r4, ...c) => t2.push([o2.toUpperCase?.(), RegExp(`^${(s = (e + r4).replace(/\/+(\/|$)/g, "$1")).replace(/(\/?\.?):(\w+)\+/g, "($1(?<$2>*))").replace(/(\/?\.?):(\w+)/g, "($1(?<$2>[^$1/]+?))").replace(/\./g, "\\.").replace(/(\/?)\*/g, "($1.*)?")}/*$`), c, s]) && a, "get") }), routes: t2, ...r2, async fetch(e2, ...o2) {
  let a, s, c = new URL(e2.url), n = e2.query = { __proto__: null };
  for (let [e3, t3] of c.searchParams) n[e3] = n[e3] ? [].concat(n[e3], t3) : t3;
  e: try {
    for (let t3 of r2.before || []) if (null != (a = await t3(e2.proxy ?? e2, ...o2))) break e;
    t: for (let [r3, n2, l, i] of t2) if ((r3 == e2.method || "ALL" == r3) && (s = c.pathname.match(n2))) {
      e2.params = s.groups || {}, e2.route = i;
      for (let t3 of l) if (null != (a = await t3(e2.proxy ?? e2, ...o2))) break t;
    }
  } catch (t3) {
    if (!r2.catch) throw t3;
    a = await r2.catch(t3, e2.proxy ?? e2, ...o2);
  }
  try {
    for (let t3 of r2.finally || []) a = await t3(a, e2.proxy ?? e2, ...o2) ?? a;
  } catch (t3) {
    if (!r2.catch) throw t3;
    a = await r2.catch(t3, e2.proxy ?? e2, ...o2);
  }
  return a;
} }), "t");
var r = /* @__PURE__ */ __name((e = "text/plain; charset=utf-8", t2) => (r2, o2 = {}) => {
  if (void 0 === r2 || r2 instanceof Response) return r2;
  const a = new Response(t2?.(r2) ?? r2, o2.url ? void 0 : o2);
  return a.headers.set("content-type", e), a;
}, "r");
var o = r("application/json; charset=utf-8", JSON.stringify);
var p = r("text/plain; charset=utf-8", String);
var f = r("text/html");
var u = r("image/jpeg");
var h = r("image/png");
var g = r("image/webp");

// src/index.mjs
var router = t();
router.get("/api/events/pdf/:key", async (request, env) => {
  const { key } = request.params;
  const obj = await env.EVENT_PDFS.get(key, { allowScripting: true });
  if (!obj) return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain" } });
  return new Response(obj.body, {
    status: 200,
    headers: {
      "Content-Type": obj.httpMetadata.contentType || "application/pdf",
      "Cache-Control": "public, max-age=31536000"
    }
  });
});
router.get("/api/events", async (request, env) => {
  const { results } = await env.EVENTS_DB.prepare(
    `SELECT id, name, date, location, pdf_url, lat, lng
     FROM events
     WHERE date >= date('now')
     ORDER BY date`
  ).all();
  return new Response(JSON.stringify(results), {
    headers: { "Content-Type": "application/json" }
  });
});
router.get("/_debug/schema", async (_, env) => {
  const { results } = await env.EVENTS_DB.prepare(`PRAGMA table_info(events)`).all();
  return new Response(JSON.stringify(results), { headers: { "Content-Type": "application/json" } });
});
router.post("/api/events/create", async (request, env) => {
  const form = await request.formData();
  const userId = form.get("userId") ?? form.get("user_id") ?? "anonymous";
  const name = form.get("name");
  const date = form.get("date");
  const location = form.get("location");
  const file = form.get("file");
  const description = form.get("description") || "";
  const lat = form.get("lat");
  const lng = form.get("lng");
  const sponsor = form.get("sponsor") || "";
  const contactEmail = form.get("contactEmail") ?? form.get("contact_email") ?? "";
  const contactPhone = form.get("contactPhone") ?? form.get("contact_phone") ?? "";
  console.log("\u{1F4DD} Incoming event submission:", {
    userId,
    name,
    date,
    location,
    lat,
    lng,
    description,
    sponsor,
    contactEmail,
    contactPhone,
    file: file?.name
  });
  if (!name || !date || !location || !file) {
    console.warn("\u26A0\uFE0F Missing required fields", { name, date, location, file });
    return new Response(JSON.stringify({ error: "Missing fields" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  try {
    const buffer = await file.arrayBuffer();
    const hashBuf = await crypto.subtle.digest("SHA-256", buffer);
    const pdf_hash = Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");
    const { results: dup } = await env.EVENTS_DB.prepare(
      `SELECT id FROM events WHERE pdf_hash = ?`
    ).bind(pdf_hash).all();
    if (dup.length) {
      console.warn("\u26A0\uFE0F Duplicate PDF detected, aborting upload", { pdf_hash });
      return new Response(JSON.stringify({
        error: "Duplicate PDF",
        duplicate: true
      }), {
        status: 409,
        headers: { "Content-Type": "application/json" }
      });
    }
    const key = `event-${crypto.randomUUID()}.pdf`;
    await env.EVENT_PDFS.put(key, file.stream());
    const origin = new URL(request.url).origin;
    const pdf_url = `${origin}/api/events/pdf/${key}`;
    console.log(`\u{1F4C4} PDF uploaded, accessible at: ${pdf_url}`);
    await env.EVENTS_DB.prepare(`
      INSERT INTO events (
        user_id, name, date, location, pdf_url,
        lat, lng, sponsor, contact_email,
        contact_phone, pdf_hash, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      userId,
      name,
      date,
      location,
      pdf_url,
      lat,
      lng,
      sponsor,
      contactEmail,
      contactPhone,
      pdf_hash,
      description
    ).run();
    console.log("\u2705 Event saved to database");
    return new Response(JSON.stringify({ success: true }), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error("\u274C Error submitting event:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
router.all("*", () => new Response("Not found", { status: 404 }));
var src_default = {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": request.headers.get("Origin") || "*",
      "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    const response = await router.fetch(request, env, ctx);
    const newHeaders = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, val]) => newHeaders.set(key, val));
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  },
  async scheduled(event, env, ctx) {
    const { results: expiredEvents } = await env.EVENTS_DB.prepare(
      `SELECT id, pdf_url FROM events WHERE date < date('now','-1 day')`
    ).all();
    for (const ev of expiredEvents) {
      try {
        const url = new URL(ev.pdf_url);
        const key = url.pathname.split("/").slice(2).join("/");
        await env.EVENT_PDFS.delete(key);
      } catch (e) {
        console.error(`\u{1F9E8} Failed to delete R2 asset for expired event ID ${ev.id}:`, e);
      }
    }
    await env.EVENTS_DB.prepare(
      `DELETE FROM events WHERE date < date('now','-1 day')`
    ).run();
  }
};

// ../../../.nvm/versions/node/v22.14.0/lib/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// .wrangler/tmp/bundle-Zw7i5s/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default
];
var middleware_insertion_facade_default = src_default;

// ../../../.nvm/versions/node/v22.14.0/lib/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-Zw7i5s/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
