# SQL table definitions
from sqlalchemy import Column, Integer, String, Boolean, Float
from database import Base

class Item(Base):
    __tablename__ = "food_items"
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    location = Column(String, nullable=False)
    category = Column(String, nullable=False)
    public = Column(Boolean, nullable=False)

    id = Column(Integer, primary_key=True, nullable=False)
    description = Column(String, nullable=True)
    submitted_by_user_id = Column(Integer, nullable=False)
    created_at = Column(Integer)

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True) # index=True automatically craete an index
    username = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)