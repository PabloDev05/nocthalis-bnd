# ⚔️ Nocthalis — Sistema de Combate, Enemigos y Loot

Implementación completa de **PvE por turnos** + **ecosistema de enemigos** (tiers/bosses) + **drop system** con rarezas y slots de equipo.  
Arquitectura limpia estilo **Rutas → Controladores → Servicios/Scripts**.

---

## 🧭 Tabla de Contenidos

- [Estructura de carpetas](#-estructura-de-carpetas)
- [Flujo de combate (PvE)](#-flujo-de-combate-pve)
- [Modelos de datos (resumen)](#-modelos-de-datos-resumen)
- [Sistema de Enemigos](#-sistema-de-enemigos)
- [Sistema de Loot y Rarezas](#-sistema-de-loot-y-rarezas)
- [Sistema de Ítems (9 slots)](#-sistema-de-ítems-9-slots)
- [Generación masiva (seeds)](#-generación-masiva-seeds)
- [Endpoints sugeridos](#-endpoints-sugeridos)
- [Parámetros de balance (knobs)](#-parámetros-de-balance-knobs)
- [Cómo extender](#-cómo-extender)
- [FAQ](#-faq)

---

## 📂 Estructura de carpetas

```
src/
├─ classes/
│  └─ combat/
│     ├─ PlayerCharacter.ts        # Wrapper combate del personaje
│     ├─ EnemyBot.ts               # Wrapper combate del enemigo
│     ├─ CombatManager.ts          # Rondas, turnos y reglas
│     └─ Fixtures.ts               # Stats base temporales
│
├─ controllers/
│  ├─ simulateCombat.controller.ts # Dispara simulación PvE
│  └─ (... otros controladores)
│
├─ interfaces/
│  ├─ character/
│  │  └─ CharacterClass.interface.ts
│  └─ combat/
│     └─ CombatEntity.ts           # Contrato Player/Enemy
│
├─ models/
│  ├─ Character.ts
│  ├─ CharacterClass.ts
│  ├─ Enemy.ts                     # ← Enemy con dropProfile y recompensas
│  └─ Item.ts                      # ← 9 slots de equipamiento
│
├─ routes/
│  ├─ combat.routes.ts
│  └─ (... rutas de character, etc.)
│
├─ scripts/
│  ├─ generateEnemies.ts           # ← genera 50 enemigos (tiers+bosses)
│  ├─ seedItems.ts                 # ← catálogo escalado por rareza/slot
│  ├─ seedCharacterClasses.ts
│  └─ resetDb.ts                   # ← resetea e inserta seeds
│
├─ services/
│  └─ simulateCombat.ts            # Motor de simulación paso a paso
│
└─ utils/
   └─ loot.ts                      # ← roller de drops por slot/rareza
```

---

## 🔹 Flujo de combate (PvE)

1. **POST** `/_/combat/simulate`
2. `combat.routes.ts` → `simulateCombat.controller.ts`
3. `simulateCombat.ts`:
   - Instancia `PlayerCharacter` + `EnemyBot`
   - Corre `CombatManager` por turnos
4. `CombatManager`:
   - Orden de turnos, daño, checks de muerte
   - Devuelve `winner` + `log[]`
5. Respuesta ejemplo:

```json
{
  "winner": "player",
  "log": [
    "⚔️ Inicio del combate ⚔️",
    "Jugador ataca e inflige 10 de daño.",
    "Lobo Curtido ataca e inflige 5 de daño.",
    "🥇 Ganador: Jugador"
  ]
}
```

---

## 🧱 Modelos de datos (resumen)

### Enemy (`models/Enemy.ts`)

- `tier`: `"common" | "elite" | "rare"`
- `isBoss?`, `bossType?`: `"miniboss" | "boss" | "world"`
- `xpReward`, `goldReward`
- `dropProfile`:
  - `rolls`: nº de tiradas de drop
  - `rarityChances`: `{ common, uncommon, rare, epic, legendary }` (∑≈100)
  - `slotWeights`: pesos por slot (helmet, chest, gloves, boots, mainWeapon, offWeapon, ring, belt, amulet)
  - `guaranteedMinRarity?`: asegura mínimo en 1 tirada (ej. `"rare"`)

### Item (`models/Item.ts`)

- `type`: `"weapon" | "armor" | "accessory" | "potion" | "material"`
- `slot`: **9 slots**: `helmet | chest | gloves | boots | mainWeapon | offWeapon | ring | belt | amulet`
- `rarity`: `"common" | "uncommon" | "rare" | "epic" | "legendary"`
- `stats`, `combatStats`, `levelRequirement`, etc.

---

## 🛡️ Sistema de Enemigos

### Arquetipos

`melee, archer, mage, tank, beast, rogue`  
Determinan qué stats crecen y su **preferencia de loot** por slot.

### Niveles y tiers

- **Nivel** escala stats, resistencias y recompensas.
- **Tier** (prob. base): `common 70%`, `elite 25%`, `rare 5%`
  - Multiplica stats/combate y añade resistencias extra.

### Bosses

- `miniboss` (niveles 4, 8, 12)
- `boss` (niveles 10, 15)
- Más `rolls` de drop, mejores rarezas, y `guaranteedMinRarity`.

### Recompensas (fórmula simplificada)

- `xpReward = round((12 + lvl * 8) * tierMul * bossMul)`
- `goldReward = round((6 + lvl * 3) * tierMul * bossMul)`
- `tierMul`: `common=1.0, elite=1.35, rare=1.7`
- `bossMul`: `miniboss=1.2, boss=1.6, world=2.0`

---

## 🎁 Sistema de Loot y Rarezas

### Cómo se decide cada drop

1. Nº de tiradas: `dropProfile.rolls`
2. **Rareza**: sorteo con `dropProfile.rarityChances`
3. **Slot**: sorteo con `dropProfile.slotWeights`
4. **Garantía** (si hay): una tirada fuerza `guaranteedMinRarity` o superior
5. **Preferencia por clase del jugador**: el roller pondera slots útiles
6. **Fallbacks** si no hay ítem exacto:
   - Misma rareza en slots preferidos por la clase
   - Bajar rareza (hasta `common`)
   - Consumibles/materiales

### Distribución típica de rarezas (no-boss)

| Rareza    | Probabilidad |
| --------- | ------------ |
| common    | 60–70%       |
| uncommon  | 25–35%       |
| rare      | 5–12%        |
| epic      | 0–6%         |
| legendary | 0–1%         |

> Bosses mueven la curva hacia `rare/epic/legendary` y aumentan `rolls`.

### Preferencias de slots por clase (ejemplo)

| Clase    | +Slots comunes                        |
| -------- | ------------------------------------- |
| Guerrero | mainWeapon, offWeapon, chest, gloves  |
| Mago     | mainWeapon, offWeapon, amulet, helmet |
| Asesino  | mainWeapon, boots, gloves, ring       |
| Arquero  | mainWeapon, offWeapon, ring, boots    |

---

## 🧩 Sistema de Ítems (9 slots)

Slots soportados (equipamiento del personaje):

1. `helmet`
2. `chest`
3. `gloves`
4. `boots`
5. `mainWeapon`
6. `offWeapon`
7. `ring` (1)
8. `belt` (1)
9. `amulet` (1)

**Escalado por rareza** (plantillas definidas en `seedItems.ts`):

- `common` → +0–5% stats base
- `uncommon` → +5–12%
- `rare` → +12–20% + mejores resist
- `epic` → +20–30% + efectos
- `legendary` → +30–40% + habilidades únicas

> Cada slot refuerza atributos distintos (p. ej., **chest** tiende a **vitality/defensas**, **mainWeapon** a **attack/magicPower**, **amulet** a **sabiduría/magia**, etc.).

---

## 🚀 Generación masiva (seeds)

### Enemigos (`scripts/generateEnemies.ts`)

- RNG determinístico (**mulberry32**) para reproducibilidad
- Stats/Resistencias/Combate derivados por nivel + arquetipo
- **50 enemigos exactos**:
  - 3 por nivel (1..15) = 45
  - Miniboss: 4, 8, 12 (3)
  - Boss: 10, 15 (2)
- `dropProfile` coherente: `rarityChances`, `slotWeights` y `guaranteedMinRarity`

### Ítems (`scripts/seedItems.ts`)

- Generación por **slot × tramo de nivel × rareza**
- Tramos: `Novato (1–5)`, `Veterano (6–10)`, `Maestro (11–15)`
- Relleno de consumibles/materiales (para nunca quedar sin drop útil)

### Reset de base (`scripts/resetDb.ts`)

1. Limpia colecciones (users, characters, classes, enemies, items)
2. Crea índices
3. Inserta:
   - `CharacterClass` (seed estático)
   - **Items** generados por slot/rareza
   - **Enemigos** (50) + bosses

**Ejecutar:**

```bash
npm run reset-db
```

---

## 🌐 Endpoints sugeridos

- `POST /combat/simulate`  
  Simula un combate PvE rápido (debug/QA).

- `GET /character/me`  
  Muestra el personaje + clase y (si hay) subclase.

- `POST /character/choose-class`  
  Crea el personaje con stats base de la clase.

- `POST /character/choose-subclass`  
  Asigna subclase a partir del nivel requerido.

- `POST /battle/resolve` _(sugerido)_
  - Calcula daño/turnos
  - Otorga **XP/Gold** (`enemy.xpReward/goldReward`)
  - Sortea loot con `utils/loot.rollLootForEnemy(enemy, playerClass)`
  - Agrega ítems al inventario

---

## 🎚️ Parámetros de balance (knobs)

- `generateEnemies.ts`

  - Distribución de **tiers** (`common/elite/rare`)
  - Fórmulas de **XP/Gold**
  - **slotWeights** por arquetipo
  - Boss levels y `guaranteedMinRarity`

- `seedItems.ts`

  - **RARITY_MUL** (multiplicadores por rareza)
  - Plantillas por **slot** (qué stats potencia cada pieza)
  - Tramos de nivel (**Novato/Veterano/Maestro**)

- `utils/loot.ts`
  - Preferencias por **clase** del jugador (ponderación de slots)
  - Fallbacks (mismas rarezas, bajar rareza, consumibles/materiales)

---

## ➕ Cómo extender

- **Nuevos slots**: agregar al `enum` en `Item.ts`, ajustar plantillas en `seedItems.ts` y pesos en `slotWeights`.
- **Más bosses**: añadir niveles en `generateEnemies.ts` (world bosses) y subir `guaranteedMinRarity`.
- **Eventos**: aplicar `xpMultiplier`/`lootTierMultiplier` por temporada.
- **Sets de ítems**: añadir `setId`/`setBonus` (modelo `Item`) y bonificar en `PlayerCharacter`.

---

## ❓ FAQ

**¿La rareza del ítem afecta la probabilidad de que caiga?**  
Sí, la **rareza** se decide por `rarityChances`. El **slot** se decide aparte por `slotWeights`. Bosses sesgan a rarezas altas y más tiradas.

**¿Se priorizan piezas útiles para la clase del jugador?**  
Sí. El roller combina `slotWeights` del enemigo **+** preferencia de slots por clase (Guerrero/Mago/Asesino/Arquero).

**¿Qué asegura que siempre caiga algo?**  
Fallbacks: misma rareza en slots preferidos → bajar rareza → consumibles/materiales.

**¿Por qué 50 enemigos?**  
Cobertura 1–15 con variedad (arquetipos, tiers) y picos de dificultad/loot (miniboss/boss) para testear progresión.

---

> Si necesitás ver ejemplos concretos de un enemigo o un drop, revisá:
>
> - `scripts/generateEnemies.ts` → crea los 50 con `dropProfile`
> - `utils/loot.ts` → lógica de `rollLootForEnemy`
> - `scripts/seedItems.ts` → cómo escalan stats de equipo por rareza/slot

¡Listo! Con esto, un dev nuevo entiende **qué hace cada parte**, **dónde tocar** para balancear y **cómo poblar** todo con un solo comando.
