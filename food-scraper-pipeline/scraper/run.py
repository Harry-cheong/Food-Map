"""
Pipeline: scrape HungryGoWhere → confirm via Google Places → write to Postgres.

Usage (from food-scraper-pipeline/):
    python -m scraper.run                  # daily run: new articles only
    python -m scraper.run --backfill 50    # first run: scrape up to 50 articles
    python -m scraper.run --skip-scrape    # re-confirm cached articles not yet in DB
    python -m scraper.run --diagnose       # print cache/DB stats, no API writes
"""
from __future__ import annotations

import argparse
import logging
import re
import sys
import time
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from shared.db import (  # noqa: E402
    ensure_discovered_places_table,
    get_confirmed_source_urls,
    insert_discovered_place,
)
from scraper.places import find_place_by_text  # noqa: E402
from scraper import wp  # noqa: E402

REQUEST_DELAY_SECONDS = 0.5  # between Places API calls

# Addresses that cannot be pinned to a single place
_NON_SPECIFIC_ADDRESS = re.compile(
    r"multiple\s+outlets|islandwide|various\s+locations|coming\s+soon",
    re.IGNORECASE,
)

# Rough Singapore bounding box (rejects Melaka etc.)
_SG_LAT = (1.15, 1.48)
_SG_LNG = (103.6, 104.1)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("pipeline")


def _is_geocodable(name: Optional[str], address: Optional[str]) -> bool:
    if not name or not address:
        return False
    if _NON_SPECIFIC_ADDRESS.search(address):
        return False
    return True


def _in_singapore(lat: float, lng: float) -> bool:
    return _SG_LAT[0] <= lat <= _SG_LAT[1] and _SG_LNG[0] <= lng <= _SG_LNG[1]


def diagnose() -> None:
    """Print cache vs DB breakdown so low 'confirmed' counts are easy to explain."""
    ensure_discovered_places_table()
    cache = wp.load_cache()
    confirmed_urls = get_confirmed_source_urls()

    total = len(cache)
    already = 0
    no_restaurant = 0
    not_geocodable = 0
    pending = 0
    pending_samples: list[str] = []
    no_rest_samples: list[str] = []

    for url, article in cache.items():
        name = article.get("restaurant_name")
        address = article.get("location")
        if url in confirmed_urls:
            already += 1
            continue
        if not name or not address:
            no_restaurant += 1
            if len(no_rest_samples) < 5:
                no_rest_samples.append(url)
            continue
        if not _is_geocodable(name, address):
            not_geocodable += 1
            continue
        pending += 1
        if len(pending_samples) < 5:
            pending_samples.append(f"{name} | {address}")

    log.info("=== Pipeline diagnose ===")
    log.info("Cache articles:              %d", total)
    log.info("Already in DB:               %d", already)
    log.info("No restaurant widget:        %d", no_restaurant)
    log.info("Non-specific address:        %d", not_geocodable)
    log.info("Pending Places confirm:      %d", pending)
    log.info("DB discovered_places total:  %d", len(confirmed_urls))
    if no_rest_samples:
        log.info("No-restaurant examples:")
        for u in no_rest_samples:
            log.info("  %s", u)
    if pending_samples:
        log.info("Pending examples:")
        for s in pending_samples:
            log.info("  %s", s)


def confirm_and_persist(cache: dict, confirmed_urls: set[str]) -> dict[str, int]:
    """
    For each cached article with restaurant details, confirm via Google Places
    and insert into discovered_places.
    """
    stats = {
        "confirmed": 0,
        "already_in_db": 0,
        "no_restaurant": 0,
        "not_geocodable": 0,
        "failed": 0,
        "out_of_sg": 0,
    }

    for url, article in cache.items():
        if url in confirmed_urls:
            stats["already_in_db"] += 1
            continue

        name = article.get("restaurant_name")
        address = article.get("location")
        if not name or not address:
            stats["no_restaurant"] += 1
            continue
        if not _is_geocodable(name, address):
            stats["not_geocodable"] += 1
            log.info("Skip non-specific address: %s | %s", name, address)
            continue

        time.sleep(REQUEST_DELAY_SECONDS)
        place = find_place_by_text(name, address)
        if place is None:
            stats["failed"] += 1
            log.warning("No Places match: %s | %s | %s", name, address, url)
            continue

        if not _in_singapore(place.lat, place.lng):
            stats["out_of_sg"] += 1
            log.warning(
                "Reject non-SG match: %s → %s (%.5f, %.5f)",
                name,
                place.formatted_address,
                place.lat,
                place.lng,
            )
            continue

        insert_discovered_place(
            source_url=url,
            source_title=article.get("title"),
            source_category=article.get("category"),
            restaurant_name=name,
            source_address=address,
            google_place_id=place.google_place_id,
            google_name=place.google_name,
            formatted_address=place.formatted_address,
            lat=place.lat,
            lng=place.lng,
            rating=place.rating,
            user_rating_count=place.user_rating_count,
            business_status=place.business_status,
        )
        stats["confirmed"] += 1
        confirmed_urls.add(url)
        log.info(
            "Confirmed: %s → %s (%.5f, %.5f)",
            name,
            place.formatted_address,
            place.lat,
            place.lng,
        )

    return stats


def run(
    backfill_limit: Optional[int] = None,
    skip_scrape: bool = False,
) -> None:
    ensure_discovered_places_table()

    if not skip_scrape:
        log.info("Step 1/2: Scraping HungryGoWhere for new articles…")
        wp.run(backfill_limit=backfill_limit)
    else:
        log.info("Step 1/2: Skipping scrape (--skip-scrape)")

    log.info("Step 2/2: Confirming places with Google Places API…")
    cache = wp.load_cache()
    confirmed_urls = get_confirmed_source_urls()
    before = len(confirmed_urls)

    stats = confirm_and_persist(cache, confirmed_urls)
    after = len(get_confirmed_source_urls())

    log.info(
        "Done this run: %d newly confirmed, %d already in DB, %d no restaurant, "
        "%d non-specific address, %d Places miss, %d rejected (outside SG).",
        stats["confirmed"],
        stats["already_in_db"],
        stats["no_restaurant"],
        stats["not_geocodable"],
        stats["failed"],
        stats["out_of_sg"],
    )
    log.info("DB total: %d → %d discovered_places", before, after)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Scrape HungryGoWhere, confirm with Google Places, write to DB"
    )
    parser.add_argument(
        "--backfill",
        type=int,
        default=None,
        help="First-time backfill: scrape up to N new articles instead of "
        "stopping at the first already-scraped URL.",
    )
    parser.add_argument(
        "--skip-scrape",
        action="store_true",
        help="Skip the HGW scrape step and only confirm/persist cached articles.",
    )
    parser.add_argument(
        "--diagnose",
        action="store_true",
        help="Print cache/DB breakdown and exit (no scrape, no Places calls).",
    )
    args = parser.parse_args()
    if args.diagnose:
        diagnose()
    else:
        run(backfill_limit=args.backfill, skip_scrape=args.skip_scrape)
