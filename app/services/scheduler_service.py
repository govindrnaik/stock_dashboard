import asyncio
import logging
from datetime import datetime, time, timedelta
from typing import List, Optional

import pytz
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session, get_db
from app.services.db_service import CacheRepository, StockRepository
from app.services.stock_service import StockService

logger = logging.getLogger(__name__)


class SchedulerService:
    """Service for scheduling tasks to update stock data periodically"""

    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self.popular_symbols = [
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

    def start(self):
        """Start the scheduler"""
        if not self.scheduler.running:
            # Schedule daily update of stock data (during market off-hours)
            # Run at 1:30 AM Eastern Time (market is closed)
            eastern_tz = pytz.timezone("US/Eastern")
            self.scheduler.add_job(
                self.update_stock_data,
                CronTrigger(hour=1, minute=30, timezone=eastern_tz),
                id="daily_stock_update",
                replace_existing=True,
            )

            # Schedule cache cleanup (every 4 hours)
            self.scheduler.add_job(
                self.cleanup_cache,
                CronTrigger(hour="*/4"),
                id="cache_cleanup",
                replace_existing=True,
            )

            # Schedule hourly update of popular stocks during market hours
            # Market hours: 9:30 AM - 4:00 PM Eastern Time, Monday-Friday
            self.scheduler.add_job(
                self.update_popular_stocks,
                CronTrigger(
                    day_of_week="mon-fri",
                    hour="9-16",
                    minute="*/30",  # Every 30 minutes
                    timezone=eastern_tz,
                ),
                id="hourly_popular_update",
                replace_existing=True,
            )

            # Run an initial update when the app starts
            self.scheduler.add_job(
                self.update_popular_stocks,
                "date",
                run_date=datetime.now() + timedelta(seconds=10),
                id="initial_update",
                replace_existing=True,
            )

            self.scheduler.start()
            logger.info("Scheduler started")
        else:
            logger.info("Scheduler already running")

    def shutdown(self):
        """Shutdown the scheduler"""
        if self.scheduler.running:
            self.scheduler.shutdown()
            logger.info("Scheduler shutdown")

    async def update_stock_data(self):
        """Update all stock data in the database"""
        logger.info("Running scheduled update of all stock data")
        try:
            async with async_session() as db:
                # Get all stock symbols from the database
                result = await db.execute("SELECT symbol FROM stocks")
                symbols = [row[0] for row in result.fetchall()]

                if not symbols:
                    logger.info("No stocks in database to update")
                    return

                logger.info(f"Updating {len(symbols)} stocks")

                # Update each stock one by one
                for symbol in symbols:
                    try:
                        await StockService.get_stock_data(symbol, db)
                        await StockService.get_stock_overview(symbol, db)
                        await asyncio.sleep(0.5)  # Avoid hitting API rate limits
                    except Exception as e:
                        logger.error(f"Error updating {symbol}: {e}")

                logger.info("Stock data update completed")
        except Exception as e:
            logger.error(f"Error in scheduled stock data update: {e}")

    async def update_popular_stocks(self):
        """Update popular stock data"""
        logger.info("Running scheduled update of popular stocks")
        try:
            async with async_session() as db:
                logger.info(f"Updating {len(self.popular_symbols)} popular stocks")

                # Update each popular stock
                for symbol in self.popular_symbols:
                    try:
                        # Force refresh by invalidating cache
                        await CacheRepository.invalidate_cache(
                            db, f"stock_data_{symbol}"
                        )
                        await StockService.get_stock_data(symbol, db)
                        await asyncio.sleep(0.5)  # Avoid hitting API rate limits
                    except Exception as e:
                        logger.error(f"Error updating popular stock {symbol}: {e}")

                logger.info("Popular stocks update completed")
        except Exception as e:
            logger.error(f"Error in scheduled popular stocks update: {e}")

    async def cleanup_cache(self):
        """Clean up expired cache entries"""
        logger.info("Running scheduled cache cleanup")
        try:
            async with async_session() as db:
                deleted_count = await CacheRepository.clear_expired_cache(db)
                logger.info(f"Cleaned up {deleted_count} expired cache entries")
        except Exception as e:
            logger.error(f"Error in scheduled cache cleanup: {e}")


# Global instance
scheduler_service = SchedulerService()
