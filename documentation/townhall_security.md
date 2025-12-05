# Town Hall security checks (2025-02-11)

## Quick tests (wrangler dev)
1. Start `wrangler dev` from `worker/`.
2. Unauth create should fail:
   ```bash
   curl -i http://127.0.0.1:8787/api/townhall/create \
     -H "Origin: http://localhost:1313" \
     -F "title=Nope" -F "prompt=No token"
   # Expect 401
   ```
3. Wrong origin should fail preflight:
   ```bash
   curl -i -X OPTIONS http://127.0.0.1:8787/api/townhall/create \
     -H "Origin: https://evil.example"
   # Expect 403
   ```
4. Authenticated create (needs valid Firebase ID token):
   ```bash
   FIREBASE_ID_TOKEN=<token> ./scripts/townhall-auth-demo.sh
   ```

## Notes
- `/api/townhall/create` and `/api/townhall/delete` now require either a Firebase ID token (Authorization: Bearer or __session cookie) or Cloudflare Access headers.
- Allowed CORS origins for Town Hall writes: `https://this-is-us.org`, `https://www.this-is-us.org`, `http://localhost:8787`, `http://127.0.0.1:8787`, `http://localhost:1313`.
- Identity is derived server-side; caller-supplied `user_id` is ignored. Unauthorized requests return 401 before touching D1/R2.
