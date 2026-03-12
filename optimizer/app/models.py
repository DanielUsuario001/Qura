"""
Pydantic models for the Quantum Health Scheduler optimizer service.
These mirror the TypeScript types in src/lib/types.ts.
"""
from __future__ import annotations
from typing import Literal, Optional
from pydantic import BaseModel, Field


class AvailableSlot(BaseModel):
    day: Literal["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
    start_time: str  # "HH:MM"
    end_time: str    # "HH:MM"


class OptimizerParameters(BaseModel):
    lambda1: float = Field(default=10.0, description="Penalty weight for doctor conflict constraint")
    lambda2: float = Field(default=10.0, description="Penalty weight for patient uniqueness constraint")
    num_reads: int = Field(default=1000, description="Number of SA reads")
    num_sweeps: int = Field(default=500, description="Number of sweeps per read")
    beta_range: Optional[tuple[float, float]] = Field(
        default=None,
        description="SQA inverse temperature range [beta_min, beta_max]"
    )


class PatientInput(BaseModel):
    id: str = Field(description="appointment_pool.id — the appointment UUID, not user UUID")
    urgency: int = Field(ge=1, le=10, description="Urgency level 1-10")
    specialty: str


class DoctorInput(BaseModel):
    id: str = Field(description="users.id of the doctor")
    specialty: str
    available_slots: list[AvailableSlot]
    max_daily_patients: int = 12
    room_number: Optional[str] = None


class OptimizerRequest(BaseModel):
    patients: list[PatientInput]
    doctors: list[DoctorInput]
    parameters: OptimizerParameters = Field(default_factory=OptimizerParameters)
    optimizer_run_id: str


class Assignment(BaseModel):
    patient_id: str = Field(description="appointment_pool.id being assigned")
    doctor_id: str  = Field(description="users.id of the assigned doctor")
    time_slot: str  = Field(description="ISO 8601 datetime string")
    room: Optional[str] = None


class ResultSummary(BaseModel):
    assigned: int
    unassigned: int
    energy: float
    duration_ms: int


class OptimizerResponse(BaseModel):
    assignments: list[Assignment]
    summary: ResultSummary
