"""
QUBO formulation for clinical scheduling — Peru MINSA/EsSalud referral model.

Hamiltonian H(x) (minimized):

  H(x) = - Σ_{i,j,t} (U_i · C_{i,j}) · x_{i,j,t}               [Término 1: urgencia clínica]
          + λ₁ · Σ_{j,t} Σ_{i≠i'} x_{i,j,t} · x_{i',j,t}       [Término 2: ≤1 paciente/slot/doctor]
          + λ₂ · Σ_i (Σ_{j,t} x_{i,j,t} - 1)²                   [Término 3: paciente asignado exactamente 1 vez]
          - λ₄ · Σ_{i,j,t} R_i · x_{i,j,t}                      [Término 4: recompensa interconsulta]

Variables:
  x_{i,j,t} ∈ {0,1}  — 1 si al paciente i se le asigna el doctor j en el tiempo t
  U_i (1–10)          — urgencia clínica del paciente
  C_{i,j} ∈ {0,1}    — compatibilidad de especialidad (filtro estricto)
  R_i                 — multiplicador de referencia: 1.0 (directo web) | 10.0 (interconsulta MG)

Key design decisions:
  - Solo se crean variables Binary para triplets (i,j,t) donde C_{i,j}=1 Y el doctor
    tiene disponibilidad en el slot t, reduciendo drásticamente el tamaño de la matriz QUBO.
  - Términos 1 y 4 son ambos lineales → se combinan en un solo bucle:
      peso = (U_i · C_{i,j}) + (λ₄ · R_i)
    Como C_{i,j}=1 para todas las variables creadas: peso = U_i + λ₄ · R_i
  - R_i=10 con λ₄=20 → recompensa de 200 para interconsultas vs máx 10 de urgencia
    → prioridad matemática absoluta para pacientes derivados por médico general.
  - Solved with openjij.SASampler (Simulated Annealing).
"""
from __future__ import annotations

import logging
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from pyqubo import Binary, Placeholder
import openjij as oj

from .models import (
    PatientInput,
    DoctorInput,
    OptimizerParameters,
    Assignment,
    ResultSummary,
)

logger = logging.getLogger(__name__)


# ── Time slot generation ──────────────────────────────────────────────────────

DAY_MAP = {
    "monday": 0, "tuesday": 1, "wednesday": 2,
    "thursday": 3, "friday": 4, "saturday": 5,
}


