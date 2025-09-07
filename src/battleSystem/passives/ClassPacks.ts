// Paquetes de pasivas por CLASE (Vampire, Werewolf, Necromancer, Revenant, Exorcist)
// ⚠️ Solo emiten tags para UI/VFX/logs. NO modifican números ni estados del combate.
// La matemática (daño, procs, estados, cooldowns) vive en el CombatManager.

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

/** Helper: emite un tag namespaced para UI/VFX */
function tag(pushEvent: (ev: string) => void, side: SideKey, cls: string, name: string) {
  pushEvent(`${side}:class:${cls}:${name}`);
}

/* ───────────────────────── Packs ───────────────────────── */

function vampirePack(): ClassPassivePack {
  const hooks: PassiveHooks = {
    onRoundStart({ side, pushEvent }) {
      tag(pushEvent, side, "vampire", "round_start_aura"); // aura carmesí ligera
      log("Vampire onRoundStart", side);
    },
    onModifyOutgoing({ side, pushEvent, flags }) {
      // Trail base para estocadas finas
      tag(pushEvent, side, "vampire", "rapier_trail");
      // Brillo sanguíneo en críticos
      if (flags?.crit) tag(pushEvent, side, "vampire", "crit_flourish");
    },
    onModifyIncoming({ side, pushEvent, flags }) {
      if (flags?.blocked) tag(pushEvent, side, "vampire", "graceful_parry");
    },
    onPassiveProc({ side, pushEvent, name, result }) {
      tag(pushEvent, side, "vampire", `passive:${name}:${result ?? "activated"}`);
    },
    onUltimateCast({ side, pushEvent, name }) {
      tag(pushEvent, side, "vampire", `ultimate:${name}`);
      tag(pushEvent, side, "vampire", "screen_tint_crimson");
    },
  };
  return { name: "Vampire", hooks };
}

function werewolfPack(): ClassPassivePack {
  const hooks: PassiveHooks = {
    onRoundStart({ side, pushEvent }) {
      tag(pushEvent, side, "werewolf", "frenzy_tick"); // marca de frenesí
      log("Werewolf onRoundStart", side);
    },
    onModifyOutgoing({ side, pushEvent }) {
      tag(pushEvent, side, "werewolf", "claw_trace");
      tag(pushEvent, side, "werewolf", "snarl_overlay");
    },
    onPassiveProc({ side, pushEvent, name }) {
      tag(pushEvent, side, "werewolf", `passive:${name}`);
      tag(pushEvent, side, "werewolf", "pulse_veins");
    },
    onUltimateCast({ side, pushEvent, name }) {
      tag(pushEvent, side, "werewolf", `ultimate:${name}`);
      tag(pushEvent, side, "werewolf", "camera_shake_light");
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
      tag(pushEvent, side, "necromancer", "shadow_trail");
      if (flags?.crit) tag(pushEvent, side, "necromancer", "soul_crack");
    },
    onPassiveProc({ side, pushEvent, name, result }) {
      tag(pushEvent, side, "necromancer", `passive:${name}:${result ?? "activated"}`);
      tag(pushEvent, side, "necromancer", "glyph_pop");
    },
    onUltimateCast({ side, pushEvent, name }) {
      tag(pushEvent, side, "necromancer", `ultimate:${name}`);
      tag(pushEvent, side, "necromancer", "dark_mist_burst");
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
      tag(pushEvent, side, "revenant", "muzzle_flash_ghost");
    },
    onPassiveProc({ side, pushEvent, name }) {
      tag(pushEvent, side, "revenant", `passive:${name}`);
    },
    onUltimateCast({ side, pushEvent, name }) {
      tag(pushEvent, side, "revenant", `ultimate:${name}`);
      tag(pushEvent, side, "revenant", "lens_distort_short");
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
      if (flags?.blocked) tag(pushEvent, side, "exorcist", "holy_guard");
    },
    onPassiveProc({ side, pushEvent, name }) {
      tag(pushEvent, side, "exorcist", `passive:${name}`);
      tag(pushEvent, side, "exorcist", "rune_glow");
    },
    onUltimateCast({ side, pushEvent, name }) {
      tag(pushEvent, side, "exorcist", `ultimate:${name}`);
      tag(pushEvent, side, "exorcist", "pillar_of_light");
    },
  };
  return { name: "Exorcist", hooks };
}

/* ───────────────────────── Builder ───────────────────────── */

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
