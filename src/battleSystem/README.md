# Battle System

Módulo encargado de manejar toda la lógica de combate (PvE y PvP) en **Nocthalis**.  
Centraliza clases, motores, constantes y utilidades para mantener un sistema modular, reutilizable y fácil de extender.

---

## Estructura de carpetas

- **core/** → Motor base del sistema:

  - `CombatManager.ts` → Controlador principal de combates (resuelve turnos, aplica daño, críticos, evasión, bloqueo, estados).
  - `SimulateCombat.ts` → Función de simulación de combates (sandbox PvE/PvP).
  - `CharacterSnapshot.ts` → Representación estática de un personaje en un instante de combate (HP, stats, buffs, etc.).
  - `StatusEngine.ts` → Motor para estados, buffs y debuffs (poison, bleed, stun, etc.).
  - `Builders.ts` → Utilidades para instanciar personajes o enemigos desde datos crudos.
  - `RngFightSeed.ts` → Generador de semillas para RNG en combates (asegura reproducibilidad).

- **entities/** → Entidades participantes del combate:

  - `PlayerCharacter.ts` → Representación de un jugador humano.
  - `EnemyBot.ts` → Representación de un enemigo controlado por IA.

- **fixtures/** → Datos y plantillas de prueba:

  - `Fixtures.ts` → Stats base, configuraciones y ejemplos de personajes para test o demos.

- **passives/** → Sistema de habilidades pasivas:

  - `ClassPacks.ts` → Paquetes de pasivas agrupadas por clase (Guerrero, Mago, Asesino, Arquero).
  - `PassiveEffects.ts` → Definiciones de efectos pasivos (ej. +Evasión, +Crítico, Lifesteal).
  - `types.ts` → Tipos e interfaces relacionados con pasivas.

- **pve/** → Lógica de combate contra entorno (PvE).

  - IA de enemigos, loot, bosses y progresión (en desarrollo).

- **pvp/** → Lógica de combate jugador contra jugador (PvP):

  - `pvpRunner.ts` → Entrada principal para ejecutar combates PvP.  
    Incluye `runPvp` (versión genérica con snapshots) y `runPvpForMatch` (adaptada a modelo Match de la DB).
  - `index.ts` → Export central del módulo PvP.

- **constants/** → Constantes globales del sistema de combate:
  - `allocateCoeffs.ts` → Coeficientes para asignación de puntos de stats por nivel.
  - `resistances.ts` → Resistencias básicas aplicables a todas las entidades.
  - `status.ts` → Estados y códigos de efectos estándar.

---

## index.ts

Punto de entrada del módulo de combate.  
Sirve como **export central** para acceder al sistema completo desde fuera del directorio `battleSystem/`.

Ejemplo de uso en controladores:

```ts
import { runPvp } from "../battleSystem";

const result = runPvp({
  attackerSnapshot,
  defenderSnapshot,
  seed: "1234",
  maxRounds: 30,
});
```
