"""
Genera y guarda una visualización simple del concepto QUBO — Proyecto Qura.

Muestra los 4 estados posibles (vértices) de dos pacientes compitiendo
por un slot con un doctor, y cuál tiene menor energía (= ganador).
"""

import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from pathlib import Path

OUTPUT = Path(__file__).parent / "qubo_landscape.png"

# ── Parámetros del modelo Qura ────────────────────────────────────────────────
U1, U2  = 5.0, 9.0     # urgencia: Paciente 1 (directo), Paciente 2 (interconsulta)
R1, R2  = 1.0, 10.0    # multiplicador de referencia
lambda1 = 50.0          # penalización: dos pacientes en el mismo slot
lambda2 = 50.0          # penalización: paciente asignado más de una vez
lambda4 = 20.0          # recompensa: interconsulta médica

def energia(x1, x2):
    """Calcula H(x1, x2) para valores binarios exactos."""
    termino1 = -(U1 * x1 + U2 * x2)
    termino4 = -lambda4 * (R1 * x1 + R2 * x2)
    termino2 = lambda1 * x1 * x2
    termino3 = lambda2 * ((x1 + x2) - 1) ** 2
    return termino1 + termino4 + termino2 + termino3

# ── Los 4 estados QUBO posibles ──────────────────────────────────────────────
estados = [
    {"label": "Ninguno\nasignado", "x1": 0, "x2": 0, "pos": (1, 2)},
    {"label": "Solo Pac.1\n(directo)", "x1": 1, "x2": 0, "pos": (0, 0)},
    {"label": "Solo Pac.2\n(interconsulta)", "x1": 0, "x2": 1, "pos": (2, 0)},
    {"label": "Ambos\n(conflicto)", "x1": 1, "x2": 1, "pos": (1, -2)},
]

for e in estados:
    e["energia"] = energia(e["x1"], e["x2"])

minimo = min(estados, key=lambda e: e["energia"])

# ── Figura ────────────────────────────────────────────────────────────────────
fig, ax = plt.subplots(figsize=(10, 7), facecolor="#0f1117")
ax.set_facecolor("#0f1117")
ax.set_xlim(-1.2, 3.2)
ax.set_ylim(-3.5, 3.5)
ax.axis("off")

ax.set_title(
    "QUBO — Qura: ¿A quién asignar?\n"
    "El algoritmo busca el estado de menor energia",
    color="white", fontsize=13, fontweight="bold", pad=16
)

# Dibujar cada estado como una caja
for e in estados:
    px, py = e["pos"]
    es_minimo = e is minimo

    color_borde = "#00e676" if es_minimo else "#555577"
    color_fondo = "#1a2e1a" if es_minimo else "#1a1a2e"
    color_texto = "#00e676" if es_minimo else "#ccccee"
    grosor      = 3 if es_minimo else 1.2

    rect = mpatches.FancyBboxPatch(
        (px - 0.7, py - 0.7), 1.4, 1.4,
        boxstyle="round,pad=0.08",
        linewidth=grosor,
        edgecolor=color_borde,
        facecolor=color_fondo,
        zorder=3,
    )
    ax.add_patch(rect)

    # Etiqueta del estado
    ax.text(px, py + 0.28, e["label"], ha="center", va="center",
            color=color_texto, fontsize=9.5, fontweight="bold", zorder=4)

    # Energía
    signo = "-" if e["energia"] < 0 else "+"
    ax.text(px, py - 0.22,
            f"E = {e['energia']:.0f}",
            ha="center", va="center",
            color="#00e676" if es_minimo else "#ff8a65",
            fontsize=11, fontweight="bold", zorder=4)

    # Corona "GANADOR"
    if es_minimo:
        ax.text(px, py + 0.78, "GANADOR  (minimo)", ha="center", va="center",
                color="#00e676", fontsize=8.5,
                bbox=dict(boxstyle="round,pad=0.3", facecolor="#003322",
                          edgecolor="#00e676", linewidth=1.2))

# ── Flechas entre estados (estructura de cubo/rombo) ─────────────────────────
conexiones = [
    (estados[0], estados[1]),
    (estados[0], estados[2]),
    (estados[1], estados[3]),
    (estados[2], estados[3]),
]
for a, b in conexiones:
    ax.annotate(
        "", xy=b["pos"], xytext=a["pos"],
        arrowprops=dict(arrowstyle="-", color="#444466", lw=1.2, linestyle="dashed"),
        zorder=1,
    )

# ── Leyenda lateral ───────────────────────────────────────────────────────────
leyenda_y = 3.1
ax.text(3.0, leyenda_y, "Parametros del modelo", color="#aaaacc",
        fontsize=9, fontweight="bold", ha="left", va="top")

params = [
    ("U1 (urgencia Pac.1)", f"{U1:.0f}"),
    ("U2 (urgencia Pac.2)", f"{U2:.0f}"),
    ("R1 (directo web)", f"{R1:.0f}"),
    ("R2 (interconsulta MG)", f"{R2:.0f}"),
    ("L1 (conflicto slot)", f"{lambda1:.0f}"),
    ("L2 (multi-asignacion)", f"{lambda2:.0f}"),
    ("L4 (recompensa ref.)", f"{lambda4:.0f}"),
]
for i, (nombre, valor) in enumerate(params):
    ax.text(3.0, leyenda_y - 0.52 - i * 0.48,
            f"{nombre}:", color="#888899", fontsize=8, ha="left")
    ax.text(4.55, leyenda_y - 0.52 - i * 0.48,
            valor, color="#ccccee", fontsize=8, fontweight="bold", ha="left")

# ── Fórmula simplificada ──────────────────────────────────────────────────────
ax.text(
    1.0, -3.2,
    "H = -(U*x) - (L4*R*x)  +  L1*(x1*x2)  +  L2*(x1+x2-1)^2",
    ha="center", color="#666688", fontsize=8.5,
    style="italic",
)

plt.tight_layout()
plt.savefig(OUTPUT, dpi=160, bbox_inches="tight", facecolor=fig.get_facecolor())
plt.close()
print(f"Imagen guardada en: {OUTPUT}")
