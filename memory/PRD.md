# TaskLocal — Hyper-Local Service Marketplace

## Vision
On-demand mobile & web app that connects users with verified local pros for home repairs, mobile EV charging, and specialized task assistance.

## Users & Roles
- **Customer**: browses & books services, chats with AI concierge, pays for jobs.
- **Provider**: same app + Provider Mode toggle to accept and progress jobs.
- **Admin**: dashboard with stats and provider verification.

## Core Features (MVP)
1. **Auth** — Email/password (JWT) + Emergent Google Auth (session token).
2. **Discovery** — 3 seeded categories (Home Repairs, Mobile EV Charging, Specialized Tasks) + 12 seeded providers with photos, ratings, distance, hourly rate. Horizontal chip filters + search.
3. **Provider Detail** — Hero image with gradient scrim, bio, services offered, pricing, sample reviews, sticky "Book Service" CTA.
4. **Booking Flow** — Select service, estimated hours, time slot, address, notes → creates booking and routes to checkout.
5. **Checkout** — Stripe Checkout via WebView (mobile) / redirect (web). Demo mode when placeholder key is used. "Pay on arrival" fallback available.
6. **Bookings Tab** — Customer + Provider (segmented in Provider Mode) views with status pills, Pay/Cancel for customers, Advance-status for providers.
7. **AI Concierge Tab** — Chat with Claude Sonnet 4.6 via Emergent LLM key, suggestion chips, persistent per-session history in Mongo.
8. **Profile** — User details, Provider Mode toggle, provider apply form, Admin dashboard (users/providers/bookings stats), Logout.

## Tech Stack
- **Frontend**: Expo SDK 54, expo-router, react-native-safe-area-context, expo-image, expo-linear-gradient, expo-web-browser, expo-secure-store, react-native-webview.
- **Backend**: FastAPI + Motor (async MongoDB), bcrypt + PyJWT for auth, httpx for Emergent Google Auth session verification, emergentintegrations (Anthropic Claude) for chat, stripe for payments.
- **Design**: Terracotta (#C65D47) + stone-white palette from `/app/design_guidelines.json`.

## Seeded Data
- 3 categories, 12 providers, admin & demo customer accounts (see `test_credentials.md`).

## Notable Notes
- Stripe key `sk_test_emergent` is a placeholder — checkout runs in **DEMO mode** and marks booking paid immediately. Replace with a real `sk_test_...` in `/app/backend/.env` to enable full checkout.
- AI Chat uses `EMERGENT_LLM_KEY` with model `anthropic/claude-sonnet-4-6` — non-streaming for cross-platform reliability.
- All backend routes are prefixed with `/api`. MongoDB uses UUID `user_id`/`provider_id`/`booking_id` fields; `_id` excluded from responses.

## Roadmap / Next Steps
- Real-time provider tracking (Socket.IO)
- Reviews & rating submission
- Provider photo gallery / portfolio upload
- Referral / promo codes for viral growth
- Booking receipts & Stripe Connect payouts to providers
