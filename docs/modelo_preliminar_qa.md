# Refactorización del Motor Cuántico: Proyecto Qura (Lógica de Hospitales Perú)

## Contexto del Sistema
Estamos actualizando el microservicio de optimización (Python, FastAPI, OpenJij, PyQUBO) para el sistema de asignación de citas médicas (Qura). El modelo debe reflejar fielmente el sistema de referencias (interconsultas) de los hospitales públicos en Perú (MINSA/EsSalud). 

La lógica principal es:
1. Las citas de especialidad dependen de una evaluación previa en Medicina General.
2. Si un Médico General deriva a un paciente a un especialista, esta solicitud tiene **prioridad matemática absoluta** sobre un paciente que intenta autoprogramarse directamente.

## Parámetros del Modelo
* $x_{i,j,t} \in \{0, 1\}$: Variable binaria de decisión. 1 si al paciente $i$ se le asigna el doctor $j$ en el tiempo $t$.
* $U_i$: Nivel de urgencia clínica del paciente $i$.
* $C_{i,j} \in \{0, 1\}$: Matriz de compatibilidad estricta. Vale 1 solo si la especialidad requerida por el paciente coincide con la del doctor $j$.
* $R_i$: Multiplicador de "Referencia" (Origen de la solicitud). 
  * Si la cita fue solicitada directamente por el paciente web: $R_i = 1$
  * Si la cita fue derivada y validada por un Médico General: $R_i = 10$ (Alto peso).

## Formulación QUBO (Hamiltoniano)
El objetivo es encontrar el mínimo de energía de la siguiente ecuación $H(x)$, que consta de 4 términos principales:

$$H(x) = - \sum_{i,j,t} (U_i \cdot C_{i,j}) x_{i,j,t} + \lambda_1 \sum_{j,t} \sum_{i \neq i'} x_{i,j,t} x_{i',j,t} + \lambda_2 \sum_i \left( \sum_{j,t} x_{i,j,t} - 1 \right)^2 - \lambda_4 \sum_{i,j,t} R_i \cdot x_{i,j,t}$$

* **Término 1 (Objetivo Principal):** Maximiza la atención basada en la urgencia $U_i$. La matriz $C_{i,j}$ actúa como filtro para que no se asignen doctores equivocados.
* **Término 2 (Restricción de Capacidad):** Penaliza ($\lambda_1$) si un mismo doctor $j$ tiene asignado más de un paciente en el mismo bloque $t$.
* **Término 3 (Restricción del Paciente):** Penaliza ($\lambda_2$) si el mismo paciente $i$ recibe más de una cita en diferentes horarios.
* **Término 4 (Recompensa de Referencia Médica):** Recompensa enormemente (minimiza con un valor negativo) las variables $x$ de aquellos pacientes cuya solicitud proviene de una interconsulta oficial ($R_i$), dándoles prioridad en la agenda.

## Instrucciones de Implementación para Cursor
Por favor, refactoriza el script de Python actual utilizando `pyqubo`:

1. **Pre-procesamiento:** Antes de construir el modelo `Array.create('x', ...)`, filtra las combinaciones inválidas usando $C_{i,j}$. No crees variables $x_{i,j,t}$ si $C_{i,j} == 0$. Esto reducirá drásticamente el tamaño de la matriz y ahorrará recursos de cómputo.
2. **Construcción del Modelo:** Transcribe los términos del Hamiltoniano en sintaxis de `pyqubo`.
3. **Hiperparámetros:** Define variables para las penalizaciones `lambda_1`, `lambda_2` (valores positivos altos para asegurar restricciones físicas, ej. 50) y `lambda_4` (valor positivo ajustado, ej. 20) para calibrar el modelo posteriormente.
4. **Salida:** Configura el `SASampler()` de `openjij` para procesar este QUBO y decodificar el `response.first.sample` retornando un JSON estructurado con las asignaciones óptimas.
5. **Optimización de Código (Términos Lineales):** Al momento de programar, ten en cuenta que el Término 1 y el Término 4 se pueden agrupar en un solo bucle `for` de Python, ya que ambos son términos lineales. Puedes simplificar el peso de la variable sumando las recompensas: `peso = (U[i] * C[i,j]) + (lambda_4 * R[i])` y luego aplicando ese peso total negativo por cada variable $x_{i,j,t}$ instanciada.