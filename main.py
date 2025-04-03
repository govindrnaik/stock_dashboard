import uvicorn

from app.app import app

if __name__ == "__main__":
    # Run the FastAPI application using Uvicorn on 0.0.0.0
    uvicorn.run("app.app:app", host="0.0.0.0", port=8080, reload=True)
