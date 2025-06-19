#!/bin/bash

echo "🔧 Creating section folder..."
mkdir -p content/townhall-thread
mkdir -p layouts/townhall-thread

echo "📝 Writing content/townhall-thread/index.md..."
cat > content/townhall-thread/index.md <<EOF
---
title: "Thread View"
type: "townhall-thread"
layout: "thread"
---
EOF

echo "🧱 Writing layouts/townhall-thread/thread.html..."
cat > layouts/townhall-thread/thread.html <<'EOF'
{{ define "main" }}
<main class="max-w-3xl mx-auto p-4 space-y-6">
  <article id="thread-view"></article>
  <section id="replies-container" class="mt-6 space-y-4"></section>
  <div id="reply-form" class="mt-8"></div>
</main>
{{ end }}

{{ define "scripts" }}
  <script type="module" src="{{ "js/townhall/thread-view.js" | relURL }}"></script>
  <script type="module" src="{{ "js/townhall/thread-replies.js" | relURL }}"></script>
  <script type="module" src="{{ "js/townhall/reply-form.js" | relURL }}"></script>
{{ end }}
EOF

echo "✅ Done. Next steps:"
echo "➡️  Update your thread links in threads.js to point to:"
echo "    /townhall-thread/?id=THREAD_ID"
echo "➡️  Example: <a href='/townhall-thread/?id=${safeId}'>Open ↗</a>"
