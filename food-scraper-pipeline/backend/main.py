from fastapi import FastAPI, Depends, HTTPException, status, Query, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any
from sqlalchemy.orm import Session
import models, schemas
import auth
import jwt
from database import SessionLocal
import datetime

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

@app.get("/items/me", response_model=list[schemas.ItemResponse])
def get_item(db: Session = Depends(get_db), user_id: int = Depends(get_current_user)):
    return db.query(models.Item).filter(models.Item.submitted_by_user_id == user_id).all()