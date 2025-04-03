from fastapi import APIRouter

from app.api.routes import stocks
from app.core.config import settings

router = APIRouter(prefix=settings.API_V1_STR)

# Include stock data API endpoints
router.include_router(stocks.router, tags=["Stocks"])


@router.get("/")
async def health_check():
    return {"status": "healthy", "message": "API is working correctly"}
