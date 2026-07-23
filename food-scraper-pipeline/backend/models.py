from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, synonym

from database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String, nullable=False, unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Item(Base):
    __tablename__ = "user_fav"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    named_address: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False)
    public: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    list_status: Mapped[str] = mapped_column(String, nullable=False, default="to_try")
    submitted_by_user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False)

    # API field `location` maps to the named_address column.
    location = synonym("named_address")


class DiscoveredPlace(Base):
    __tablename__ = "discovered_places"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_url: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    source_title: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_category: Mapped[str | None] = mapped_column(String, nullable=True)
    restaurant_name: Mapped[str] = mapped_column(String, nullable=False)
    source_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    google_place_id: Mapped[str] = mapped_column(String, nullable=False)
    google_name: Mapped[str] = mapped_column(String, nullable=False)
    formatted_address: Mapped[str] = mapped_column(Text, nullable=False)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    rating: Mapped[float | None] = mapped_column(Float, nullable=True)
    user_rating_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    business_status: Mapped[str | None] = mapped_column(String, nullable=True)
    confirmed_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
