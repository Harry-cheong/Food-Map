# Food Map

Personal food-spot map: pin places on a Leaflet map, label them, and sync to Postgres. A separate scraper confirms HungryGoWhere articles via Google Places into `discovered_places`.

## Layout

| Path | Role |
|------|------|
| `app/` | Vue 3 + Vite + Pinia frontend |
| `food-scraper-pipeline/backend/` | FastAPI REST API (auth + saved spots) |
| `food-scraper-pipeline/scraper/` | HungryGoWhere → Places → Postgres pipeline |
| `food-scraper-pipeline/database/schema.sql` | PostGIS schema (`users`, `user_fav`, `discovered_places`) |

## Prerequisites

- Node.js + npm
- Python 3 + Docker
- A `food-scraper-pipeline/.env` with at least:

```env
POSTGRES_USER=…
POSTGRES_PASSWORD=…
POSTGRES_DB=food_scraper
DB_HOST=localhost
DB_PORT=5432
```

(`GOOGLE_PLACES_API_KEY` is only required for the scraper.)

## Local setup

### 1. Database

```bash
cd food-scraper-pipeline
docker compose up -d
```

Schema is applied on **first** container boot via `database/schema.sql`. If the volume already existed without tables, apply it manually:

```bash
docker exec -i food-scraper-pg psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < database/schema.sql
```

### 2. Backend

```bash
cd food-scraper-pipeline
pip install -r requirements.txt
cd backend
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

### 3. Frontend

```bash
cd app
npm install
npm run dev
```

Vite proxies `/api/*` → `http://127.0.0.1:8000`.

## Scraper (optional)

See [`food-scraper-pipeline/scraper/README.md`](food-scraper-pipeline/scraper/README.md).
