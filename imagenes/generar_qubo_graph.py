"""
Interaction Graph of the Hamiltonian — Proyecto Qura
Adaptado del flujo de referencia QUBO (Quantum Universe EXPO).

Pasos:
  1. Construir la matriz Q con pyqubo usando los parametros reales de Qura
  2. Resolver con SASampler de openjij
  3. Imprimir solucion, energia y variable ganadora
  4. Visualizar el grafo de interacciones
"""

import sys
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import networkx as nx
import openjij as oj
from collections import defaultdict
from pathlib import Path
from pyqubo import Binary, Placeholder

sys.path.insert(0, str(Path(__file__).parent.parent / "optimizer"))

OUTPUT = Path(__file__).parent / "qubo_graph.png"

# =============================================================================
# PASO 1: Parametros del mundo real — Qura
# =============================================================================
# 2 pacientes compitiendo por 1 doctor en 2 slots de tiempo
PATIENTS = [
    {"label": "x[0] Pac.directo",       "urgency": 5,  "R": 1.0},
    {"label": "x[1] Pac.interconsulta", "urgency": 9,  "R": 10.0},
    {"label": "x[2] Pac.directo/B",     "urgency": 7,  "R": 1.0},
    {"label": "x[3] Pac.interconsulta/B","urgency": 6, "R": 10.0},
]
lambda1 = 50.0   # penalizacion conflicto de slot
lambda2 = 50.0   # penalizacion multi-asignacion
lambda4 = 20.0   # recompensa interconsulta

# =============================================================================
# PASO 2: Variables binarias simbolicas
# x[0], x[1] = Pac.directo e interconsulta en Slot A (mismo doctor, mismo slot)
# x[2], x[3] = Pac.directo e interconsulta en Slot B
# =============================================================================
N = len(PATIENTS)
x = [Binary(f"x[{i}]") for i in range(N)]

lam1 = Placeholder("lambda1")
lam2 = Placeholder("lambda2")
lam4 = Placeholder("lambda4")

# =============================================================================
# PASO 3: Construccion del Hamiltoniano
# =============================================================================
# A. Terminos lineales: recompensa por urgencia + interconsulta
term1_4 = sum(
    -(PATIENTS[i]["urgency"] + lam4 * PATIENTS[i]["R"]) * x[i]
    for i in range(N)
)

# B. Terminos cuadraticos: conflicto — mismo slot, mismo doctor
# Slot A: x[0] y x[1] no pueden activarse juntos
# Slot B: x[2] y x[3] no pueden activarse juntos
term2 = lam1 * (x[0] * x[1] + x[2] * x[3])

# C. Restriccion: cada par de slots debe asignarse exactamente 1 vez
# (x[0]+x[1]-1)^2 para Slot A,  (x[2]+x[3]-1)^2 para Slot B
term3 = lam2 * ((x[0] + x[1] - 1)**2 + (x[2] + x[3] - 1)**2)

H = term1_4 + term2 + term3

# =============================================================================
# PASO 4: Asignacion de pesos (hyperparameters)
# =============================================================================
feed_dict = {"lambda1": lambda1, "lambda2": lambda2, "lambda4": lambda4}

# =============================================================================
# PASO 5: Compilacion a modelo QUBO
# =============================================================================
model        = H.compile()
qubo, offset = model.to_qubo(feed_dict=feed_dict)

# Convertir a matriz numpy para pasarla al sampler
var_list = sorted(set(k for pair in qubo for k in pair))
idx      = {v: i for i, v in enumerate(var_list)}
Q        = np.zeros((N, N))
for (a, b), w in qubo.items():
    Q[idx[a], idx[b]] = w

print("Matriz Q:")
print(np.array2string(Q, precision=1, suppress_small=True))

# =============================================================================
# PASO 6: Configuracion y ejecucion del Sampler (Simulated Annealing)
# =============================================================================
sampler  = oj.SASampler()
response = sampler.sample_qubo(Q, num_reads=200)

# =============================================================================
# PASO 7: Extraccion y decodificacion del resultado
# =============================================================================
best = response.first

