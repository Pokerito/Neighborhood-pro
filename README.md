# TaskLocal — Hyper-Local Service Marketplace

> On-demand mobile & web app that connects users with verified local pros for **home repairs**, **mobile EV charging**, and **specialized task assistance** (moving, tutoring, pet care, cleaning, and more).

Built on **Expo (React Native)** + **FastAPI** + **MongoDB**, with Claude-powered AI concierge, real-time booking tracking, and a full booking → payment → review flow.

---

## ✨ Features

- **Auth** — Email/password (JWT) + one-tap Emergent-managed Google sign-in
- **Discover** — Category filter chips, search, 3 seeded categories, 12 seeded providers with photos, ratings, distance, and hourly rates
- **Provider detail** — Hero image, services, pricing, real reviews list, sticky Book CTA
- **Booking flow** — Choose service → time slot → address → notes → Stripe (or demo) checkout
- **Payments** — Stripe Checkout via WebView on mobile / redirect on web (falls back to demo mode when no real test key is configured)
- **AI Concierge tab** — Chat with Claude Sonnet 4.6 via Emergent LLM key; suggestion chips; persistent per-session history
- **Real-time job tracking** — Live WebSocket status stream, ETA card, 5-step timeline, auto-reconnect
- **Reviews & ratings** — 1–5 star + optional comment after job is `completed`, auto-recomputes the provider's average
- **Provider mode** — Toggle in Profile → apply form → accept jobs, advance status (requested → accepted → en_route → in_progress → completed)
- **Admin dashboard** — User/provider/booking stats + provider verification

---

## 🏗️ Tech Stack

| Layer | Tech |
| --- | --- |
| Frontend | Expo SDK 54, expo-router, react-native-safe-area-context, expo-image, expo-linear-gradient, react-native-webview, expo-web-browser, expo-secure-store |
| Backend | FastAPI, Motor (async MongoDB), bcrypt + PyJWT, httpx, `emergentintegrations` (Claude), `stripe` |
| Database | MongoDB (collections: `users`, `user_sessions`, `providers`, `categories`, `bookings`, `reviews`, `chat_messages`) |
| Real-time | Native FastAPI `WebSocket` + broadcast connection manager |
| AI | Anthropic `claude-sonnet-4-6` via `EMERGENT_LLM_KEY` |

---

## 📁 Project Structure

```
app/
├── backend/
│   ├── server.py            # FastAPI app (auth, providers, bookings, chat, WS, admin)
│   ├── requirements.txt
│   └── .env                 # MONGO_URL, DB_NAME, JWT_SECRET, EMERGENT_LLM_KEY, STRIPE_API_KEY
│
├── frontend/
│   ├── app/                 # Expo Router file-based routes
│   │   ├── _layout.tsx      # Root: SafeArea, GestureHandler, AuthProvider
│   │   ├── index.tsx        # Auth guard / redirect
│   │   ├── auth/
│   │   │   ├── login.tsx
│   │   │   └── register.tsx
│   │   ├── (tabs)/
│   │   │   ├── _layout.tsx
│   │   │   ├── index.tsx    # Discover
│   │   │   ├── bookings.tsx
│   │   │   ├── chat.tsx     # AI Concierge
│   │   │   └── profile.tsx
│   │   ├── provider/[id].tsx
│   │   ├── book/[id].tsx
│   │   ├── checkout/[id].tsx
│   │   ├── track/[id].tsx   # Live tracking + review modal
│   │   └── payment-return.tsx
│   ├── src/
│   │   ├── theme.ts
│   │   └── lib/
│   │       ├── api.ts
│   │       ├── auth.tsx
│   │       └── useBookingSocket.ts
│   ├── app.json
│   ├── package.json
│   └── .env                 # EXPO_PUBLIC_BACKEND_URL, packager vars
│
└── memory/
    ├── PRD.md
    └── test_credentials.md
```

---

## 🔐 Environment Variables

### `backend/.env`
```dotenv
MONGO_URL=mongodb://localhost:27017
DB_NAME=test_database
EMERGENT_LLM_KEY=sk-emergent-...          # provided by Emergent platform
JWT_SECRET=<long-random-string>
STRIPE_API_KEY=sk_test_...                # placeholder → demo checkout mode
```

### `frontend/.env`
```dotenv
EXPO_PUBLIC_BACKEND_URL=https://<your-app>.preview.emergentagent.com
```

> ⚠️ Do **not** modify `EXPO_PACKAGER_PROXY_URL` / `EXPO_PACKAGER_HOSTNAME` — those are managed by the Expo dev server.

---

## 🧪 Test Credentials (seeded on startup)

| Role | Email | Password |
| --- | --- | --- |
| Customer | `demo@tasklocal.app` | `Demo@12345` |
| Admin | `admin@tasklocal.app` | `Admin@12345` |

Google Auth: any Google account works — the user is auto-provisioned as `customer`.

Stripe (when a real test key is set): `4242 4242 4242 4242`, any future expiry, any CVC.

---

## 🚀 Running Locally

Backend and frontend run under `supervisor` in the Emergent container.

```bash
# Restart backend
sudo supervisorctl restart backend

# Restart Expo (Metro)
sudo supervisorctl restart expo

# Tail logs
tail -f /var/log/supervisor/backend.err.log
tail -f /var/log/supervisor/expo.err.log
```

Backend is served on port `8001` and reverse-proxied at `/api/*` by the Kubernetes ingress. Everything else is served by Metro on port `3000` — that's why all backend routes are prefixed with `/api`.

---

## 🔌 Key API Endpoints

```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/google-session          # verifies Emergent OAuth session_token
GET    /api/auth/me
POST   /api/auth/logout

GET    /api/categories
GET    /api/providers?category=&search=
GET    /api/providers/{id}
GET    /api/providers/{id}/reviews
POST   /api/providers/apply              # become a provider
POST   /api/users/provider-mode          # toggle provider mode

POST   /api/bookings
GET    /api/bookings                     # my (customer) bookings
GET    /api/bookings/provider            # my (provider) jobs
GET    /api/bookings/{id}
PATCH  /api/bookings/{id}/status
POST   /api/bookings/{id}/review

POST   /api/chat                         # non-streaming AI concierge
POST   /api/chat/stream                  # SSE variant
GET    /api/chat/history/{session_id}

POST   /api/payments/checkout            # Stripe session (or demo)
GET    /api/payments/status/{booking_id}

GET    /api/admin/stats
GET    /api/admin/providers
PATCH  /api/admin/providers/{id}/verify

WS     /api/ws/bookings/{booking_id}?token=<jwt|session_token>
```

---

## 🧭 Roadmap

- Photo upload / portfolio gallery for providers
- Provider earnings dashboard with weekly chart
- Push notifications for status changes (requires a build)
- Referral / promo codes ("Give $10, get $10")
- Stripe Connect payouts to providers

---

## 📄 License

MIT — do whatever you want, just don't sue us.
