import json
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import delete, func, select, update
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import APICache, Stock, StockPrice
from app.models.stock import StockData, StockOverview
from app.models.stock import StockPrice as StockPriceModel

logger = logging.getLogger(__name__)


class StockRepository:
    """Repository for database operations related to stocks"""

    @staticmethod
    async def get_stock_by_symbol(db: AsyncSession, symbol: str) -> Optional[Stock]:
        """Get a stock from the database by symbol"""
        try:
            result = await db.execute(select(Stock).where(Stock.symbol == symbol))
            return result.scalars().first()
        except SQLAlchemyError as e:
            logger.error(f"Database error when fetching stock {symbol}: {e}")
            return None

    @staticmethod
    async def save_stock(
        db: AsyncSession, stock_data: StockOverview
    ) -> Optional[Stock]:
        """Save or update stock information"""
        try:
            # Check if stock already exists
            existing_stock = await StockRepository.get_stock_by_symbol(
                db, stock_data.symbol
            )

            if existing_stock:
                # Update existing stock
                existing_stock.name = stock_data.name
                existing_stock.sector = stock_data.sector
                existing_stock.industry = stock_data.industry
                existing_stock.market_cap = stock_data.market_cap
                existing_stock.pe_ratio = stock_data.pe_ratio
                existing_stock.dividend_yield = stock_data.dividend_yield
                existing_stock.last_updated = datetime.now()

                await db.commit()
                return existing_stock
            else:
                # Create new stock
                new_stock = Stock(
                    symbol=stock_data.symbol,
                    name=stock_data.name,
                    sector=stock_data.sector,
                    industry=stock_data.industry,
                    market_cap=stock_data.market_cap,
                    pe_ratio=stock_data.pe_ratio,
                    dividend_yield=stock_data.dividend_yield,
                )

                db.add(new_stock)
                await db.commit()
                await db.refresh(new_stock)
                return new_stock
        except SQLAlchemyError as e:
            await db.rollback()
            logger.error(f"Database error when saving stock {stock_data.symbol}: {e}")
            return None

    @staticmethod
    async def save_stock_prices(
        db: AsyncSession, stock_id: int, prices: List[StockPriceModel]
    ) -> bool:
        """Save stock prices to the database"""
        try:
            # Create database models from API models
            db_prices = []
            for price in prices:
                # Check if price already exists
                result = await db.execute(
                    select(StockPrice).where(
                        StockPrice.stock_id == stock_id, StockPrice.date == price.date
                    )
                )
                existing_price = result.scalars().first()

                if existing_price:
                    # Update existing price
                    existing_price.open = price.open
                    existing_price.high = price.high
                    existing_price.low = price.low
                    existing_price.close = price.close
                    existing_price.volume = price.volume
                else:
                    # Create new price
                    db_price = StockPrice(
                        stock_id=stock_id,
                        date=price.date,
                        open=price.open,
                        high=price.high,
                        low=price.low,
                        close=price.close,
                        volume=price.volume,
                    )
                    db.add(db_price)

            await db.commit()
            return True
        except SQLAlchemyError as e:
            await db.rollback()
            logger.error(
                f"Database error when saving prices for stock ID {stock_id}: {e}"
            )
            return False

    @staticmethod
    async def get_stock_prices(
        db: AsyncSession, stock_id: int, days: int = None
    ) -> List[StockPrice]:
        """Get stock prices from the database"""
        try:
            query = (
                select(StockPrice)
                .where(StockPrice.stock_id == stock_id)
                .order_by(StockPrice.date.desc())
            )

            if days:
                # Limit by days
                date_limit = datetime.now() - timedelta(days=days)
                query = query.where(StockPrice.date >= date_limit)

            result = await db.execute(query)
            return result.scalars().all()
        except SQLAlchemyError as e:
            logger.error(
                f"Database error when fetching prices for stock ID {stock_id}: {e}"
            )
            return []

    @staticmethod
    async def get_popular_stocks(
        db: AsyncSession, symbols: List[str]
    ) -> List[Tuple[Stock, StockPrice]]:
        """Get popular stocks with their latest prices"""
        try:
            # Subquery to get the latest price date for each stock
            latest_price_date_subquery = (
                select(StockPrice.stock_id, func.max(StockPrice.date).label("max_date"))
                .group_by(StockPrice.stock_id)
                .subquery()
            )

            # Query to get stocks and their latest prices
            query = (
                select(Stock, StockPrice)
                .join(
                    latest_price_date_subquery,
                    Stock.id == latest_price_date_subquery.c.stock_id,
                )
                .join(
                    StockPrice,
                    (StockPrice.stock_id == latest_price_date_subquery.c.stock_id)
                    & (StockPrice.date == latest_price_date_subquery.c.max_date),
                )
                .where(Stock.symbol.in_(symbols))
            )

            result = await db.execute(query)
            return result.all()
        except SQLAlchemyError as e:
            logger.error(f"Database error when fetching popular stocks: {e}")
            return []

    @staticmethod
    async def search_stocks(
        db: AsyncSession, query: str, limit: int = 10
    ) -> List[Stock]:
        """Search for stocks by symbol or name"""
        try:
            result = await db.execute(
                select(Stock)
                .where(
                    (Stock.symbol.ilike(f"%{query}%"))
                    | (Stock.name.ilike(f"%{query}%"))
                )
                .limit(limit)
            )
            return result.scalars().all()
        except SQLAlchemyError as e:
            logger.error(f"Database error when searching stocks: {e}")
            return []


