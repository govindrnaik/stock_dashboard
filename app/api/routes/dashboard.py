from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

router = APIRouter()

# Set up Jinja2 templates
templates_path = Path(__file__).parent.parent.parent.parent / "app" / "templates"
templates = Jinja2Templates(directory=str(templates_path))


@router.get("/", response_class=HTMLResponse)
async def dashboard_home(request: Request):
    """Render the main dashboard page"""
    return templates.TemplateResponse(
        "dashboard.html", {"request": request, "title": "Stock Dashboard"}
    )


@router.get("/stock/{symbol}", response_class=HTMLResponse)
async def stock_detail(request: Request, symbol: str):
    """Render the detail page for a specific stock"""
    return templates.TemplateResponse(
        "stock_detail.html",
        {"request": request, "title": f"{symbol} Stock Analysis", "symbol": symbol},
    )