def generate_time_slots(
    doctors: list[DoctorInput],
    slot_duration_minutes: int = 30,
    horizon_days: int = 5,
) -> list[str]:
    """Return a sorted, deduplicated list of ISO datetime slots across the horizon."""
    slots: set[str] = set()
    base_date = datetime.now(tz=timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    for day_offset in range(horizon_days):
        current_date = base_date + timedelta(days=day_offset)
        weekday = current_date.weekday()
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
    """True if doctor has an availability window that covers the given slot."""
    dt = datetime.fromisoformat(slot_iso)
    weekday_name = list(DAY_MAP.keys())[dt.weekday()] if dt.weekday() < 6 else None
    if weekday_name is None:
        return False
    slot_min = dt.hour * 60 + dt.minute
    for avail in doctor.available_slots:
        if avail.day != weekday_name:
            continue
        sh, sm = map(int, avail.start_time.split(":"))
        eh, em = map(int, avail.end_time.split(":"))
        if sh * 60 + sm <= slot_min < eh * 60 + em:
            return True
    return False


def specialties_match(patient_specialty: str, doctor_specialty: str) -> bool:
    """Case-insensitive specialty match; 'General' doctors accept any specialty."""
    if doctor_specialty.lower() == "general":
        return True
    return patient_specialty.lower() == doctor_specialty.lower()


# ── QUBO formulation ──────────────────────────────────────────────────────────

def build_and_solve(
    patients: list[PatientInput],
    doctors: list[DoctorInput],
    params: OptimizerParameters,
) -> tuple[list[Assignment], float]:
    """
    Build a sparse QUBO model using C_{i,j} pre-filtering and solve with SASampler.
    Only Binary variables for valid (i,j,t) triplets are created.
    Returns (assignments, best_energy).
    """
    if not patients:
        return [], 0.0

    # =========================================================================
    # PASO 1: DEFINICIÓN DE PARÁMETROS DEL MUNDO REAL
    # =========================================================================
    # Establecer datos de entrada: U_i (urgencia), R_i (referencia), C_{i,j}
    # (compatibilidad), tamaño del problema (I, J, T), límites MAX_*.
    time_slots = generate_time_slots(doctors)
    if not time_slots:
        logger.warning("No time slots generated — check doctor availability config")
        return [], 0.0

    MAX_PATIENTS = 50
    MAX_SLOTS    = 40
    MAX_DOCTORS  = 20

    patients    = patients[:MAX_PATIENTS]
    time_slots  = time_slots[:MAX_SLOTS]
    doctors     = doctors[:MAX_DOCTORS]

    I = len(patients)
    J = len(doctors)
    T = len(time_slots)

    # =========================================================================
    # PASO 2: CREACIÓN DE VARIABLES BINARIAS SIMBÓLICAS
    # =========================================================================
    # No crear x_{i,j,t} si C_{i,j}=0. Filtro estricto reduce tamaño de matriz.
    # C[i][j]=1 ↔ specialties_match Y doctor disponible en al menos un slot.
    x_vars: dict[tuple[int, int, int], object] = {}

    for i, patient in enumerate(patients):
        for j, doctor in enumerate(doctors):
            if not specialties_match(patient.specialty, doctor.specialty):
                continue

            for t, slot in enumerate(time_slots):
                if not doctor_available_at(doctor, slot):
                    continue
                x_vars[(i, j, t)] = Binary(f"x_{i}_{j}_{t}")

    total_vars = len(x_vars)
    logger.info(
        "QUBO sparse variables: %d / %d total (%.1f%% reduction via C_{i,j} filter)",
        total_vars, I * J * T,
        100.0 * (1 - total_vars / max(I * J * T, 1)),
    )

    if total_vars == 0:
        logger.warning("No feasible (patient, doctor, slot) combinations found")
        return [], 0.0

    # =========================================================================
    # PASO 3: CONSTRUCCIÓN DE LOS COMPONENTES DEL HAMILTONIANO
    # =========================================================================
    #   A. Términos lineales: costo/beneficio individual de cada variable.
    #   B. Términos cuadráticos: interacción entre pares (doctor ≤1 paciente/slot).
    #   C. Restricciones: paciente asignado exactamente 1 vez.

    # =========================================================================
    # PASO 4: ASIGNACIÓN DE PESOS (HYPERPARÁMETROS)
    # Multiplicar cada componente por λ. Placeholder permite tunear sin recompilar.
    # =========================================================================
    lambda1 = Placeholder("lambda1")
    lambda2 = Placeholder("lambda2")
    lambda4 = Placeholder("lambda4")

    # A. Términos lineales (objetivo + recompensa referencia)
    # peso = (U_i · C_{i,j}) + (λ₄ · R_i). C_{i,j}=1 en variables creadas.
    # R_i=10, λ₄=20 → interconsulta suma 200 vs máx 10 de urgencia.
    H_obj = 0.0
    for (i, j, t), x_var in x_vars.items():
        U_i  = patients[i].urgency
        R_i  = patients[i].referral_multiplier
        peso = U_i + (lambda4 * R_i)
        H_obj -= peso * x_var

    # B. Términos cuadráticos: penaliza si doctor j tiene >1 paciente en slot t.
    # occupancy*(occupancy-1) = 0 si ≤1, crece si >1.
    H_doctor = 0.0
    by_jt: dict[tuple[int, int], list] = defaultdict(list)
    for (i, j, t), x_var in x_vars.items():
        by_jt[(j, t)].append(x_var)

    for (j, t), vars_jt in by_jt.items():
        if len(vars_jt) < 2:
            continue
        occupancy = sum(vars_jt)
        H_doctor += occupancy * (occupancy - 1)

    # C. Restricción: (Σ_{j,t} x_{i,j,t} - 1)² → paciente asignado exactamente 1 vez.
    H_patient = 0.0
    by_i: dict[int, list] = defaultdict(list)
    for (i, j, t), x_var in x_vars.items():
        by_i[i].append(x_var)

    for i, vars_i in by_i.items():
        total_assigned = sum(vars_i)
        H_patient += (total_assigned - 1) ** 2

    # Hamiltoniano completo
    H = H_obj + lambda1 * H_doctor + lambda2 * H_patient

    # =========================================================================
    # PASO 5: COMPILACIÓN A MODELO QUBO
    # =========================================================================
    # Transformar expresión simbólica en matriz QUBO numérica + offset.
    model = H.compile()
    feed_dict = {
        "lambda1": params.lambda1,
        "lambda2": params.lambda2,
        "lambda4": params.lambda4,
    }
    qubo_matrix, qubo_offset = model.to_qubo(feed_dict=feed_dict)

    logger.info("QUBO matrix compiled with %d interactions", len(qubo_matrix))

    # =========================================================================
    # PASO 6: CONFIGURACIÓN Y EJECUCIÓN DEL SOLVER (SAMPLING)
    # Simulated Annealing (SASampler) — num_reads para buscar mínimo global.
    # =========================================================================
    sampler = oj.SASampler()

    beta_min, beta_max = params.beta_range if params.beta_range else (0.1, 10.0)

    response = sampler.sample_qubo(
        Q=qubo_matrix,
        num_reads=params.num_reads,
        num_sweeps=params.num_sweeps,
        beta_min=beta_min,
        beta_max=beta_max,
    )

    best_sample  = response.first.sample
    best_energy  = response.first.energy + qubo_offset

    logger.info("Best energy: %.4f (offset: %.4f)", best_energy, qubo_offset)

    # =========================================================================
    # PASO 7: EXTRACCIÓN Y DECODIFICACIÓN DEL RESULTADO
    # Recuperar best sample y convertir vector binario en asignaciones.
    # pyqubo 1.5: decode_sample devuelve DecodedSample (no una tupla).
    # Post-procesador greedy para garantizar restricciones físicas.
    # =========================================================================
    decoded = model.decode_sample(best_sample, vartype="BINARY", feed_dict=feed_dict)

    # constraints() devuelve {name: (satisfied, value)}; broken = no satisfechas
    broken = [name for name, (ok, _) in decoded.constraints().items() if not ok]
    if broken:
        logger.warning("%d broken constraints in best sample", len(broken))

    assignments: list[Assignment] = []
    assigned_patients:  set[int]              = set()
    doctor_slot_used:   dict[tuple[int, int], bool] = {}

    # Sort by combined priority: referred patients first, then by urgency descending
    sorted_triplets = sorted(
        x_vars.keys(),
        key=lambda ijt: (
            -patients[ijt[0]].referral_multiplier,
            -patients[ijt[0]].urgency,
        ),
    )

    for (i, j, t) in sorted_triplets:
        var_name = f"x_{i}_{j}_{t}"
        # Variables creadas con Binary(...) suelto: pyqubo las devuelve en el
        # sample raw por su nombre literal, no descompuestas en Array.
        val = best_sample.get(var_name, 0)

        if val != 1:
            continue
        if i in assigned_patients:
            continue
        if doctor_slot_used.get((j, t), False):
            continue

        doctor_slot_used[(j, t)] = True
        assigned_patients.add(i)

        assignments.append(Assignment(
            patient_id=patients[i].id,
            doctor_id=doctors[j].id,
            time_slot=time_slots[t],
            room=doctors[j].room_number,
        ))

    logger.info(
        "Assigned %d / %d patients (broken_constraints=%d, energy=%.4f)",
        len(assignments), I, len(broken), best_energy,
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