print("\n--- Resultado del Sampler ---")
print("Solucion (vector binario):", best.sample)
print("Energia minima encontrada:", best.energy + offset)
print("Variable ganadora Slot A (idx 0=directo, 1=interconsulta):", best.sample[0], "/", best.sample[1])
print("Variable ganadora Slot B (idx 2=directo, 3=interconsulta):", best.sample[2], "/", best.sample[3])

for i, p in enumerate(PATIENTS):
    if best.sample[i] == 1:
        print(f"  >> ASIGNADO: {p['label']}  (urgencia={p['urgency']}, R={p['R']})")

# =============================================================================
# PASO 8: Visualizacion — Interaction Graph of the Hamiltonian
# =============================================================================
def visualize_graph(Q, var_labels, solution, output_path):
    G = nx.DiGraph()
    n = Q.shape[0]

    for i in range(n):
        for j in range(n):
            if i != j and Q[i, j] != 0:
                G.add_edge(i, j, weight=Q[i, j])

    nodes  = list(G.nodes())
    angles = np.linspace(0, 2 * np.pi, n, endpoint=False) + np.pi / 2
    radius = 1.0
    pos    = {node: (radius * np.cos(angles[node]),
                     radius * np.sin(angles[node])) for node in range(n)}

    # Color de nodo: verde si fue seleccionado por el sampler
    node_colors = ["#a8e6a3" if solution[i] == 1 else "lightgray" for i in range(n)]

    fig, ax = plt.subplots(figsize=(8, 8), facecolor="white")
    ax.set_facecolor("white")
    ax.set_title(
        "Interaction Graph of the Hamiltonian — Qura QUBO\n"
        "Rojo = penalizacion (+)    Azul = recompensa (-)\n"
        "Verde = variable activada por el Sampler",
        fontsize=11, fontweight="bold", pad=12
    )

    nx.draw_networkx_nodes(G, pos, ax=ax, node_size=2200,
                           node_color=node_colors,
                           edgecolors="#555555", linewidths=2)
    nx.draw_networkx_labels(G, pos, ax=ax,
                            labels={i: var_labels[i] for i in range(n)},
                            font_size=8, font_weight="bold")

    drawn = set()
    for i, j, d in G.edges(data=True):
        w     = d["weight"]
        color = "red" if w > 0 else "blue"
        lw    = min(4.5, 0.8 + abs(w) / 25)
        rad   = 0.25 if (j, i) in drawn else 0.0

        nx.draw_networkx_edges(G, pos, ax=ax,
                               edgelist=[(i, j)],
                               width=lw, edge_color=color,
                               arrows=True, arrowsize=20,
                               connectionstyle=f"arc3,rad={rad}",
                               min_source_margin=30,
                               min_target_margin=30)
        drawn.add((i, j))

    edge_labels = {(i, j): f"{d['weight']:+.0f}"
                   for i, j, d in G.edges(data=True)}
    nx.draw_networkx_edge_labels(G, pos, edge_labels=edge_labels, ax=ax,
                                 font_size=9, font_color="#222222",
                                 font_weight="bold",
                                 bbox=dict(boxstyle="round,pad=0.2",
                                           fc="white", alpha=0.8, ec="none"))

    from matplotlib.lines import Line2D
    from matplotlib.patches import Patch
    legend = [
        Line2D([0], [0], color="red",  lw=2, label="Peso + (penalizacion)"),
        Line2D([0], [0], color="blue", lw=2, label="Peso - (recompensa)"),
        Patch(facecolor="#a8e6a3", edgecolor="#555", label="Activado por SA"),
    ]
    ax.legend(handles=legend, loc="lower center", fontsize=9,
              framealpha=0.9, ncol=3)

    ax.axis("equal")
    ax.axis("off")
    plt.tight_layout()
    plt.savefig(output_path, dpi=170, bbox_inches="tight", facecolor="white")
    plt.close()
    print(f"\nImagen guardada en: {output_path}")


var_labels = [p["label"] for p in PATIENTS]
visualize_graph(Q, var_labels, best.sample, OUTPUT)
