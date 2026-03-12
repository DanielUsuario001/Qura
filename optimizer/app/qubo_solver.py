"""
QUBO formulation and Simulated Quantum Annealing solver for clinical scheduling.

Hamiltonian:
  H = - Σ_{i,j,t}  U_i · x_{i,j,t}                         (maximize urgency scheduling)
      + λ₁ · Σ_{j,t} (Σ_i x_{i,j,t} - 1)²                 (doctor sees ≤1 patient per slot)
      + λ₂ · Σ_i    (Σ_{j,t} x_{i,j,t} - 1)²               (patient scheduled exactly once)

Variables:
  x_{i,j,t} ∈ {0,1}  →  appointment i assigned to doctor j at time t
"""
from __future__ import annotations

import logging
import math
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

from pyqubo import Array, Constraint, Placeholder
import openjij as oj

from .models import (
    PatientInput,
    DoctorInput,
    OptimizerParameters,
    Assignment,
    ResultSummary,
)

logger = logging.getLogger(__name__)


# ── Time slot generation ─────────────────────────────────────────────────────

DAY_MAP = {
    "monday": 0, "tuesday": 1, "wednesday": 2,
    "thursday": 3, "friday": 4, "saturday": 5
}

def generate_time_slots(
    doctors: list[DoctorInput],
    slot_duration_minutes: int = 30,
    horizon_days: int = 5,
) -> list[str]:
    """
    Build a deduplicated list of ISO datetime strings for all possible
    time slots across the scheduling horizon, respecting doctor availability.
    """
    slots: set[str] = set()
    base_date = datetime.now(tz=timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )

    for day_offset in range(horizon_days):
        current_date = base_date + timedelta(days=day_offset)
        weekday = current_date.weekday()  # 0=Monday

        for doctor in doctors:
            for slot in doctor.available_slots:
                if DAY_MAP.get(slot.day, -1) != weekday:
                    continue

                start_h, start_m = map(int, slot.start_time.split(":"))
                end_h, end_m = map(int, slot.end_time.split(":"))

                current = current_date.replace(hour=start_h, minute=start_m)
                end_dt = current_date.replace(hour=end_h, minute=end_m)

                while current < end_dt:
                    slots.add(current.isoformat())
                    current += timedelta(minutes=slot_duration_minutes)

    sorted_slots = sorted(slots)
    logger.info("Generated %d time slots over %d days", len(sorted_slots), horizon_days)
    return sorted_slots


def doctor_available_at(doctor: DoctorInput, slot_iso: str) -> bool:
    """Check if a doctor has availability covering the given time slot."""
    dt = datetime.fromisoformat(slot_iso)
    weekday_name = list(DAY_MAP.keys())[dt.weekday()] if dt.weekday() < 6 else None
    if weekday_name is None:
        return False

    slot_time = dt.hour * 60 + dt.minute
    for avail in doctor.available_slots:
        if avail.day != weekday_name:
            continue
        start_h, start_m = map(int, avail.start_time.split(":"))
        end_h, end_m = map(int, avail.end_time.split(":"))
        if start_h * 60 + start_m <= slot_time < end_h * 60 + end_m:
            return True
    return False


def specialties_match(patient_specialty: str, doctor_specialty: str) -> bool:
    """Case-insensitive specialty matching with 'General' as fallback."""
    if doctor_specialty.lower() == "general":
        return True
    return patient_specialty.lower() == doctor_specialty.lower()


# ── QUBO Formulation ─────────────────────────────────────────────────────────

