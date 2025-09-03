// src/battleSystem/passives/ClassPacks.ts
// Paquetes de pasivas por CLASE (Vampire, Werewolf, Necromancer, Revenant, Exorcist)
// En esta versión NO modifican números; solo emiten tags para efectos/animaciones/logs.
// Así evitamos duplicar la lógica Fate-driven de passiveDefaultSkill/ultimate del runner.

import type { ClassPassivePack, PassiveHooks, SideKey } from "./types";

const DBG = process.env.DEBUG_COMBAT === "1";

/** Normaliza nombre de clase de tu seed a una clave estable */
function classKey(name?: string | null) {
  switch (
    String(name ?? "")
      .trim()
      .toLowerCase()
  ) {
    case "vampire":
      return "vampire";
    case "werewolf":
      return "werewolf";
    case "necromancer":
      return "necromancer";
    case "revenant":
      return "revenant";
    case "exorcist":
      return "exorcist";
    default:
      return "unknown";
  }
}

function log(...args: any[]) {
  if (DBG) console.log("[ClassPacks]", ...args);
}

/** Tag helper: emite un evento namespaced para la clase */
function tag(pushEvent: (ev: string) => void, side: SideKey, cls: string, name: string) {
  pushEvent(`${side}:class:${cls}:${name}`);
}

/* ────────────────────────────────────────────────────────────────────
 * Packs por clase (solo tags; sin modificar daño en esta versión)
 * ──────────────────────────────────────────────────────────────────── */

function vampirePack(): ClassPassivePack {
  const hooks: PassiveHooks = {
    onRoundStart({ side, pushEvent }) {
      tag(pushEvent, side, "vampire", "round_start"); // ej. pequeña aura carmesí
      log("Vampire onRoundStart", side);
    },
    onModifyOutgoing({ side, flags, pushEvent }) {
      // Si el golpe fue crítico, podemos destacar el “sabor” vampírico en UI
      if (flags?.crit) tag(pushEvent, side, "vampire", "crit_flourish");
      // no modificamos dmg
    },
    onModifyIncoming({ side, flags, pushEvent }) {
      if (flags.blocked) tag(pushEvent, side, "vampire", "graceful_parry");
    },
  };
  return { name: "Vampire", hooks };
}

function werewolfPack(): ClassPassivePack {
  const hooks: PassiveHooks = {
    onRoundStart({ side, pushEvent }) {
      // Marca de frenesí creciente (solo visual/log)
      tag(pushEvent, side, "werewolf", "frenzy_tick");
      log("Werewolf onRoundStart", side);
    },
    onModifyOutgoing({ side, pushEvent }) {
      // Cada ataque deja un rastro para VFX de garras
      tag(pushEvent, side, "werewolf", "claw_trace");
    },
  };
  return { name: "Werewolf", hooks };
}

function necromancerPack(): ClassPassivePack {
  const hooks: PassiveHooks = {
    onRoundStart({ side, pushEvent }) {
      tag(pushEvent, side, "necromancer", "umbral_whisper");
      log("Necromancer onRoundStart", side);
    },
    onModifyOutgoing({ side, pushEvent, flags }) {
      if (flags?.crit) tag(pushEvent, side, "necromancer", "soul_crack");
    },
  };
  return { name: "Necromancer", hooks };
}

function revenantPack(): ClassPassivePack {
  const hooks: PassiveHooks = {
    onRoundStart({ side, pushEvent }) {
      tag(pushEvent, side, "revenant", "steady_aim");
      log("Revenant onRoundStart", side);
    },
    onModifyOutgoing({ side, pushEvent }) {
      tag(pushEvent, side, "revenant", "cursed_shot_trail");
    },
  };
  return { name: "Revenant", hooks };
}

function exorcistPack(): ClassPassivePack {
  const hooks: PassiveHooks = {
    onRoundStart({ side, pushEvent }) {
      tag(pushEvent, side, "exorcist", "sacred_aura");
      log("Exorcist onRoundStart", side);
    },
    onModifyIncoming({ side, pushEvent, flags }) {
      if (flags.blocked) tag(pushEvent, side, "exorcist", "holy_guard");
    },
  };
  return { name: "Exorcist", hooks };
}

/* ────────────────────────────────────────────────────────────────────
 * Builder
 * ──────────────────────────────────────────────────────────────────── */

/**
 * Devuelve el pack de pasivas “suaves” por clase.
 * No modifica daño por ahora (solo emite tags para UI/logs).
 * Si el nombre no coincide con tus clases del seed, retorna un pack vacío.
 */
export function buildClassPassivePack(className?: string | null): ClassPassivePack {
  switch (classKey(className)) {
    case "vampire":
      return vampirePack();
    case "werewolf":
      return werewolfPack();
    case "necromancer":
      return necromancerPack();
    case "revenant":
      return revenantPack();
    case "exorcist":
      return exorcistPack();
    default:
      return { name: String(className || "Unknown"), hooks: null };
  }
}
