from __future__ import annotations

import argparse
import json
import logging
import re
import time
import xml.etree.ElementTree as ET
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

BASE_URL = "https://hungrygowhere.com"
SITEMAP_INDEX_URL = f"{BASE_URL}/sitemap_index.xml"
SITEMAP_NS = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}

REQUEST_DELAY_SECONDS = 1.5  # be a good citizen between requests
REQUEST_TIMEOUT = 15

HEADERS = {
    # A standard browser UA — many WP security plugins (Wordfence etc.)
    # pattern-match on bot-labeled UAs and return a blanket 403/500.
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    )
}

CACHE_FILE = Path(__file__).parent / "hgw_articles_cache.json"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("hgw_scraper")


# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------

@dataclass
class Article:
    url: str
    title: Optional[str]
    category: Optional[str]
    last_modified: Optional[datetime]  # from sitemap <lastmod> — not the
                                        # original publish date, WP updates
                                        # this on any edit too
    restaurant_name: Optional[str] = None
    location: Optional[str] = None


# ---------------------------------------------------------------------------
# Storage — plain JSON file, keyed by URL
#
# Swap this section out for Postgres (or anything else) later. Every other
# function only calls load_cache() / url_already_scraped() / save_article(),
# so that's all you'd need to re-point.
# ---------------------------------------------------------------------------

