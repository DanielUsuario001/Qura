# Motor de Optimización QUBO — Qura

Microservicio Python que asigna citas médicas usando **Simulated Annealing** sobre una formulación QUBO, respetando el modelo de referencias (interconsultas) de hospitales públicos peruanos (MINSA/EsSalud).

---

## Variables de decisión

| Símbolo | Tipo | Descripción |
|---|---|---|
| $x_{i,j,t}$ | Binaria `{0,1}` | 1 si el paciente $i$ es asignado al doctor $j$ en el slot $t$ |
| $U_i$ | Entero 1–10 | Urgencia clínica del paciente |
| $C_{i,j}$ | Binaria `{0,1}` | 1 si la especialidad del paciente coincide con la del doctor |
| $R_i$ | Real | Multiplicador de referencia: `1.0` (web directo) / `10.0` (interconsulta MG) |

---

## Hamiltoniano

$$H(x) = \underbrace{-\sum_{i,j,t}(U_i \cdot C_{i,j})\, x_{i,j,t}}_{\text{Término 1: urgencia}} + \underbrace{\lambda_1 \sum_{j,t}\sum_{i \neq i'} x_{i,j,t}\, x_{i',j,t}}_{\text{Término 2: capacidad}} + \underbrace{\lambda_2 \sum_i \!\left(\sum_{j,t} x_{i,j,t} - 1\right)^{\!2}}_{\text{Término 3: unicidad}} \underbrace{- \lambda_4 \sum_{i,j,t} R_i\, x_{i,j,t}}_{\text{Término 4: interconsulta}}$$

### Qué hace cada término

**Término 1 — Urgencia clínica (objetivo)**
Minimizar energía equivale a maximizar la atención a pacientes urgentes. $C_{i,j}$ impide asignar un doctor de especialidad incorrecta.

**Término 2 — Capacidad del doctor** (`λ₁ = 50`)
Penaliza cualquier slot en que el mismo doctor tendría más de un paciente simultáneo. Se expande como $\text{occ}(\text{occ}-1)$, que es 0 cuando occ ≤ 1 y crece cuadráticamente.

**Término 3 — Una cita por paciente** (`λ₂ = 50`)
Penaliza que el mismo paciente quede asignado en varios horarios. El cuadrado garantiza que la penalización sea 0 solo cuando la suma es exactamente 1.

**Término 4 — Prioridad de interconsulta** (`λ₄ = 20`)
Recompensa (energía negativa) a los pacientes derivados por un Médico General. Con $R_i = 10$ y $\lambda_4 = 20$, una interconsulta aporta **−200** de energía frente al máximo de **−10** por urgencia → prioridad matemática absoluta.

---

## Optimización de implementación

Los Términos 1 y 4 son ambos lineales, por lo que se combinan en un solo bucle:

```python
peso = U_i + (lambda4 * R_i)   # C_{i,j}=1 para todos los x_vars creados
H_obj -= peso * x_var
```

Las variables `Binary(f"x_{i}_{j}_{t}")` se crean **solo** para triplets donde $C_{i,j} = 1$ y el doctor tiene disponibilidad en ese slot, reduciendo drásticamente el tamaño de la matriz QUBO.

---

## Flujo de ejecución

```
Next.js /api/optimize
    │
    ├─ SELECT pending appointments (patients)
    ├─ SELECT active doctors + available_slots
    │
    └─► POST /solve  →  FastAPI (Python)
              │
              ├─ Generar slots concretos desde available_slots JSONB
              ├─ Filtrar por C_{i,j} (especialidad)
              ├─ Construir Hamiltoniano H(x) con pyqubo
              ├─ Compilar → QUBO dict
              ├─ SASampler.sample_qubo(num_reads=1000, num_sweeps=500)
              └─ Decodificar best_sample → assignments JSON
```

---

## Hiperparámetros por defecto

| Parámetro | Valor | Rol |
|---|---|---|
| `lambda1` | 50 | Restricción de capacidad (dura) |
| `lambda2` | 50 | Restricción de unicidad (dura) |
| `lambda4` | 20 | Recompensa por interconsulta |
| `num_reads` | 1000 | Lecturas del SA sampler |
| `num_sweeps` | 500 | Sweeps por lectura |
| `beta_range` | [0.1, 10.0] | Rango de temperatura inversa |

Las penalizaciones λ₁ y λ₂ deben ser mayores que la recompensa máxima posible (`U_i + λ₄·R_i = 10 + 200 = 210`) para garantizar que las restricciones físicas no se rompan. Con valores de 50 son estrictas pero no dominantes si se violan pocas.
