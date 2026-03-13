"""
Qura Optimizer — Microservicio de optimización QUBO para citas clínicas.

Este paquete expone el solver (Simulated Annealing) y los modelos Pydantic.
El punto de entrada HTTP es app.main:app (FastAPI).
"""
from .qubo_solver import run_optimizer
from .models import (
    OptimizerRequest,
    OptimizerResponse,
    OptimizerParameters,
    PatientInput,
    DoctorInput,
)

__all__ = [
    "run_optimizer",
    "OptimizerRequest",
    "OptimizerResponse",
    "OptimizerParameters",
    "PatientInput",
    "DoctorInput",
]
