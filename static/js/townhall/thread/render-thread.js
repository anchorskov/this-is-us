// static/js/townhall/thread/render-thread.js

export function renderSkeleton(wrap) {
  wrap.innerHTML = `
    <div class="p-6 bg-white rounded shadow space-y-4 animate-pulse">
      <div class="h-6 w-3/4 bg-gray-200 rounded"></div>
      <div class="h-4 w-full bg-gray-200 rounded"></div>
      <div class="h-4 w-5/6 bg-gray-200 rounded"></div>
      <div class="h-4 w-2/3 bg-gray-200 rounded mt-6"></div>
    </div>`;
}

export function renderThreadHTML(t, niceDate) {
  const esc = str => String(str).replace(/[&<>"']/g, c =>
    ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]
  );

  return `
    <div class="p-6 bg-white rounded shadow space-y-6">
      <header class="space-y-2">
        <h1 class="text-2xl font-bold">${esc(t.title || "Untitled")}</h1>
        <p class="text-gray-700 whitespace-pre-line">${esc(t.body || "")}</p>
        <p class="text-sm text-gray-500">
          📍 ${esc(t.location || "Unknown")} • 🕒 ${niceDate(t.timestamp)}
        </p>
      </header>

      <section id="reply-list" class="space-y-4 border-t pt-4">
        <p class="text-gray-500">Loading replies…</p>
      </section>

      <form id="reply-form" class="space-y-2 border-t pt-4">
        <input name="name" placeholder="Your name"
               class="border p-2 rounded w-full" required />
        <textarea name="content" placeholder="Your reply…"
                  class="border p-2 rounded w-full" rows="3" required></textarea>
        <button class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          Reply
        </button>
      </form>
    </div>`;
}
