# FreshOn Delivery Partner App

Mobile-first web app for FreshOn delivery partners — sign in, complete KYC, go
online, accept missions, and run the pickup → transit → delivery flow with proof
of delivery.

## Stack

- **React 18 + Vite + TypeScript**, Tailwind CSS, shadcn/ui (Radix) components
- **React Router** for navigation, **TanStack Query** provider
- **Zod** form validation, **Sonner** toasts
- Talks to the Django backend at `apps/delivery_partner` (`/api/delivery-partner/*`)

## Getting started

```bash
bun install        # or npm install
bun run dev        # vite dev server
```

Set the backend URL via `VITE_API_URL` (defaults to `http://localhost:8000`).

```bash
# .env
VITE_API_URL=http://localhost:8000
```

## Scripts

| Command            | Purpose                          |
| ------------------ | -------------------------------- |
| `bun run dev`      | Start the dev server             |
| `bun run build`    | Production build                 |
| `bun run lint`     | ESLint                           |
| `bun run test`     | Run unit tests (Vitest)          |
| `bun run show`     | Build + preview locally          |

## App flow

1. **Auth** (`/auth`) — phone + OTP sign-in. A long-lived device auth key is
   stored; only `DELIVERY` role accounts are allowed in.
2. **Onboarding** (`/onboarding`) — three steps: profile (vehicle + address),
   KYC document upload (5 docs), and submission status. Name and phone are
   sourced from the partner's account; vehicle, address, city, and pincode are
   editable and persisted.
3. **Dashboard** (`/`) — online/offline toggle (pushes GPS), today's earnings,
   the active mission card, load meter, and notification hub.
4. **Mission** — map, optimized stop list, and the proof drawer that runs
   pickup confirmation and OTP / photo proof of delivery.
5. **Earnings** (`/earnings`) — daily breakdown, lifetime stats, recent deliveries.
6. **Profile** (`/profile`) — view stats, edit vehicle details, sign out.

## Source layout

```
src/
  lib/          API client + typed services (auth, assignments, status, partner)
  hooks/        useAuth provider
  pages/        Route screens
  components/
    freshon/    Domain UI (mission card, route list, proof drawer, etc.)
    ui/         shadcn/ui primitives
```

## Backend contract

Endpoints live in `Freshon-Cloud-Deploy/backend/apps/delivery_partner/urls.py`
under the `/api/delivery-partner/` prefix. The partner profile is backed by the
shared `EmployeeProfile` model in `apps/accounts`.
