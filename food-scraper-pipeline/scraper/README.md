# Scraper

HungryGoWhere articles → Google Places confirmation → Postgres (`discovered_places`).

## Flow

1. **`wp.py`** — Walks the HGW sitemap, scrapes new article pages for restaurant name + address, writes them to `hgw_articles_cache.json` (local only; not committed).
2. **`places.py`** — Text-searches Google Places (Singapore-biased) for each name/address.
3. **`run.py`** — Orchestrates scrape → confirm → insert. Skips URLs already in the DB (`source_url` unique). Drops non-specific addresses (“islandwide”, etc.) and results outside Singapore.

## Setup

From `food-scraper-pipeline/`:

```bash
docker compose up -d          # PostGIS
pip install -r requirements.txt
```

`.env` needs DB credentials plus `GOOGLE_PLACES_API_KEY`.

## Usage

```bash
python -m scraper.run                  # daily: scrape new articles, then confirm
python -m scraper.run --backfill 50    # first run: up to 50 articles
python -m scraper.run --skip-scrape    # confirm from cache only (no HGW fetch)
python -m scraper.run --diagnose       # cache vs DB stats; no writes / API calls
```
