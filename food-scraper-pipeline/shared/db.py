from __future__ import annotations

import os
from pathlib import Path

import psycopg
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")


def get_connection():
    return psycopg.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", 5432),
        user=os.getenv("POSTGRES_USER"),
        password=os.getenv("POSTGRES_PASSWORD"),
        dbname=os.getenv("POSTGRES_DB"),
    )


def get_confirmed_source_urls() -> set[str]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT source_url FROM discovered_places")
            return {row[0] for row in cur.fetchall()}


def insert_discovered_place(
    *,
    source_url: str,
    source_title: str | None,
    source_category: str | None,
    restaurant_name: str,
    source_address: str | None,
    google_place_id: str,
    google_name: str,
    formatted_address: str,
    lat: float,
    lng: float,
    rating: float | None,
    user_rating_count: int | None,
    business_status: str | None,
) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO discovered_places (
                    source_url, source_title, source_category,
                    restaurant_name, source_address,
                    google_place_id, google_name, formatted_address,
                    lat, lng, rating, user_rating_count, business_status
                ) VALUES (
                    %s, %s, %s,
                    %s, %s,
                    %s, %s, %s,
                    %s, %s, %s, %s, %s
                )
                ON CONFLICT (source_url) DO NOTHING
                """,
                (
                    source_url,
                    source_title,
                    source_category,
                    restaurant_name,
                    source_address,
                    google_place_id,
                    google_name,
                    formatted_address,
                    lat,
                    lng,
                    rating,
                    user_rating_count,
                    business_status,
                ),
            )
        conn.commit()


def ensure_discovered_places_table() -> None:
    """Create discovered_places if the DB was initialized before the table was added."""
    ddl = """
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
    )
    """
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("CREATE EXTENSION IF NOT EXISTS postgis")
            cur.execute(ddl)
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_discovered_places_google_place_id
                    ON discovered_places (google_place_id)
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_discovered_places_location
                    ON discovered_places USING GIST (location)
                """
            )
        conn.commit()