class CacheRepository:
    """Repository for API cache operations"""

    @staticmethod
    async def get_cached_data(db: AsyncSession, key: str) -> Optional[str]:
        """Get cached data by key if not expired"""
        try:
            result = await db.execute(
                select(APICache).where(
                    (APICache.key == key) & (APICache.expires_at > datetime.now())
                )
            )
            cache_entry = result.scalars().first()

            if cache_entry:
                return cache_entry.data
            return None
        except SQLAlchemyError as e:
            logger.error(f"Database error when getting cache for {key}: {e}")
            return None

    @staticmethod
    async def set_cached_data(
        db: AsyncSession, key: str, data: Any, expire_seconds: int = 3600
    ) -> bool:
        """Set data in cache with expiration time"""
        try:
            # Convert data to JSON string
            data_str = json.dumps(data)

            # Check if key already exists
            result = await db.execute(select(APICache).where(APICache.key == key))
            existing_cache = result.scalars().first()

            expires_at = datetime.now() + timedelta(seconds=expire_seconds)

            if existing_cache:
                # Update existing cache
                existing_cache.data = data_str
                existing_cache.expires_at = expires_at
                existing_cache.created_at = datetime.now()
            else:
                # Create new cache entry
                cache_entry = APICache(key=key, data=data_str, expires_at=expires_at)
                db.add(cache_entry)

            await db.commit()
            return True
        except SQLAlchemyError as e:
            await db.rollback()
            logger.error(f"Database error when setting cache for {key}: {e}")
            return False

    @staticmethod
    async def invalidate_cache(db: AsyncSession, key: str) -> bool:
        """Invalidate cache for a specific key"""
        try:
            await db.execute(delete(APICache).where(APICache.key == key))
            await db.commit()
            return True
        except SQLAlchemyError as e:
            await db.rollback()
            logger.error(f"Database error when invalidating cache for {key}: {e}")
            return False

    @staticmethod
    async def clear_expired_cache(db: AsyncSession) -> int:
        """Clear all expired cache entries and return count of deleted entries"""
        try:
            result = await db.execute(
                delete(APICache).where(APICache.expires_at <= datetime.now())
            )
            deleted_count = result.rowcount
            await db.commit()
            return deleted_count
        except SQLAlchemyError as e:
            await db.rollback()
            logger.error(f"Database error when clearing expired cache: {e}")
            return 0
