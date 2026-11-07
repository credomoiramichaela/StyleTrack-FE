# StyleTrack Web (React + Vite + TypeScript)

Back-office web app for the StyleTrack API: owner/admin, staff and stylist roles.

## Run in development
```bash
npm install
npm run dev          # http://localhost:5173
```
The dev server proxies `/api` to `http://localhost:8080` (the Spring Boot API). To point at another
backend: `VITE_API_TARGET=https://your-api.example.com npm run dev`.

## Build / deploy
```bash
npm run build        # type-checks, then outputs ./dist
```
**Docker:** the image serves `dist` with nginx and forwards `/api/` to the API, so the browser only talks to one
origin (no CORS setup). `API_UPSTREAM` sets the backend address (default `http://api:8080`).

To run both together, add the service in `docker-compose.snippet.yml` to the backend's `docker-compose.yml`
(put this folder next to the backend folder), then `docker compose up -d --build` and open http://localhost:3000.

## What each role sees
| Screen | Admin | Staff | Stylist |
|---|---|---|---|
| Today (appointment-book day sheet, waiting list) | all stylists | all stylists | own column |
| Appointments / Home visits | everything | everything | own bookings |
| New booking, reschedule, cancel | ✔ | ✔ | – |
| Record payment (Cash / QR Ph / GCash with reference no.) | ✔ | ✔ | – |
| Payments screen (collected by method, waiting to be paid) | ✔ | ✔ | – |
| Accept / reject / complete | ✔ | ✔ | own bookings |
| Customers, visit history | full | add/edit | view |
| Loyalty: redeem points or a reward / adjust | redeem + adjust | redeem | balance only |
| Loyalty tier (Silver / Gold) + visit count | ✔ | ✔ | ✔ |
| Rewards catalogue | manage | – | – |
| Treatment history (what was done, products, reactions, follow-up) | read, write | read | read; write for own clients |
| Recommendations | full | full | view |
| Stylists + weekly hours | full | view | view, edit own hours |
| Services | full | view | view |
| Reports (incl. payments and most loyal customers) | ✔ | – | – |
| Team logins | ✔ | – | – |

The API enforces all of this too; the screens simply hide what a role cannot do.

## Structure
`src/api.ts` typed API client (JWT in localStorage) · `src/auth.tsx` login state · `src/ui.tsx` shared pieces
(drawer, toast, slot picker) · `src/AppointmentDrawers.tsx` booking + appointment actions (payment, QR Ph) ·
`src/TreatmentComponents.tsx` treatment records + tier badge · `src/pages/*` screens ·
`src/styles.css` design tokens and styles. Fonts (Bricolage Grotesque, Instrument Sans) are bundled via npm, so no
external requests are made.

## QR Ph
The QR Ph payment step shows the salon's QR code image. Set `QRPH_IMAGE_URL` (a public image URL) and
`QRPH_ACCOUNT_NAME` on the backend. The front desk then records the reference number from the customer's
confirmation screen; there is no automatic bank/e-wallet confirmation yet.
