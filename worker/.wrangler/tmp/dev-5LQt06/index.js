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
router.get("/api/events", async (request, env) => {
  const { results } = await env.EVENTS_DB.prepare(
    `SELECT id, name, date, location, pdf_url
       FROM events
      WHERE date >= date('now')
      ORDER BY date`
  ).all();
  return new Response(JSON.stringify(results), {
    headers: { "Content-Type": "application/json" }
  });
});
router.post("/api/events/create", async (request, env) => {
  const form = await request.formData();
  const name = form.get("name");
  const date = form.get("date");
  const location = form.get("location");
  const file = form.get("file");
  const description = form.get("description") || "";
  const userId = form.get("userId") || "anonymous";
  const lat = form.get("lat");
  const lng = form.get("lng");
  if (!name || !date || !location || !file) {
    return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400 });
  }
  const key = `event-${crypto.randomUUID()}.pdf`;
  await env.EVENT_PDFS.put(key, file.stream());
  const pdf_url = `https://${env.EVENT_PDFS.accountId}.r2.cloudflarestorage.com/${env.EVENT_PDFS.bucketName}/${key}`;
  await env.EVENTS_DB.prepare(
    `INSERT INTO events (user_id, name, date, location, pdf_url, lat, lng)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(userId, name, date, location, pdf_url, lat, lng).run();
  return new Response(JSON.stringify({ success: true }), { status: 201 });
});
router.all("*", () => new Response("Not found", { status: 404 }));
var src_default = {
  // HTTP entrypoint
  async fetch(request, env, ctx) {
    return router.fetch(request, env, ctx);
  },
  // Cron entrypoint with R2 cleanup and DB cleanup
  async scheduled(event, env, ctx) {
    const { results: expiredEvents } = await env.EVENTS_DB.prepare(
      `SELECT id, pdf_url FROM events WHERE date < date('now','-1 day')`
    ).all();
    for (const ev of expiredEvents) {
      try {
        const url = new URL(ev.pdf_url);
        const parts = url.pathname.split("/");
        const key = parts.slice(2).join("/");
        await env.EVENT_PDFS.delete(key);
      } catch (e) {
        console.error(`Failed to delete PDF for event ID ${ev.id}:`, e);
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

// .wrangler/tmp/bundle-dbXGvV/middleware-insertion-facade.js
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

// .wrangler/tmp/bundle-dbXGvV/middleware-loader.entry.ts
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
