"""
Quantum Health Scheduler — Optimization Microservice
FastAPI service exposing the QUBO-based clinical scheduling solver.

Endpoints:
  GET  /health       → liveness check
  POST /solve        → run QUBO optimization and return assignments
"""
import logging
import os
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .models import OptimizerRequest, OptimizerResponse
from .qubo_solver import run_optimizer

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("qura.optimizer")


# ── App setup ─────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Qura Optimizer Service starting up...")
    yield
    logger.info("Qura Optimizer Service shutting down.")


app = FastAPI(
    title="Qura Optimizer Service",
    description="QUBO-based clinical appointment scheduling via Simulated Quantum Annealing",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS — restrict to Next.js origin in production ──────────────────────────
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# ── Request timing middleware ─────────────────────────────────────────────────
@app.middleware("http")
async def add_timing_header(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration_ms = int((time.time() - start) * 1000)
    response.headers["X-Processing-Time-Ms"] = str(duration_ms)
    return response


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health", tags=["monitoring"])
async def health_check():
    """Liveness probe for orchestrators (Railway, Render, k8s)."""
    return {"status": "ok", "service": "qura-optimizer"}


@app.post(
    "/solve",
    response_model=OptimizerResponse,
    tags=["optimization"],
    summary="Run QUBO-based schedule optimization",
    description="""
Receives a list of pending appointments (patients) and available doctors,
formulates the Quantum Unconstrained Binary Optimization (QUBO) problem,
and solves it using OpenJij's Simulated Quantum Annealing.

Returns a list of (appointment → doctor, time_slot) assignments.
    """,
)
async def solve(payload: OptimizerRequest) -> OptimizerResponse:
    logger.info(
        "Solve request received: run_id=%s, patients=%d, doctors=%d",
        payload.optimizer_run_id,
        len(payload.patients),
        len(payload.doctors),
    )

    if not payload.patients:
        return OptimizerResponse(
            assignments=[],
            summary={"assigned": 0, "unassigned": 0, "energy": 0.0, "duration_ms": 0},
        )

    if not payload.doctors:
        raise HTTPException(
            status_code=422,
            detail="No doctors provided — cannot generate schedule."
        )

    try:
        assignments, summary = run_optimizer(
            patients=payload.patients,
            doctors=payload.doctors,
            params=payload.parameters,
        )
    except Exception as exc:
        logger.exception("Optimization failed for run_id=%s", payload.optimizer_run_id)
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    logger.info(
        "Solve complete: run_id=%s, assigned=%d/%d, energy=%.4f, duration=%dms",
        payload.optimizer_run_id,
        summary.assigned,
        len(payload.patients),
        summary.energy,
        summary.duration_ms,
    )

    return OptimizerResponse(assignments=assignments, summary=summary)


# ── Global error handler ──────────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception: %s", exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "type": type(exc).__name__},
    )
