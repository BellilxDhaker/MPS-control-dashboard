"""Main entry point for the Inventory Health API."""

from contextlib import asynccontextmanager

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
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. GZIP compression - reduce payload size
app.add_middleware(GZipMiddleware, minimum_size=1000)


app.include_router(router)


@app.get("/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "healthy"}
