"""Main entry point for the Inventory Health API."""

from contextlib import asynccontextmanager
import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from api.routes import router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Set uvicorn logging to also show INFO
logging.getLogger("uvicorn").setLevel(logging.INFO)
logging.getLogger("uvicorn.access").setLevel(logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    logger.info("🚀 API starting up...")
    yield
    logger.info("🛑 API shutting down...")


# Create FastAPI app
app = FastAPI(
    title="Inventory Health API",
    description="MPS Control Dashboard backend",
    version="1.0.0",
    lifespan=lifespan,
)

# ---------------------------
# CORS CONFIGURATION
# ---------------------------

# Get allowed origins from environment variable
raw_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000"
)

ALLOWED_ORIGINS = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]

# Debug: Log the allowed origins
logger.info(f"✅ CORS Allowed Origins: {ALLOWED_ORIGINS}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,  # must match frontend domain exactly
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],  # explicit methods
    allow_headers=["*"],  # allow all headers
    expose_headers=["Content-Length", "Content-Range"],
    max_age=3600,
)

# ---------------------------
# OTHER MIDDLEWARE
# ---------------------------

# GZIP compression
app.add_middleware(GZipMiddleware, minimum_size=1000)

# ---------------------------
# ROUTES
# ---------------------------

app.include_router(router)


@app.get("/")
async def root():
    """Optional root endpoint."""
    return {"message": "Inventory Health API is running"}


@app.get("/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "healthy"}