def load_cache() -> dict:
    if not CACHE_FILE.exists():
        return {}
    with open(CACHE_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def write_cache(cache: dict) -> None:
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(cache, f, indent=2, default=str)


def url_already_scraped(cache: dict, url: str) -> bool:
    return url in cache


def save_article(cache: dict, article: Article) -> None:
    """Adds/updates the article in the in-memory cache dict. Caller is
    responsible for calling write_cache() to persist to disk."""
    cache[article.url] = asdict(article)


# ---------------------------------------------------------------------------
# Sitemap parsing helpers
# ---------------------------------------------------------------------------

def _parse_lastmod(el: Optional[ET.Element]) -> Optional[datetime]:
    if el is None or not el.text:
        return None
    try:
        return datetime.fromisoformat(el.text)
    except ValueError:
        return None


def fetch_xml(url: str) -> ET.Element:
    resp = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
    if not resp.ok:
        log.error(
            "Request failed (%s) for %s. Response body: %s",
            resp.status_code,
            url,
            resp.text[:500],
        )
    resp.raise_for_status()
    return ET.fromstring(resp.content)


_SITEMAP_NUM_RE = re.compile(r"post-sitemap(\d+)\.xml")


def _sitemap_sort_key(loc: str, lastmod: Optional[datetime]) -> tuple:
    """
    Yoast batches posts into post-sitemap1.xml, post-sitemap2.xml, etc.
    SEQUENTIALLY as they're created, so the highest-numbered file reliably
    holds the newest posts. The index-level <lastmod> per file is NOT a
    reliable signal for this — some Yoast configs touch every file's
    lastmod whenever any post anywhere changes, which can make an old
    file look "newest". So: sort by the numeric suffix first, and only
    fall back to lastmod if a filename doesn't match the expected pattern.
    """
    match = _SITEMAP_NUM_RE.search(loc)
    if match:
        return (1, int(match.group(1)))  # tier 1: trust the number
    return (0, lastmod or datetime.min.replace(tzinfo=timezone.utc))  # tier 0: fallback


def get_post_sitemaps() -> list[tuple[str, Optional[datetime]]]:
    """
    Reads sitemap_index.xml and returns [(sitemap_url, lastmod), ...] for
    the post-related sub-sitemaps only (skips page/category/author/etc
    sitemaps), sorted newest-first by filename number (see
    _sitemap_sort_key for why we don't trust the index-level lastmod here).
    """
    root = fetch_xml(SITEMAP_INDEX_URL)
    sitemaps = []
    for sitemap_el in root.findall("sm:sitemap", SITEMAP_NS):
        loc_el = sitemap_el.find("sm:loc", SITEMAP_NS)
        if loc_el is None or not loc_el.text:
            continue
        loc = loc_el.text.strip()
        if "post-sitemap" not in loc:
            continue
        lastmod = _parse_lastmod(sitemap_el.find("sm:lastmod", SITEMAP_NS))
        sitemaps.append((loc, lastmod))

    sitemaps.sort(key=lambda pair: _sitemap_sort_key(*pair), reverse=True)
    return sitemaps


def get_urls_from_sitemap(sitemap_url: str) -> list[tuple[str, Optional[datetime]]]:
    """Returns [(article_url, lastmod), ...] from one post-sitemap file,
    sorted newest-lastmod first."""
    root = fetch_xml(sitemap_url)
    urls = []
    for url_el in root.findall("sm:url", SITEMAP_NS):
        loc_el = url_el.find("sm:loc", SITEMAP_NS)
        if loc_el is None or not loc_el.text:
            continue
        loc = loc_el.text.strip()
        lastmod = _parse_lastmod(url_el.find("sm:lastmod", SITEMAP_NS))
        urls.append((loc, lastmod))

    urls.sort(key=lambda pair: pair[1] or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    return urls


def category_from_url(url: str) -> Optional[str]:
    """HGW URLs look like /food-news/slug/ or /critics-reviews/slug/ — the
    first path segment doubles as the category, no extra request needed."""
    path = urlparse(url).path.strip("/")
    if not path:
        return None
    return path.split("/")[0]


# ---------------------------------------------------------------------------
# Listing: walk the sitemap newest-first
# ---------------------------------------------------------------------------

def iter_new_articles(cache: dict, backfill_limit: Optional[int] = None):
    """
    Yields Article objects (title/restaurant info not filled in yet) for
    URLs not already in the cache, walking newest-first across sitemap
    files.

    If backfill_limit is None: stops as soon as an already-scraped URL is
    hit (normal daily-cron behaviour) — since we walk newest-first, that
    means everything after it is guaranteed already scraped too.
    If backfill_limit is set: ignores that short-circuit and just walks up
    to `backfill_limit` articles total, across as many sitemap files as
    needed (useful for the first run).
    """
    sitemaps = get_post_sitemaps()
    if not sitemaps:
        log.warning("No post-sitemap files found under %s", SITEMAP_INDEX_URL)
        return

    seen_count = 0
    for sitemap_url, _ in sitemaps:
        time.sleep(REQUEST_DELAY_SECONDS)
        urls = get_urls_from_sitemap(sitemap_url)

        for url, lastmod in urls:
            if backfill_limit is None and url_already_scraped(cache, url):
                log.info("Hit already-scraped URL (%s) — stopping.", url)
                return

            if url_already_scraped(cache, url):
                continue  # backfill mode: skip but keep walking

            yield Article(
                url=url,
                title=None,
                category=category_from_url(url),
                last_modified=lastmod,
            )
            seen_count += 1
            if backfill_limit is not None and seen_count >= backfill_limit:
                return


# ---------------------------------------------------------------------------
# Article detail: title + restaurant name + location (single page fetch)
# ---------------------------------------------------------------------------

def scrape_article_details(url: str) -> tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Fetches an article page once and pulls out:
      - title (from the og:title meta tag)
      - restaurant name + address, from the accordion widget
        (None, None if the article doesn't have one — e.g. listicles)
    """
    resp = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    title = None
    og_title = soup.select_one('meta[property="og:title"]')
    if og_title and og_title.get("content"):
        title = og_title["content"].strip()
    elif soup.select_one("h1"):
        title = soup.select_one("h1").get_text(strip=True)

    details = soup.select_one(".restaurant-details")
    if details is None:
        return title, None, None

    # First accordion item is the venue (map-marker); later items are hours/MRT.
    first_item = details.select_one(".accordion-item")
    if first_item is None:
        return title, None, None

    name_tag = first_item.select_one(".accordion-header button")
    location_tag = first_item.select_one(".accordion-body")

    # strip=True alone joins with "" and glues words ("outletsislandwide").
    name = name_tag.get_text(" ", strip=True) if name_tag else None
    location = location_tag.get_text(" ", strip=True) if location_tag else None
    return title, name, location


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def run(backfill_limit: Optional[int] = None) -> None:
    cache = load_cache()
    new_count = 0
    error_count = 0

    try:
        for article in iter_new_articles(cache, backfill_limit=backfill_limit):
            try:
                time.sleep(REQUEST_DELAY_SECONDS)
                title, name, location = scrape_article_details(article.url)
                article.title = title
                article.restaurant_name = name
                article.location = location

                save_article(cache, article)
                new_count += 1
                log.info("Saved: %s | %s | %s", title, name, location)
            except requests.RequestException as exc:
                error_count += 1
                log.warning("Failed to fetch %s: %s", article.url, exc)
            except Exception as exc:  # don't let one bad article kill the run
                error_count += 1
                log.warning("Unexpected error on %s: %s", article.url, exc)
    finally:
        write_cache(cache)  # persist whatever we managed to scrape, even on error

    log.info("Done. %d new articles saved, %d errors.", new_count, error_count)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="HungryGoWhere article scraper")
    parser.add_argument(
        "--backfill",
        type=int,
        default=None,
        help="First-time backfill: walk up to N articles instead of "
        "stopping at the first already-scraped URL.",
    )
    args = parser.parse_args()
    run(backfill_limit=args.backfill)