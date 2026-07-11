# Dev Log — Food Map

## Backlog
- [ ] Style sidebar
- [ ] Prompt user to label a pinned location
- [ ] Geocoding: resolve coordinates to a human-readable address

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
** frontend ** | Fix Visual Bugs

- Fixed Marker Drift Issue

