from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

log = logging.getLogger(__name__)

PLACES_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
PLACES_NEARBY_URL = "https://places.googleapis.com/v1/places:searchNearby"
FIELD_MASK = (
    "places.id,places.displayName,places.formattedAddress,"
    "places.location,places.businessStatus,places.rating,places.userRatingCount"
)
DEFAULT_MAX_RESULTS = 8
DEFAULT_NEARBY_MAX_RESULTS = 20
MIN_RADIUS_M = 1.0
MAX_RADIUS_M = 50000.0


@dataclass
class PlaceHit:
    google_place_id: str
    name: str
    formatted_address: str
    lat: float
    lng: float
    rating: Optional[float]
    user_rating_count: Optional[int]
    business_status: Optional[str]


class PlacesSearchError(Exception):
    """Upstream Google Places failure."""

    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


def _api_key() -> str:
    key = os.getenv("GOOGLE_PLACES_API_KEY")
    if not key:
        raise PlacesSearchError("GOOGLE_PLACES_API_KEY is not set")
    return key


def _headers() -> dict[str, str]:
    return {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": _api_key(),
        "X-Goog-FieldMask": FIELD_MASK,
    }


def _parse_hits(payload: dict, *, fallback_name: str = "Restaurant") -> list[PlaceHit]:
    hits: list[PlaceHit] = []
    for place in payload.get("places", []):
        location = place.get("location") or {}
        lat = location.get("latitude")
        lng = location.get("longitude")
        if lat is None or lng is None:
            continue

        place_id = place.get("id")
        if not place_id:
            continue

        display_name = place.get("displayName") or {}
        hits.append(
            PlaceHit(
                google_place_id=place_id,
                name=display_name.get("text") or fallback_name,
                formatted_address=place.get("formattedAddress") or "",
                lat=lat,
                lng=lng,
                rating=place.get("rating"),
                user_rating_count=place.get("userRatingCount"),
                business_status=place.get("businessStatus"),
            )
        )
    return hits


def _post_places(url: str, body: dict) -> dict:
    try:
        resp = requests.post(url, headers=_headers(), json=body, timeout=15)
    except requests.RequestException as exc:
        log.warning("Places API request failed: %s", exc)
        raise PlacesSearchError("Could not reach Google Places") from exc

    if not resp.ok:
        log.warning("Places API error (%s): %s", resp.status_code, resp.text[:300])
        raise PlacesSearchError("Google Places search failed", status_code=resp.status_code)

    return resp.json()


def search_restaurants(query: str, *, max_results: int = DEFAULT_MAX_RESULTS) -> list[PlaceHit]:
    """
    Live Google Places Text Search for restaurants (Singapore-biased).
    """
    term = query.strip()
    if not term:
        return []

    body = {
        "textQuery": f"{term} restaurant Singapore",
        "maxResultCount": max(1, min(max_results, 20)),
        "regionCode": "SG",
        "includedType": "restaurant",
    }
    return _parse_hits(_post_places(PLACES_SEARCH_URL, body), fallback_name=term)


def search_restaurants_nearby(
    lat: float,
    lng: float,
    radius_m: float,
    *,
    max_results: int = DEFAULT_NEARBY_MAX_RESULTS,
) -> list[PlaceHit]:
    """
    Live Google Places Nearby Search for restaurants within a circle.
    """
    radius = max(MIN_RADIUS_M, min(float(radius_m), MAX_RADIUS_M))
    body = {
        "includedTypes": ["restaurant"],
        "maxResultCount": max(1, min(max_results, 20)),
        "rankPreference": "DISTANCE",
        "regionCode": "SG",
        "locationRestriction": {
            "circle": {
                "center": {"latitude": lat, "longitude": lng},
                "radius": radius,
            }
        },
    }
    return _parse_hits(_post_places(PLACES_NEARBY_URL, body))
