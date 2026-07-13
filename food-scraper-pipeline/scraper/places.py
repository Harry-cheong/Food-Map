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
FIELD_MASK = (
    "places.id,places.displayName,places.formattedAddress,"
    "places.location,places.businessStatus,places.rating,places.userRatingCount"
)


@dataclass
class ConfirmedPlace:
    google_place_id: str
    google_name: str
    formatted_address: str
    lat: float
    lng: float
    rating: Optional[float]
    user_rating_count: Optional[int]
    business_status: Optional[str]


def _api_key() -> str:
    key = os.getenv("GOOGLE_PLACES_API_KEY")
    if not key:
        raise RuntimeError("GOOGLE_PLACES_API_KEY is not set")
    return key


def find_place_by_text(name: str, address_or_postal: str) -> Optional[ConfirmedPlace]:
    """Search Google Places Text Search and return the top match, or None."""
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": _api_key(),
        "X-Goog-FieldMask": FIELD_MASK,
    }
    body = {
        "textQuery": f"{name}, {address_or_postal}, Singapore",
        "maxResultCount": 1,
        "regionCode": "SG",
    }

    resp = requests.post(PLACES_SEARCH_URL, headers=headers, json=body, timeout=15)
    if not resp.ok:
        log.warning("Places API error (%s): %s", resp.status_code, resp.text[:300])
        return None

    places = resp.json().get("places", [])
    if not places:
        return None

    place = places[0]
    location = place.get("location") or {}
    lat = location.get("latitude")
    lng = location.get("longitude")
    if lat is None or lng is None:
        return None

    display_name = place.get("displayName") or {}
    return ConfirmedPlace(
        google_place_id=place["id"],
        google_name=display_name.get("text", name),
        formatted_address=place.get("formattedAddress", address_or_postal),
        lat=lat,
        lng=lng,
        rating=place.get("rating"),
        user_rating_count=place.get("userRatingCount"),
        business_status=place.get("businessStatus"),
    )
