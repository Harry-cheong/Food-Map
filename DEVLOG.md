# Dev Log — Food Map

## Backlog
- [ ] Style sidebar
- [x] Prompt user to label a pinned location
- [x] Geocoding: resolve coordinates to a human-readable address

## 2026-06-04
**frontend** | Goal: get basic auth flow in place

- Login floating modal created and wired to router (`/` and `/login` paths)

## 2026-06-05
**frontend** | Goal: give users a way to see and manage saved pins

- Sidebar added with a list of saved coordinates
- Map click handler drops a pin and registers it to the sidebar list

## 2026-06-06
**frontend** | Goal: make the sidebar actually usable

- Clicking a sidebar entry now focuses the map on that pin
- Location cards on the sidebar can now be dismissed

## 2026-06-08
**backend** | Goal: stand up a working auth backend with persistent storage

- Initialised FastAPI backend with SQLite; went with SQLite over Postgres
  to keep local dev simple for now
- Auth layer: JWT via PyJWT, password hashing via passlib
- Endpoints: `POST /login`, `POST /newuser`

## 2026-06-10
**frontend** | Goal: close the loop between login UI and backend

- Login form now calls `POST /login` and handles the JWT response

## 2026-06-11
**frontend** | Goal: update login states across components

- Introduced Pinia for state management to hold auth state across components

## 2026-06-12
**frontend** | Goal: sync food location changes across components

- Sidebar or map interactions now modify state 
- Improved on marker popup and foodsidebarCard

## 2026-06-13
**frontend** | Goal: Polish the interface

- Worked on improving the styling of sidebar
- New floating container to show more info about the food location

## 2026-06-13
**frontend** | Fix Visual Bugs

- Fixed Marker Drift Issue
- Moved backend/scraper into `food-scraper-pipeline/`; frontend now lives under `app/`
- Switched persistence to PostgreSQL + PostGIS (`postgis/postgis:16-3.4` via docker-compose)

## 2026-07-13
**infra / scraper** | Goal: stand up PostGIS + HGW → Places confirmation pipeline

- Hand-wrote `database/schema.sql`: `users`, `user_fav`, `discovered_places`
  - Generated `GEOGRAPHY(POINT, 4326)` from lat/lng for spatial queries
  - Indexes aimed at real query shapes: owner FK, GiST on location, partial public feed,
    category filter, `google_place_id` lookup; `source_url` unique for scraper idempotency
- Scraper pipeline end-to-end: HGW sitemap/articles (`wp.py`) → Google Places confirm →
  insert into `discovered_places` (`run.py` / `shared/db.py`)
- Singapore region bias on Places search to cut false matches outside SG

## 2026-07-13
**frontend** | Goal: product/UX, architecture cleanup, and working signup

### Product / UX
- Pin labeling: map click sets `pendingCoord`; `PinLabelModal` collects name/category/notes;
  on save, `locStore.addNewPlace` POSTs then the map syncs a marker
- Auth gate + geocode: unauthenticated clicks call `auth.openLogin()`; while labeling,
  `reverseGeocode` (Nominatim) fills the address hint
- Search / filters: `searchQuery` + `activeFilter` live in the location store; sidebar renders
  `filteredPlaces`; Following is an empty state only
- Sign-up + feedback: auth modal toggles register mode → `signUp` (`/newuser` then `/login`);
  spinners/errors from store / `isAuthenticating`
- Mobile sidebar: below 720px, sidebar is a fixed overlay; map list button calls `openMobile()`
- Save / logout / XSS: store only pushes a place after a successful API response; unmount no
  longer calls `logout()`; popup HTML runs through `escapeHtml`

### Signup unblock
- Ran `schema.sql` into the existing PostGIS container so `users` / `user_fav` existed
  (volume had been created before init scripts)

### Architecture (1–6)
- `useMap` / `useGeocode`: Leaflet lifecycle + marker map in the composable; geocode is a plain
  async helper; `HomeView` wires UI only
- No markers in Pinia: places are `{ uid, lat, lng, … }`; `useMap` watches `places` and
  upserts/removes `L.Marker`s
- Shared types: `types/place.ts` + `constants/categories.ts` used by store, API, and UI
- Drift fix: replaced `transform: scale()` pulse with opacity/box-shadow; dropped the `zoomend`
  drift detector (old scale animation fought Leaflet’s marker transforms)
- Auth ↔ places: `bindAuthSession()` in `main.ts` watches `auth.token` → `loadMyPlaces` /
  `clearPlaces`
- API client: `apiRequest` + token getter from the auth store; `api/auth` & `api/places` wrap
  endpoints; Vite proxies `/api` → `:8000`; `useApi` removed; auth store owns `signIn` / `signUp`
