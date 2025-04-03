import asyncio
import logging
import os

# Add parent directory to path
import sys
from datetime import datetime, timedelta
from pathlib import Path

sys.path.append(str(Path(__file__).parent.parent))

from app.core.database import async_session, init_db
from app.services.db_service import CacheRepository, StockRepository
from app.services.stock_service import StockService

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Define popular stocks to seed
POPULAR_STOCKS = [
    "AAPL",
    "MSFT",
    "GOOGL",
    "AMZN",
    "TSLA",
    "META",
    "NVDA",
    "JPM",
    "V",
    "WMT",
]


async def seed_database():
    """Seed the database with initial stock data"""
    logger.info("Initializing the database...")
    await init_db()

    logger.info("Seeding the database with popular stocks...")
    async with async_session() as db:
        for symbol in POPULAR_STOCKS:
            logger.info(f"Fetching data for {symbol}...")
            try:
                # Get stock data (this will save to DB)
                stock_data = await StockService.get_stock_data(symbol, db)
                if stock_data:
                    logger.info(f"Successfully added {symbol} to database")
                else:
                    logger.error(f"Failed to fetch data for {symbol}")

                # Add a small delay to avoid API rate limits
                await asyncio.sleep(1)
            except Exception as e:
                logger.error(f"Error seeding {symbol}: {e}")

    logger.info("Database seeding completed")


async def clear_cache():
    """Clear all cache entries"""
    logger.info("Clearing API cache...")
    async with async_session() as db:
        try:
            # Execute raw SQL to delete all cache entries
            await db.execute("DELETE FROM api_cache")
            await db.commit()
            logger.info("Cache cleared successfully")
        except Exception as e:
            logger.error(f"Error clearing cache: {e}")


async def show_database_info():
    """Display information about the database"""
    logger.info("Fetching database information...")
    async with async_session() as db:
        try:
            # Get stock count
            result = await db.execute("SELECT COUNT(*) FROM stocks")
            stock_count = result.scalar()

            # Get price count
            result = await db.execute("SELECT COUNT(*) FROM stock_prices")
            price_count = result.scalar()

            # Get cache count
            result = await db.execute("SELECT COUNT(*) FROM api_cache")
            cache_count = result.scalar()

            # Get stock list
            result = await db.execute("SELECT symbol, name FROM stocks")
            stocks = result.fetchall()

            logger.info(
                f"Database contains {stock_count} stocks with {price_count} price records"
            )
            logger.info(f"Cache contains {cache_count} entries")

            if stocks:
                logger.info("Stocks in database:")
                for symbol, name in stocks:
                    logger.info(f"  - {symbol}: {name}")
        except Exception as e:
            logger.error(f"Error fetching database info: {e}")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Database management utility")
    parser.add_argument(
        "--seed", action="store_true", help="Seed the database with initial data"
    )
    parser.add_argument(
        "--clear-cache", action="store_true", help="Clear all cache entries"
    )
    parser.add_argument("--info", action="store_true", help="Show database information")

    args = parser.parse_args()

    if args.seed:
        asyncio.run(seed_database())
    elif args.clear_cache:
        asyncio.run(clear_cache())
    elif args.info:
        asyncio.run(show_database_info())
    else:
        parser.print_help()
