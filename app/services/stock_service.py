import json
import logging
import os
import random
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
import requests
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.stock import StockData, StockOverview, StockPrice
from app.services.db_service import CacheRepository, StockRepository

logger = logging.getLogger(__name__)

# We'll use Alpha Vantage as our free stock API
# You should get your own API key at https://www.alphavantage.co/support/#api-key
ALPHA_VANTAGE_API_KEY = os.getenv("ALPHA_VANTAGE_API_KEY", "demo")
BASE_URL = "https://www.alphavantage.co/query"

# Mock company data for demo mode
MOCK_COMPANIES = {
    "AAPL": {
        "name": "Apple Inc.",
        "sector": "Technology",
        "industry": "Consumer Electronics",
    },
    "MSFT": {
        "name": "Microsoft Corporation",
        "sector": "Technology",
        "industry": "Software",
    },
    "GOOGL": {
        "name": "Alphabet Inc.",
        "sector": "Technology",
        "industry": "Internet Content & Information",
    },
    "AMZN": {
        "name": "Amazon.com Inc.",
        "sector": "Consumer Cyclical",
        "industry": "Internet Retail",
    },
    "TSLA": {
        "name": "Tesla Inc.",
        "sector": "Consumer Cyclical",
        "industry": "Auto Manufacturers",
    },
    "META": {
        "name": "Meta Platforms Inc.",
        "sector": "Technology",
        "industry": "Internet Content & Information",
    },
    "NVDA": {
        "name": "NVIDIA Corporation",
        "sector": "Technology",
        "industry": "Semiconductors",
    },
    "JPM": {
        "name": "JPMorgan Chase & Co.",
        "sector": "Financial Services",
        "industry": "Banks",
    },
    "V": {
        "name": "Visa Inc.",
        "sector": "Financial Services",
        "industry": "Credit Services",
    },
    "WMT": {
        "name": "Walmart Inc.",
        "sector": "Consumer Defensive",
        "industry": "Discount Stores",
    },
}


