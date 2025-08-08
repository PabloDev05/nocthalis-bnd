# ⚔️ Sistema de Combate PvP/PvE - Nocthalis

Este módulo implementa un sistema de combate **por turnos** entre un **jugador** y un **enemigo bot** en el juego de navegador Nocthalis.

La arquitectura sigue el patrón **Rutas → Controladores → Servicios/Scripts**, para mantener el código limpio y modular.

---

## 📂 Estructura de carpetas relevante

│
├── classes/ # Clases POO que representan entidades del juego
│ └── combat/
│ ├── PlayerCharacter.ts # Clase que representa al jugador en combate
│ ├── EnemyBot.ts # Clase que representa a un enemigo bot
│ ├── CombatManager.ts # Clase que gestiona las rondas y ataques
│ └── Fixtures.ts # Datos de prueba (stats base temporales)
│
├── controllers/
│ └── simulateCombat.controller.ts # Controlador para iniciar simulación
│
├── interfaces/ # Definiciones TypeScript para tipado fuerte
│ ├── character/
│ │ └── CharacterClass.interface.ts # Stats base, resistencias, etc.
│ └── combat/
│ └── CombatEntity.ts # Contrato que cumplen Player/Enemy
│
├── routes/
│ └── combat.routes.ts # Define los endpoints relacionados al combate
│
├── services/
│ └── simulateCombat.ts # Simulación de combate paso a paso
│
└── server.ts # Configuración Express principal

## 🔹 Flujo de ejecución

1. **Cliente / Postman** → hace un `POST /combat/simulate` (o la ruta que definas).
2. **Ruta** (`combat.routes.ts`) → recibe la solicitud y llama al controlador.
3. **Controlador** (`simulateCombat.controller.ts`) → ejecuta la lógica de `simulateCombat` desde `scripts/` o `services/`.
4. **Servicio / Script** (`simulateCombat.ts`) →
   - Crea un jugador (`PlayerCharacter`)
   - Crea un enemigo (`EnemyBot`)
   - Usa `CombatManager` para simular el combate turno a turno.
5. **CombatManager** →
   - Controla el orden de los turnos.
   - Calcula el daño infligido usando `calculateDamage`.
   - Verifica si alguien ha muerto (`isCombatOver`).
   - Devuelve el ganador y el registro de acciones (`log`).
6. **Controlador** → responde al cliente con:
   ```json
   {
     "winner": "player",
     "log": [
       "⚔️ Inicio del combate ⚔️",
       "Jugador ataca e inflige 10 de daño.",
       "Rata Gigante ataca e inflige 5 de daño.",
       "🥇 Ganador: Jugador"
     ]
   }
   ```
