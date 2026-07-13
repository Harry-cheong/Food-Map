# pydantic shapes for requests/responses
from pydantic import BaseModel
from datetime import datetime

# For creating/receiving items (input)
class ItemBase(BaseModel):
    name: str
    lat: float
    lng: float
    location: str
    category: str
    description: str
    public: bool

# For returning items (output) — includes DB-generated fields
class ItemResponse(ItemBase):
    id: int
    submitted_by_user_id: int
    created_at: datetime

    model_config = {"from_attributes": True}

class MessageResponse(BaseModel):
    message: str

class User(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    token: str
    token_type: str = "bearer"