def build_and_solve(
    patients: list[PatientInput],
    doctors: list[DoctorInput],
    params: OptimizerParameters,
) -> tuple[list[Assignment], float]:
    """
    Build the QUBO model and solve with OpenJij's Simulated Quantum Annealing.

    Returns (assignments, best_energy).
    """
    start_ms = int(time.time() * 1000)

    if not patients:
        return [], 0.0

    # Generate feasible time slots
    time_slots = generate_time_slots(doctors)
    if not time_slots:
        logger.warning("No time slots generated — check doctor availability config")
        return [], 0.0

    # Limit problem size to avoid memory explosion
    # For large instances, consider decomposing by specialty
    MAX_PATIENTS = 50
    MAX_SLOTS = 40
    MAX_DOCTORS = 20

    patients = patients[:MAX_PATIENTS]
    time_slots = time_slots[:MAX_SLOTS]
    doctors = doctors[:MAX_DOCTORS]

    I = len(patients)  # number of appointments
    J = len(doctors)   # number of doctors
    T = len(time_slots)  # number of time slots

    logger.info("QUBO problem size: %d patients × %d doctors × %d slots = %d vars",
                I, J, T, I * J * T)

    # ── Binary variables x[i][j][t] ──────────────────────────────────────────
    x = Array.create("x", shape=(I, J, T), vartype="BINARY")

    # ── Urgency weights (normalized to [0,1]) ─────────────────────────────────
    max_urgency = max(p.urgency for p in patients) or 1

    # ── Objective: maximize scheduling of high-urgency patients ──────────────
    # Negate because we minimize H
    objective = 0.0
    for i, patient in enumerate(patients):
        u_i = patient.urgency / max_urgency
        for j, doctor in enumerate(doctors):
            if not specialties_match(patient.specialty, doctor.specialty):
                continue  # hard constraint: don't penalize, just skip
            for t, slot in enumerate(time_slots):
                if not doctor_available_at(doctor, slot):
                    continue
                objective -= u_i * x[i][j][t]

    # ── Constraint 1: doctor j sees at most 1 patient at time t ──────────────
    lambda1 = Placeholder("lambda1")
    doctor_conflict = 0.0
    for j in range(J):
        for t in range(T):
            occupancy = sum(x[i][j][t] for i in range(I))
            # Penalize (occupancy - 1)^2 when occupancy > 1, else 0
            # Using the constraint form: penalize occupancy*(occupancy-1) for ≤1
            doctor_conflict += (occupancy * (occupancy - 1))

    # ── Constraint 2: patient i scheduled at most once ────────────────────────
    lambda2 = Placeholder("lambda2")
    patient_uniqueness = 0.0
    for i in range(I):
        total_assigned = sum(
            x[i][j][t]
            for j in range(J)
            for t in range(T)
        )
        # Penalize (total - 1)^2: patient must be scheduled exactly once
        # We use (total*(total-1)) to penalize >1, then separately reward =1
        patient_uniqueness += (total_assigned - 1) ** 2

    # ── Full Hamiltonian ──────────────────────────────────────────────────────
    H = (
        objective
        + lambda1 * doctor_conflict
        + lambda2 * patient_uniqueness
    )

    # Compile to QUBO
    model = H.compile()
    feed_dict = {
        "lambda1": params.lambda1,
        "lambda2": params.lambda2,
    }
    qubo_matrix, qubo_offset = model.to_qubo(feed_dict=feed_dict)

    logger.info("QUBO matrix compiled: %d variables", len(qubo_matrix))

    # ── Solve with OpenJij SQA Sampler ────────────────────────────────────────
    sampler = oj.SQASampler()

    # Build beta_range (inverse temperature schedule)
    beta_min, beta_max = params.beta_range if params.beta_range else (0.1, 5.0)

    response = sampler.sample_qubo(
        Q=qubo_matrix,
        num_reads=params.num_reads,
        num_sweeps=params.num_sweeps,
        beta_min=beta_min,
        beta_max=beta_max,
    )

    best_sample = response.first.sample
    best_energy = response.first.energy + qubo_offset

    logger.info("Best energy: %.4f (offset: %.4f)", best_energy, qubo_offset)

    # ── Decode solution ────────────────────────────────────────────────────────
    decoded, broken, energy = model.decode_sample(
        best_sample, vartype="BINARY", feed_dict=feed_dict
    )

    assignments: list[Assignment] = []
    assigned_patients: set[int] = set()
    doctor_slot_occupancy: dict[tuple[int, int], int] = {}

    for i, patient in enumerate(patients):
        for j, doctor in enumerate(doctors):
            for t, slot in enumerate(time_slots):
                var_name = f"x[{i}][{j}][{t}]"
                val = decoded.get("x", {}).get(f"[{i}][{j}][{t}]", 0)

                if val == 1 and i not in assigned_patients:
                    # Validate constraints before accepting
                    key = (j, t)
                    if doctor_slot_occupancy.get(key, 0) >= 1:
                        continue  # reject: slot already taken
                    if not specialties_match(patient.specialty, doctor.specialty):
                        continue
                    if not doctor_available_at(doctor, slot):
                        continue

                    doctor_slot_occupancy[key] = doctor_slot_occupancy.get(key, 0) + 1
                    assigned_patients.add(i)

                    assignments.append(Assignment(
                        patient_id=patient.id,
                        doctor_id=doctor.id,
                        time_slot=slot,
                        room=doctor.room_number,
                    ))

    logger.info(
        "Decoded %d assignments / %d patients (energy=%.4f, broken=%d constraints)",
        len(assignments), I, best_energy, len(broken)
    )

    return assignments, best_energy


# ── Public entry point ────────────────────────────────────────────────────────

def run_optimizer(
    patients: list[PatientInput],
    doctors: list[DoctorInput],
    params: OptimizerParameters,
) -> tuple[list[Assignment], ResultSummary]:
    start_ms = int(time.time() * 1000)

    try:
        assignments, energy = build_and_solve(patients, doctors, params)
    except Exception as exc:
        logger.exception("QUBO solver failed: %s", exc)
        raise

    duration = int(time.time() * 1000) - start_ms

    summary = ResultSummary(
        assigned=len(assignments),
        unassigned=len(patients) - len(assignments),
        energy=energy,
        duration_ms=duration,
    )

    return assignments, summary