class StockService:
    """Service for fetching and processing stock data with caching and database persistence"""

    @staticmethod
    def _generate_mock_stock_data(symbol: str) -> StockData:
        """Generate mock stock data for demo purposes"""
        logger.info(f"Generating mock data for {symbol}")

        # Base price and volatility for different stocks
        base_prices = {
            "AAPL": 175.0,
            "MSFT": 390.0,
            "GOOGL": 147.0,
            "AMZN": 182.0,
            "TSLA": 172.0,
            "META": 485.0,
            "NVDA": 880.0,
            "JPM": 196.0,
            "V": 275.0,
            "WMT": 60.0,
        }

        # Default base price for unknown symbols
        base_price = base_prices.get(symbol, 100.0)
        volatility = base_price * 0.02  # 2% volatility

        # Generate 30 days of price data
        end_date = datetime.now()
        start_date = end_date - timedelta(days=30)
        current_date = start_date
        prices = []

        current_price = base_price
        while current_date <= end_date:
            # Skip weekends (simple approach)
            if current_date.weekday() < 5:  # 0-4 is Monday-Friday
                # Random price movement
                daily_volatility = random.uniform(-volatility, volatility)
                open_price = current_price
                close_price = round(open_price + daily_volatility, 2)
                high_price = round(
                    max(open_price, close_price) + random.uniform(0, volatility * 0.5),
                    2,
                )
                low_price = round(
                    min(open_price, close_price) - random.uniform(0, volatility * 0.5),
                    2,
                )
                volume = int(random.uniform(5000000, 50000000))

                prices.append(
                    StockPrice(
                        date=current_date,
                        open=open_price,
                        high=high_price,
                        low=low_price,
                        close=close_price,
                        volume=volume,
                    )
                )

                current_price = close_price

            current_date += timedelta(days=1)

        # Sort prices by date (newest first)
        prices.sort(key=lambda x: x.date, reverse=True)

        # Get company name from mock data or use symbol
        company_info = MOCK_COMPANIES.get(symbol, {"name": f"{symbol} Inc."})

        return StockData(
            symbol=symbol,
            name=company_info["name"],
            prices=prices,
            last_updated=datetime.now(),
        )

    @staticmethod
    async def get_stock_data(
        symbol: str, db: AsyncSession = None
    ) -> Optional[StockData]:
        """Fetch stock data for a given symbol, using cache if available"""
        try:
            # Get database session if not provided
            session_provided = db is not None
            if not session_provided:
                db_gen = get_db()
                db = await anext(db_gen)

            # Try to get data from cache first
            cache_key = f"stock_data_{symbol}"
            cached_data = await CacheRepository.get_cached_data(db, cache_key)

            if cached_data:
                logger.info(f"Using cached data for {symbol}")
                # Parse cached data
                stock_data_dict = json.loads(cached_data)

                # Convert to StockData model
                return StockService._dict_to_stock_data(stock_data_dict)

            # Check if we have this stock in our database
            db_stock = await StockRepository.get_stock_by_symbol(db, symbol)

            if db_stock:
                # We have the stock, check if we have recent prices
                db_prices = await StockRepository.get_stock_prices(
                    db, db_stock.id, days=5
                )

                if db_prices and len(db_prices) > 0:
                    # Convert database models to API models
                    prices = [
                        StockPrice(
                            date=price.date,
                            open=price.open,
                            high=price.high,
                            low=price.low,
                            close=price.close,
                            volume=price.volume,
                        )
                        for price in db_prices
                    ]

                    # Create StockData object
                    stock_data = StockData(
                        symbol=db_stock.symbol,
                        name=db_stock.name,
                        prices=prices,
                        last_updated=db_stock.last_updated,
                    )

                    # Cache this data for future use
                    await CacheRepository.set_cached_data(
                        db,
                        cache_key,
                        StockService._stock_data_to_dict(stock_data),
                        expire_seconds=3600,  # Cache for 1 hour
                    )

                    return stock_data

            # Check if we're using the demo API key
            if ALPHA_VANTAGE_API_KEY == "demo":
                # Generate mock data instead of calling the API
                stock_data = StockService._generate_mock_stock_data(symbol)

                # Save to database
                # Create a basic stock entry with mock data
                mock_company = MOCK_COMPANIES.get(symbol, {})
                overview = StockOverview(
                    symbol=symbol,
                    name=stock_data.name,
                    sector=mock_company.get("sector"),
                    industry=mock_company.get("industry"),
                    market_cap=random.uniform(100000000, 2000000000000),
                    pe_ratio=random.uniform(10, 30),
                    dividend_yield=random.uniform(0, 0.03),
                )

                db_stock = await StockRepository.save_stock(db, overview)

                # Save prices if we have a valid stock ID
                if db_stock and db_stock.id:
                    await StockRepository.save_stock_prices(
                        db, db_stock.id, stock_data.prices
                    )

                # Cache this data
                await CacheRepository.set_cached_data(
                    db,
                    cache_key,
                    StockService._stock_data_to_dict(stock_data),
                    expire_seconds=3600,  # Cache for 1 hour
                )

                # Close session if we opened it
                if not session_provided:
                    await db.close()

                return stock_data

            # If we get here, we need to fetch from the API
            # Fetch daily stock prices
            params = {
                "function": "TIME_SERIES_DAILY",
                "symbol": symbol,
                "outputsize": "compact",
                "apikey": ALPHA_VANTAGE_API_KEY,
            }

            logger.info(f"Fetching stock data for {symbol} from API")
            response = requests.get(BASE_URL, params=params)
            response.raise_for_status()
            data = response.json()

            if "Error Message" in data:
                logger.error(f"Alpha Vantage API error: {data['Error Message']}")
                return None

            if "Information" in data:
                logger.warning(f"Alpha Vantage API info: {data['Information']}")
                # Fall back to mock data if we received information about demo key limitations
                return StockService._generate_mock_stock_data(symbol)

            if "Time Series (Daily)" not in data:
                logger.error(f"Unexpected API response format: {data}")
                return None

            # Get company name from symbol lookup
            company_name = await StockService.get_company_name(symbol, db)

            # Process time series data
            time_series = data["Time Series (Daily)"]
            prices = []

            for date_str, daily_data in time_series.items():
                try:
                    price = StockPrice(
                        date=datetime.strptime(date_str, "%Y-%m-%d"),
                        open=float(daily_data["1. open"]),
                        high=float(daily_data["2. high"]),
                        low=float(daily_data["3. low"]),
                        close=float(daily_data["4. close"]),
                        volume=int(daily_data["5. volume"]),
                    )
                    prices.append(price)
                except (ValueError, KeyError) as e:
                    logger.warning(f"Error processing data point for {date_str}: {e}")

            # Sort prices by date (newest first)
            prices.sort(key=lambda x: x.date, reverse=True)

            stock_data = StockData(
                symbol=symbol,
                name=company_name or symbol,
                prices=prices,
                last_updated=datetime.now(),
            )

            # Save to database
            # First save/update stock info
            overview = await StockService.get_stock_overview(symbol, db)
            if overview:
                db_stock = await StockRepository.save_stock(db, overview)
            else:
                # Create a basic stock entry if we don't have full overview
                dummy_overview = StockOverview(
                    symbol=symbol, name=company_name or symbol
                )
                db_stock = await StockRepository.save_stock(db, dummy_overview)

            # Save prices if we have a valid stock ID
            if db_stock and db_stock.id:
                await StockRepository.save_stock_prices(db, db_stock.id, prices)

            # Cache this data
            await CacheRepository.set_cached_data(
                db,
                cache_key,
                StockService._stock_data_to_dict(stock_data),
                expire_seconds=3600,  # Cache for 1 hour
            )

            # Close session if we opened it
            if not session_provided:
                await db.close()

            return stock_data

        except Exception as e:
            logger.error(f"Error fetching stock data for {symbol}: {e}")
            # Close session if we opened it
            if not session_provided and db:
                await db.close()
            return None

    @staticmethod
    async def get_company_name(symbol: str, db: AsyncSession = None) -> Optional[str]:
        """Get company name from symbol, using cache if available"""
        try:
            # Get database session if not provided
            session_provided = db is not None
            if not session_provided:
                db_gen = get_db()
                db = await anext(db_gen)

            # Try to get from cache
            cache_key = f"company_name_{symbol}"
            cached_data = await CacheRepository.get_cached_data(db, cache_key)

            if cached_data:
                # Return cached name
                return json.loads(cached_data)

            # Check if we have this stock in database
            db_stock = await StockRepository.get_stock_by_symbol(db, symbol)
            if db_stock and db_stock.name:
                # Cache this for future use
                await CacheRepository.set_cached_data(
                    db,
                    cache_key,
                    json.dumps(db_stock.name),
                    expire_seconds=86400,  # Cache for 24 hours
                )
                return db_stock.name

            # Check if we're using the demo API key
            if ALPHA_VANTAGE_API_KEY == "demo":
                # Get mock company name
                company_info = MOCK_COMPANIES.get(symbol, {"name": f"{symbol} Inc."})
                company_name = company_info["name"]

                # Cache the name
                await CacheRepository.set_cached_data(
                    db,
                    cache_key,
                    json.dumps(company_name),
                    expire_seconds=86400,  # Cache for 24 hours
                )

                # Close session if we opened it
                if not session_provided:
                    await db.close()

                return company_name

            # Fetch from API if not in cache or database
            params = {
                "function": "SYMBOL_SEARCH",
                "keywords": symbol,
                "apikey": ALPHA_VANTAGE_API_KEY,
            }

            response = requests.get(BASE_URL, params=params)
            response.raise_for_status()
            data = response.json()

            # Check for API limitations message
            if "Information" in data:
                logger.warning(f"Alpha Vantage API info: {data['Information']}")
                # Fall back to mock data
                company_info = MOCK_COMPANIES.get(symbol, {"name": f"{symbol} Inc."})
                return company_info["name"]

            name = None
            if "bestMatches" in data and data["bestMatches"]:
                for match in data["bestMatches"]:
                    if match["1. symbol"].upper() == symbol.upper():
                        name = match["2. name"]
                        break

            if name:
                # Cache the name
                await CacheRepository.set_cached_data(
                    db,
                    cache_key,
                    json.dumps(name),
                    expire_seconds=86400,  # Cache for 24 hours
                )

            # Close session if we opened it
            if not session_provided:
                await db.close()

            return name

        except Exception as e:
            logger.error(f"Error fetching company name for {symbol}: {e}")
            # Close session if we opened it
            if not session_provided and db:
                await db.close()
            return None

    @staticmethod
    async def get_stock_overview(
        symbol: str, db: AsyncSession = None
    ) -> Optional[StockOverview]:
        """Get company overview information, using cache if available"""
        try:
            # Get database session if not provided
            session_provided = db is not None
            if not session_provided:
                db_gen = get_db()
                db = await anext(db_gen)

            # Try to get from cache
            cache_key = f"stock_overview_{symbol}"
            cached_data = await CacheRepository.get_cached_data(db, cache_key)

            if cached_data:
                # Parse cached data into StockOverview
                overview_dict = json.loads(cached_data)
                return StockOverview(**overview_dict)

            # If not in cache, check if we have in database
            db_stock = await StockRepository.get_stock_by_symbol(db, symbol)
            if db_stock and all(
                [db_stock.sector, db_stock.industry, db_stock.market_cap]
            ):
                # We have complete data in database
                overview = StockOverview(
                    symbol=db_stock.symbol,
                    name=db_stock.name,
                    sector=db_stock.sector,
                    industry=db_stock.industry,
                    market_cap=db_stock.market_cap,
                    pe_ratio=db_stock.pe_ratio,
                    dividend_yield=db_stock.dividend_yield,
                )

                # Cache this data
                await CacheRepository.set_cached_data(
                    db,
                    cache_key,
                    json.dumps(overview.dict()),
                    expire_seconds=86400,  # Cache for 24 hours
                )

                return overview

            # Check if we're using the demo API key
            if ALPHA_VANTAGE_API_KEY == "demo":
                # Generate mock overview data
                mock_company = MOCK_COMPANIES.get(symbol, {})
                company_name = mock_company.get("name", f"{symbol} Inc.")
                overview = StockOverview(
                    symbol=symbol,
                    name=company_name,
                    sector=mock_company.get("sector", "Technology"),
                    industry=mock_company.get("industry", "Software"),
                    market_cap=random.uniform(100000000, 2000000000000),
                    pe_ratio=random.uniform(10, 30),
                    dividend_yield=random.uniform(0, 0.03),
                )

                # Cache the overview
                await CacheRepository.set_cached_data(
                    db,
                    cache_key,
                    json.dumps(overview.dict()),
                    expire_seconds=86400,  # Cache for 24 hours
                )

                # Close session if we opened it
                if not session_provided:
                    await db.close()

                return overview

            # Fetch from API if not in cache or database
            params = {
                "function": "OVERVIEW",
                "symbol": symbol,
                "apikey": ALPHA_VANTAGE_API_KEY,
            }

            response = requests.get(BASE_URL, params=params)
            response.raise_for_status()
            data = response.json()

            # Check for API limitations message
            if "Information" in data:
                logger.warning(f"Alpha Vantage API info: {data['Information']}")
                # Fall back to mock data
                return StockService._get_mock_overview(symbol)

            if not data or "Symbol" not in data:
                logger.error(f"Failed to get overview for {symbol}")
                return None

            overview = StockOverview(
                symbol=data["Symbol"],
                name=data["Name"],
                sector=data.get("Sector"),
                industry=data.get("Industry"),
                market_cap=float(data.get("MarketCapitalization", 0))
                if data.get("MarketCapitalization")
                else None,
                pe_ratio=float(data.get("PERatio")) if data.get("PERatio") else None,
                dividend_yield=float(data.get("DividendYield", 0))
                if data.get("DividendYield")
                else None,
            )

            # Cache the overview
            await CacheRepository.set_cached_data(
                db,
                cache_key,
                json.dumps(overview.dict()),
                expire_seconds=86400,  # Cache for 24 hours
            )

            # Close session if we opened it
            if not session_provided:
                await db.close()

            return overview

        except Exception as e:
            logger.error(f"Error fetching stock overview for {symbol}: {e}")
            # Close session if we opened it
            if not session_provided and db:
                await db.close()
            return None

    @staticmethod
    def _get_mock_overview(symbol: str) -> StockOverview:
        """Generate mock overview data for a symbol"""
        mock_company = MOCK_COMPANIES.get(symbol, {})
        company_name = mock_company.get("name", f"{symbol} Inc.")
        return StockOverview(
            symbol=symbol,
            name=company_name,
            sector=mock_company.get("sector", "Technology"),
            industry=mock_company.get("industry", "Software"),
            market_cap=random.uniform(100000000, 2000000000000),
            pe_ratio=random.uniform(10, 30),
            dividend_yield=random.uniform(0, 0.03),
        )

    @staticmethod
    async def get_popular_stocks(
        symbols: List[str], db: AsyncSession = None
    ) -> List[Dict[str, Any]]:
        """Get data for popular stocks, preferably from database"""
        try:
            # Get database session if not provided
            session_provided = db is not None
            if not session_provided:
                db_gen = get_db()
                db = await anext(db_gen)

            # Try to get from database first
            popular_stocks = await StockRepository.get_popular_stocks(db, symbols)

            # Format results
            formatted_results = []

            if popular_stocks:
                # We have some stocks in database
                for stock, price in popular_stocks:
                    formatted_results.append(
                        {
                            "symbol": stock.symbol,
                            "name": stock.name,
                            "latest_price": price.close,
                            "last_updated": price.date,
                        }
                    )

            # For symbols we didn't find in database, fetch from API
            db_symbols = [stock.symbol for stock, _ in popular_stocks]
            missing_symbols = [symbol for symbol in symbols if symbol not in db_symbols]

            if missing_symbols:
                # Fetch missing stocks from API
                for symbol in missing_symbols:
                    stock_data = await StockService.get_stock_data(symbol, db)
                    if stock_data and stock_data.prices:
                        latest_price = stock_data.prices[0]
                        formatted_results.append(
                            {
                                "symbol": stock_data.symbol,
                                "name": stock_data.name,
                                "latest_price": latest_price.close,
                                "last_updated": latest_price.date,
                            }
                        )

            # If we still have no results, generate mock data for all symbols
            # This ensures we always return something useful, especially with demo API key
            if not formatted_results:
                logger.warning(
                    "No stocks found in database or API, generating mock data"
                )
                for symbol in symbols:
                    mock_stock = StockService._generate_mock_stock_data(symbol)
                    if mock_stock and mock_stock.prices:
                        latest_price = mock_stock.prices[0]
                        formatted_results.append(
                            {
                                "symbol": mock_stock.symbol,
                                "name": mock_stock.name,
                                "latest_price": latest_price.close,
                                "last_updated": latest_price.date,
                            }
                        )

            # Close session if we opened it
            if not session_provided:
                await db.close()

            return formatted_results

        except Exception as e:
            logger.error(f"Error fetching popular stocks: {e}")
            # Close session if we opened it
            if not session_provided and db:
                await db.close()

            # Generate mock data as fallback when an exception occurs
            logger.warning("Generating mock data due to exception")
            formatted_results = []
            for symbol in symbols:
                mock_stock = StockService._generate_mock_stock_data(symbol)
                if mock_stock and mock_stock.prices:
                    latest_price = mock_stock.prices[0]
                    formatted_results.append(
                        {
                            "symbol": mock_stock.symbol,
                            "name": mock_stock.name,
                            "latest_price": latest_price.close,
                            "last_updated": latest_price.date,
                        }
                    )

            return formatted_results

    @staticmethod
    async def search_stocks(
        query: str, db: AsyncSession = None
    ) -> List[Dict[str, Any]]:
        """Search for stocks by symbol or name, using database first"""
        try:
            # Get database session if not provided
            session_provided = db is not None
            if not session_provided:
                db_gen = get_db()
                db = await anext(db_gen)

            # Try to search in database first
            db_stocks = await StockRepository.search_stocks(db, query)

            results = []

            if db_stocks:
                # Format database results
                for stock in db_stocks:
                    results.append(
                        {
                            "symbol": stock.symbol,
                            "name": stock.name,
                            "type": "Common Stock",  # Default type
                            "region": "United States",  # Default region
                        }
                    )

            # If we don't have enough results, search in API
            if len(results) < 5:
                # Cache key for this search
                cache_key = f"stock_search_{query}"
                cached_data = await CacheRepository.get_cached_data(db, cache_key)

                if cached_data:
                    # Use cached search results
                    api_results = json.loads(cached_data)
                else:
                    # Check if we're using the demo API key
                    if ALPHA_VANTAGE_API_KEY == "demo":
                        # Generate mock search results
                        api_results = []
                        query_upper = query.upper()
                        for symbol, company in MOCK_COMPANIES.items():
                            if (
                                query_upper in symbol
                                or query.lower() in company["name"].lower()
                            ):
                                api_results.append(
                                    {
                                        "symbol": symbol,
                                        "name": company["name"],
                                        "type": "Common Stock",
                                        "region": "United States",
                                    }
                                )

                        # Cache these results
                        await CacheRepository.set_cached_data(
                            db,
                            cache_key,
                            json.dumps(api_results),
                            expire_seconds=3600,  # Cache for 1 hour
                        )
                    else:
                        # Search using API
                        params = {
                            "function": "SYMBOL_SEARCH",
                            "keywords": query,
                            "apikey": ALPHA_VANTAGE_API_KEY,
                        }

                        response = requests.get(BASE_URL, params=params)
                        response.raise_for_status()
                        data = response.json()

                        # Check for API limitations message
                        if "Information" in data:
                            logger.warning(
                                f"Alpha Vantage API info: {data['Information']}"
                            )
                            # Generate mock search results instead
                            api_results = []
                            query_upper = query.upper()
                            for symbol, company in MOCK_COMPANIES.items():
                                if (
                                    query_upper in symbol
                                    or query.lower() in company["name"].lower()
                                ):
                                    api_results.append(
                                        {
                                            "symbol": symbol,
                                            "name": company["name"],
                                            "type": "Common Stock",
                                            "region": "United States",
                                        }
                                    )
                        else:
                            api_results = []
                            if "bestMatches" in data:
                                for match in data["bestMatches"]:
                                    api_results.append(
                                        {
                                            "symbol": match["1. symbol"],
                                            "name": match["2. name"],
                                            "type": match["3. type"],
                                            "region": match["4. region"],
                                        }
                                    )

                        # Cache these results
                        await CacheRepository.set_cached_data(
                            db,
                            cache_key,
                            json.dumps(api_results),
                            expire_seconds=3600,  # Cache for 1 hour
                        )

                # Merge API results with database results
                # Avoid duplicates by symbol
                db_symbols = {stock.symbol for stock in db_stocks}
                for api_result in api_results:
                    if api_result["symbol"] not in db_symbols:
                        results.append(api_result)

            # Close session if we opened it
            if not session_provided:
                await db.close()

            return results

        except Exception as e:
            logger.error(f"Error searching stocks: {e}")
            # Close session if we opened it
            if not session_provided and db:
                await db.close()
            return []

    @staticmethod
    def process_to_dataframe(stock_data: StockData) -> pd.DataFrame:
        """Convert stock data to pandas DataFrame for easier processing"""
        if not stock_data or not stock_data.prices:
            return pd.DataFrame()

        data = [
            {
                "date": price.date,
                "open": price.open,
                "high": price.high,
                "low": price.low,
                "close": price.close,
                "volume": price.volume,
            }
            for price in stock_data.prices
        ]

        df = pd.DataFrame(data)
        df.set_index("date", inplace=True)
        df.sort_index(inplace=True)  # Sort by date in ascending order

        return df

    @staticmethod
    def _stock_data_to_dict(stock_data: StockData) -> Dict[str, Any]:
        """Convert StockData model to dictionary for caching"""
        return {
            "symbol": stock_data.symbol,
            "name": stock_data.name,
            "prices": [
                {
                    "date": price.date.isoformat(),
                    "open": price.open,
                    "high": price.high,
                    "low": price.low,
                    "close": price.close,
                    "volume": price.volume,
                }
                for price in stock_data.prices
            ],
            "last_updated": stock_data.last_updated.isoformat(),
        }

    @staticmethod
    def _dict_to_stock_data(data: Dict[str, Any]) -> StockData:
        """Convert dictionary to StockData model"""
        return StockData(
            symbol=data["symbol"],
            name=data["name"],
            prices=[
                StockPrice(
                    date=datetime.fromisoformat(price["date"]),
                    open=price["open"],
                    high=price["high"],
                    low=price["low"],
                    close=price["close"],
                    volume=price["volume"],
                )
                for price in data["prices"]
            ],
            last_updated=datetime.fromisoformat(data["last_updated"]),
        )
