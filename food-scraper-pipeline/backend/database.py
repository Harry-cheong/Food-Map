import os

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

load_dotenv()

DB_USER = os.getenv("POSTGRES_USER", "harry")
DB_PASSWORD = os.getenv("POSTGRES_PASSWORD", "devpassword")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("POSTGRES_DB", "food_scraper")

SQLALCHEMY_DATABASE_URL = (
    f"postgresql+psycopg://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
)

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)

class Base(DeclarativeBase):
    pass


def ensure_user_fav_google_place_id() -> None:
    """
    Add google_place_id + per-user unique index to existing DBs
    that were created before this column existed.
    """
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                ALTER TABLE user_fav
                ADD COLUMN IF NOT EXISTS google_place_id TEXT
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS idx_user_fav_user_google_place
                ON user_fav (submitted_by_user_id, google_place_id)
                WHERE google_place_id IS NOT NULL
                """
            )
        )
