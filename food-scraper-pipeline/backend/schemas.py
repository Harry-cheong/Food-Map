# pydantic shapes for requests/responses
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Literal

ListStatus = Literal["to_try", "tried"]

# For creating/receiving items (input)
class ItemBase(BaseModel):
    name: str
    lat: float
    lng: float
    location: str
    category: str
    description: str
    public: bool
    list_status: ListStatus = Field(default="to_try")

# For returning items (output) — includes DB-generated fields
class ItemResponse(ItemBase):
    id: int
    submitted_by_user_id: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ItemListStatusUpdate(BaseModel):
    list_status: ListStatus

class MessageResponse(BaseModel):
    message: str

class User(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    token: str
    token_type: str = "bearer"


class DiscoveredPlaceResponse(BaseModel):
    id: int
    source_url: str
    source_title: str | None = None
    source_category: str | None = None
    restaurant_name: str
    source_address: str | None = None
    google_place_id: str
    google_name: str
    formatted_address: str
    lat: float
    lng: float
    rating: float | None = None
    user_rating_count: int | None = None
    business_status: str | None = None
    confirmed_at: datetime

    model_config = {"from_attributes": True}


class DiscoveredPage(BaseModel):
    items: list[DiscoveredPlaceResponse]
    total: int
    limit: int
    offset: int
    has_more: bool


class PlaceSearchResult(BaseModel):
    google_place_id: str
    name: str
    formatted_address: str
    lat: float
    lng: float
    rating: float | None = None
    user_rating_count: int | None = None
    business_status: str | None = None


class PlaceSearchPage(BaseModel):
    items: list[PlaceSearchResult]
    query: str
