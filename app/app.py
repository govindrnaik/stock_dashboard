import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.api.routes.api import router as api_router
from app.api.routes.dashboard import router as dashboard_router
from app.api.routes.websockets import router as websocket_router
from app.core.config import settings
from app.core.database import init_db
from app.services.scheduler_service import scheduler_service
from app.services.websocket_service import start_stock_update_task

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)


def create_application() -> FastAPI:
    application = FastAPI(title=settings.PROJECT_NAME, debug=settings.DEBUG)

    # Mount static files directory
    application.mount(
        "/static",
        StaticFiles(directory=Path(__file__).parent.parent / "app" / "static"),
        name="static",
    )

    # Include API router
    application.include_router(api_router)

    # Include Dashboard routes at root level
    application.include_router(dashboard_router)

    # Include WebSocket routes
    application.include_router(websocket_router)

    # Add event handlers for startup and shutdown
    @application.on_event("startup")
    async def startup_event():
        # Initialize the database
        await init_db()
        logging.info("Database initialized")

        # Start the stock update background task
        import asyncio

        application.state.stock_update_task = asyncio.create_task(
            start_stock_update_task()
        )
        logging.info("Started stock update background task")

        # Start the scheduler service
        scheduler_service.start()
        logging.info("Started scheduler service")

    @application.on_event("shutdown")
    async def shutdown_event():
        # Cancel the background task on shutdown
        if hasattr(application.state, "stock_update_task"):
            application.state.stock_update_task.cancel()
            logging.info("Stopped stock update background task")

        # Shutdown the scheduler service
        scheduler_service.shutdown()
        logging.info("Stopped scheduler service")

    return application


app = create_application()
