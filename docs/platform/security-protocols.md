# 🔐 This Is Us – Security Protocols

This document explains the privacy and security design of the `this-is-us.org` platform. We publish this openly to uphold our values: **integrity, transparency, accountability, and compassion**.

---

## ✅ Authentication

- **Provider**: Firebase Authentication
- **Methods**: Email + password, Google login (optional), SMS-based 2FA
- **Session handling**: Client-side via Firebase tokens (`onAuthStateChanged`)
- **Verification required**: Email or phone must be verified before sync

---

## 🔁 Data Synchronization

### Firestore
- Stores verified user metadata (`city`, `state`, `role`, `joinedAt`)
- Role-based rules restrict read/write access to authenticated users

### Cloudflare D1 (SQLite)
- Stores user preferences (`theme`, `notifications_enabled`)
- Synced via POST `/api/sync-user`
- Primary key is `firebase_uid` — cannot be faked

---

## 🛡️ Multi-Factor Authentication (2FA)

- All users must enroll a second factor (SMS)
- Enforced client-side on login
- In future: server-side enforcement via custom claims

---

## 🔐 API Security

- All sensitive endpoints require Firebase ID token
- Token verification planned using `jose` or Firebase SDK
- CORS headers configured to allow only project domains
- Parameterized SQL queries (no injection possible)

---

## ❌ What We Don't Collect

- No passwords (Firebase manages that)
- No location history or GPS
- No credit card or financial data
- No 3rd-party analytics or tracking scripts

---

## 🧠 Developer Tips

- Never hardcode API keys or secrets
- `.env` and `./scripts/wr.toml` should be gitignored
- All tokens passed through headers, not query strings
- Log files must redact user-identifiable info

---

## 🌐 Transparency Commitment

We publish this as a living document. Anyone may audit, propose improvements, or use this security model to build their own tools. We believe security through **community and clarity** is stronger than obscurity.

