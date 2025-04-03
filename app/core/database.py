import os
from datetime import datetime, timedelta
from pathlib import Path

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    create_engine,
)
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker

# Create the database directory if it doesn't exist
db_dir = Path(__file__).parent.parent.parent / "data"
db_dir.mkdir(exist_ok=True)

# Database URL
SQLALCHEMY_DATABASE_URL = f"sqlite+aiosqlite:///{db_dir}/stock_data.db"

# Create async engine
engine = create_async_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

# Create sessionmaker
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

# Create base class for declarative models
Base = declarative_base()


class Stock(Base):
    """Model for stock information"""

    __tablename__ = "stocks"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    sector = Column(String, nullable=True)
    industry = Column(String, nullable=True)
    market_cap = Column(Float, nullable=True)
    pe_ratio = Column(Float, nullable=True)
    dividend_yield = Column(Float, nullable=True)
    last_updated = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    # Relationship with StockPrice
    prices = relationship(
        "StockPrice", back_populates="stock", cascade="all, delete-orphan"
    )

    # Add indexes
    __table_args__ = (Index("ix_stocks_symbol_name", "symbol", "name"),)


class StockPrice(Base):
    """Model for stock price data"""

    __tablename__ = "stock_prices"

    id = Column(Integer, primary_key=True, index=True)
    stock_id = Column(
        Integer, ForeignKey("stocks.id", ondelete="CASCADE"), nullable=False
    )
    date = Column(DateTime, nullable=False)
    open = Column(Float, nullable=False)
    high = Column(Float, nullable=False)
    low = Column(Float, nullable=False)
    close = Column(Float, nullable=False)
    volume = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.now)

    # Relationship with Stock
    stock = relationship("Stock", back_populates="prices")

    # Add unique constraint and indexes
    __table_args__ = (
        UniqueConstraint("stock_id", "date", name="uq_stock_date"),
        Index("ix_stock_prices_date", "date"),
        Index("ix_stock_prices_stock_id_date", "stock_id", "date"),
    )


class APICache(Base):
    """Model for caching API responses"""

    __tablename__ = "api_cache"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True, nullable=False)
    data = Column(String, nullable=False)  # Stored as JSON string
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.now)


async def get_db():
    """Dependency for getting database session"""
    async with async_session() as session:
        yield session


async def init_db():
    """Initialize database, creating tables if they don't exist"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    print("Database initialized")
