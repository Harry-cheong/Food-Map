from fastapi import FastAPI, Depends, HTTPException, status, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import or_, func
from sqlalchemy.orm import Session
from typing import Literal
import models, schemas
import auth
import jwt
from database import SessionLocal
import datetime
import places_search


app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],      # or ["*"] for all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
security = HTTPBearer()

# Make up a custom secure token. It must match what you type in the Meta Dashboard.
VERIFY_TOKEN = "very-secure-food-token"

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return int(user_id)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

@app.post("/login", response_model=schemas.LoginResponse)
def generate_token(credientials: schemas.User, db: Session = Depends(get_db)):
    # Look up the user
    user = db.query(models.User).filter(models.User.username == credientials.username).first()

    # Validate
    if not user or not auth.verify_password(credientials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Invalid username or password"
        )

    return schemas.LoginResponse(
        token=auth.create_access_token(user.id, user.username),
    )

@app.post("/newuser", response_model=schemas.MessageResponse)
def create_user(user: schemas.User, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.username == user.username).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already taken",
        )

    db_item = models.User(username=user.username, hashed_password=auth.hash_password(user.password))
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return {"message": f"Successfully created account for {db_item.username}"}

@app.post("/items", response_model=schemas.ItemResponse)
def create_item(item: schemas.ItemBase, db: Session = Depends(get_db), user_id: int = Depends(get_current_user)):
    payload = item.model_dump()
    payload["named_address"] = payload.pop("location")
    db_item = models.Item(
        **payload,
        submitted_by_user_id=user_id,
        created_at=datetime.datetime.now(datetime.timezone.utc),
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@app.delete("/delete/{item_id}", response_model=schemas.MessageResponse)
def delete_item(item_id: int, db: Session = Depends(get_db), user_id: int = Depends(get_current_user)):
    item = db.query(models.Item).filter(
        models.Item.id == item_id,
        models.Item.submitted_by_user_id == user_id
    ).first()

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    db.delete(item) # .delete() doesnt take filter arguments, filter first then call .delete()
    db.commit()

    return {"message": "Item deleted successfully"}


@app.patch("/items/{item_id}", response_model=schemas.ItemResponse)
def update_item_list_status(
    item_id: int,
    body: schemas.ItemListStatusUpdate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    item = db.query(models.Item).filter(
        models.Item.id == item_id,
        models.Item.submitted_by_user_id == user_id,
    ).first()

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    item.list_status = body.list_status
    db.commit()
    db.refresh(item)
    return item


@app.get("/items/me", response_model=list[schemas.ItemResponse])
def get_item(db: Session = Depends(get_db), user_id: int = Depends(get_current_user)):
    return db.query(models.Item).filter(models.Item.submitted_by_user_id == user_id).all()

@app.get("/discovered", response_model=schemas.DiscoveredPage)
def list_discovered(
    limit: int = Query(15, ge=1, le=50),
    offset: int = Query(0, ge=0),
    q: str | None = Query(None, max_length=200),
    sort: Literal["recent", "rating", "reviews"] = Query("recent"),
    db: Session = Depends(get_db),
):
    """Paginated discovery feed from the HGW → Places scraper (no auth required)."""
    query = db.query(models.DiscoveredPlace)

    if q and (term := q.strip()):
        pattern = f"%{term}%"
        query = query.filter(
            or_(
                models.DiscoveredPlace.restaurant_name.ilike(pattern),
                models.DiscoveredPlace.google_name.ilike(pattern),
                models.DiscoveredPlace.formatted_address.ilike(pattern),
                models.DiscoveredPlace.source_title.ilike(pattern),
                models.DiscoveredPlace.source_category.ilike(pattern),
                models.DiscoveredPlace.source_address.ilike(pattern),
            )
        )

    if sort == "rating":
        order = (
            models.DiscoveredPlace.rating.desc().nulls_last(),
            models.DiscoveredPlace.user_rating_count.desc().nulls_last(),
            models.DiscoveredPlace.confirmed_at.desc(),
        )
    elif sort == "reviews":
        order = (
            models.DiscoveredPlace.user_rating_count.desc().nulls_last(),
            models.DiscoveredPlace.rating.desc().nulls_last(),
            models.DiscoveredPlace.confirmed_at.desc(),
        )
    else:
        order = (models.DiscoveredPlace.confirmed_at.desc(),)

    total = query.with_entities(func.count(models.DiscoveredPlace.id)).scalar() or 0
    items = query.order_by(*order).offset(offset).limit(limit).all()

    return schemas.DiscoveredPage(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
        has_more=offset + len(items) < total,
    )

def _place_search_page(hits: list[places_search.PlaceHit], query: str) -> schemas.PlaceSearchPage:
    return schemas.PlaceSearchPage(
        items=[
            schemas.PlaceSearchResult(
                google_place_id=hit.google_place_id,
                name=hit.name,
                formatted_address=hit.formatted_address,
                lat=hit.lat,
                lng=hit.lng,
                rating=hit.rating,
                user_rating_count=hit.user_rating_count,
                business_status=hit.business_status,
            )
            for hit in hits
        ],
        query=query,
    )


@app.get("/places/search", response_model=schemas.PlaceSearchPage)
def search_places(
    q: str = Query(..., min_length=2, max_length=200),
):
    """Live Google Places restaurant search (Singapore-biased). No auth required."""
    term = q.strip()
    if len(term) < 2:
        raise HTTPException(status_code=400, detail="Query must be at least 2 characters")

    try:
        hits = places_search.search_restaurants(term)
    except places_search.PlacesSearchError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    return _place_search_page(hits, term)


@app.get("/places/nearby", response_model=schemas.PlaceSearchPage)
def search_places_nearby(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius: float = Query(1000, ge=1, le=50000),
):
    """Live Google Places nearby restaurant search within a radius (meters). No auth required."""
    try:
        hits = places_search.search_restaurants_nearby(lat, lng, radius)
    except places_search.PlacesSearchError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    return _place_search_page(hits, f"nearby:{lat:.5f},{lng:.5f}:{int(radius)}m")
