from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

SQLALCHEMY_DATABASE_URL = "sqlite:///./app.db"

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}) # SQLite-specific - needed because FastAPI runs in multiple threads
SessionLocal = sessionmaker(bind=engine)

class Base(DeclarativeBase):
    pass