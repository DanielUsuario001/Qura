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
    lambda1: float = Field(
        default=50.0,
        description="Penalty: doctor sees at most 1 patient per slot",
    )
    lambda2: float = Field(
        default=50.0,
        description="Penalty: patient scheduled exactly once",
    )
    lambda4: float = Field(
        default=20.0,
        description="Reward multiplier for referred appointments (R_i)",
    )
    num_reads: int   = Field(default=1000, description="Number of SA reads")
    num_sweeps: int  = Field(default=500,  description="Number of sweeps per read")
    beta_range: Optional[tuple[float, float]] = Field(
        default=None,
        description="SA inverse temperature range [beta_min, beta_max]",
    )


class PatientInput(BaseModel):
    id: str = Field(description="appointment_pool.id — the appointment UUID, not user UUID")
    urgency: int = Field(ge=1, le=10, description="Urgency level 1-10")
    specialty: str
    referral_multiplier: float = Field(
        default=1.0,
        description=(
            "R_i: 1.0 = direct web request, 10.0 = officially referred by a General Practitioner. "
            "Maps from appointments_pool.referral_source: 'direct'→1.0, 'doctor_referred'→10.0"
        ),
    )


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
