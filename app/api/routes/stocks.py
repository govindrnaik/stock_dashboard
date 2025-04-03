import asyncio
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.stock import StockData, StockOverview
from app.services.stock_service import StockService

router = APIRouter(prefix="/stocks")
logger = logging.getLogger(__name__)


@router.get("/{symbol}", response_model=StockData)
async def get_stock(symbol: str, db: AsyncSession = Depends(get_db)):
    """Get stock data by symbol"""
    stock_data = await StockService.get_stock_data(symbol, db)

    if not stock_data:
        raise HTTPException(status_code=404, detail=f"Stock {symbol} not found")

    return stock_data


@router.get("/{symbol}/overview", response_model=StockOverview)
async def get_stock_overview(symbol: str, db: AsyncSession = Depends(get_db)):
    """Get company overview for a stock"""
    overview = await StockService.get_stock_overview(symbol, db)

    if not overview:
        raise HTTPException(status_code=404, detail=f"Overview for {symbol} not found")

    return overview


@router.get("/popular", response_model=List[dict])
async def get_popular_stocks(db: AsyncSession = Depends(get_db)):
    """Get a list of popular stocks"""
    popular_symbols = [
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

    stocks = await StockService.get_popular_stocks(popular_symbols, db)

    if not stocks:
        raise HTTPException(status_code=404, detail="Failed to fetch popular stocks")

    return stocks


@router.get("/search", response_model=List[dict])
async def search_stocks(
    query: str = Query(..., min_length=1), db: AsyncSession = Depends(get_db)
):
    """Search for stocks by symbol or name"""
    results = await StockService.search_stocks(query, db)
    return results
