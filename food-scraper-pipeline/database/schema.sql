-- FoodMap database schema (PostgreSQL + PostGIS)
-- Target: PostGIS container in docker-compose.yml
--
-- Apply manually:
--   psql "$DATABASE_URL" -f database/schema.sql
-- Or let Docker run it on first boot via docker-entrypoint-initdb.d/

CREATE EXTENSION IF NOT EXISTS postgis;

-- ---------------------------------------------------------------------------
-- users — authentication
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    username        TEXT        NOT NULL UNIQUE,
    hashed_password TEXT        NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- user_fav — saved food spots (API: POST/GET /items, DELETE /delete/{id})
--
-- Column notes:
--   named_address  ↔  API field `location` (human-readable address)
--   location       ↔  PostGIS point derived from lat/lng (for spatial queries)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_fav (
    id                   SERIAL PRIMARY KEY,
    name                 TEXT             NOT NULL,
    description          TEXT,
    lat                  DOUBLE PRECISION NOT NULL,
    lng                  DOUBLE PRECISION NOT NULL,
    location             GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (
        ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
    ) STORED,
    named_address        TEXT             NOT NULL,
    category             TEXT             NOT NULL,
    public               BOOLEAN          NOT NULL DEFAULT FALSE,
    list_status          TEXT             NOT NULL DEFAULT 'to_try',
    submitted_by_user_id INTEGER          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at           TIMESTAMPTZ      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT user_fav_lat_valid CHECK (lat >= -90 AND lat <= 90),
    CONSTRAINT user_fav_lng_valid CHECK (lng >= -180 AND lng <= 180),
    CONSTRAINT user_fav_list_status_valid CHECK (list_status IN ('to_try', 'tried'))
);

-- Look up a user's saved spots
CREATE INDEX IF NOT EXISTS idx_user_fav_submitted_by
    ON user_fav (submitted_by_user_id);

-- Nearby / map-bounds queries
CREATE INDEX IF NOT EXISTS idx_user_fav_location
    ON user_fav USING GIST (location);

-- Public discovery feed
CREATE INDEX IF NOT EXISTS idx_user_fav_public
    ON user_fav (public)
    WHERE public = TRUE;

-- Filter by cuisine type
CREATE INDEX IF NOT EXISTS idx_user_fav_category
    ON user_fav (category);

-- Filter personal list by to-try / tried
CREATE INDEX IF NOT EXISTS idx_user_fav_list_status
    ON user_fav (submitted_by_user_id, list_status);

-- ---------------------------------------------------------------------------
-- discovered_places — HGW articles confirmed via Google Places API
-- Populated by scraper/run.py
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS discovered_places (
    id                  SERIAL PRIMARY KEY,
    source_url          TEXT             NOT NULL UNIQUE,
    source_title        TEXT,
    source_category     TEXT,
    restaurant_name     TEXT             NOT NULL,
    source_address      TEXT,
    google_place_id     TEXT             NOT NULL,
    google_name         TEXT             NOT NULL,
    formatted_address   TEXT             NOT NULL,
    lat                 DOUBLE PRECISION NOT NULL,
    lng                 DOUBLE PRECISION NOT NULL,
    location            GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (
        ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
    ) STORED,
    rating              DOUBLE PRECISION,
    user_rating_count   INTEGER,
    business_status     TEXT,
    confirmed_at        TIMESTAMPTZ      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT discovered_places_lat_valid CHECK (lat >= -90 AND lat <= 90),
    CONSTRAINT discovered_places_lng_valid CHECK (lng >= -180 AND lng <= 180)
);

CREATE INDEX IF NOT EXISTS idx_discovered_places_google_place_id
    ON discovered_places (google_place_id);

CREATE INDEX IF NOT EXISTS idx_discovered_places_location
    ON discovered_places USING GIST (location);
