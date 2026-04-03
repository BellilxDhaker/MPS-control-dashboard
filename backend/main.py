"""Main entry point for the Inventory Health API."""

from contextlib import asynccontextmanager
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from api.routes import router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup
    print("🚀 API starting up...")
    yield
    # Shutdown
    print("🛑 API shutting down...")


app = FastAPI(
    title="Inventory Health API",
    description="MPS Control Dashboard backend",
    version="1.0.0",
    lifespan=lifespan,
)

# Middleware stack (order matters)

# 1. CORS - Allow frontend requests
# Define allowed origins from environment variable, with fallback for local development
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000"  # Local development
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["Content-Length", "Content-Range"],
    max_age=3600,  # Cache preflight requests for 1 hour
)

# 2. GZIP compression - reduce payload size
app.add_middleware(GZipMiddleware, minimum_size=1000)


app.include_router(router)


@app.get("/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "healthy"}
