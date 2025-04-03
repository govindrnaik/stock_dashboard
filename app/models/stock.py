from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class StockPrice(BaseModel):
    """Model for stock price data"""

    date: datetime
    open: float
    high: float
    low: float
    close: float
    volume: int


class StockData(BaseModel):
    """Model for stock data including price history"""

    symbol: str
    name: str
    prices: List[StockPrice] = []
    last_updated: Optional[datetime] = None


class StockOverview(BaseModel):
    """Model for company overview information"""

    symbol: str
    name: str
    sector: Optional[str] = None
    industry: Optional[str] = None
    market_cap: Optional[float] = None
    pe_ratio: Optional[float] = None
    dividend_yield: Optional[float] = None

    class Config:
        """Pydantic config"""

        # This allows the model to be exported to a dictionary
        def dict(self, **kwargs):
            return super().dict(**kwargs)
