// src/scripts/seedEnemies.ts
import mongoose from "mongoose";
import dotenv from "dotenv";
import { Enemy } from "../models/Enemy";

dotenv.config();

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI!);
    await Enemy.deleteMany();

    const enemies = [
      {
        name: "Bandido Rufián",
        level: 5,
        stats: {
          strength: 7,
          dexterity: 7,
          intelligence: 3,
          vitality: 7,
          physicalDefense: 5,
          magicalDefense: 3,
          luck: 3,
          agility: 6,
          endurance: 5,
          wisdom: 2,
        },
        resistances: {
          fire: 2,
          ice: 2,
          lightning: 2,
          poison: 3,
          sleep: 2,
          paralysis: 2,
          confusion: 2,
          fear: 2,
          dark: 2,
          holy: 2,
          stun: 3,
          bleed: 3,
          curse: 2,
          knockback: 2,
          criticalChanceReduction: 2,
          criticalDamageReduction: 2,
        },
        combatStats: {
          maxHP: 95,
          maxMP: 30,
          attackPower: 18,
          magicPower: 5,
          criticalChance: 8,
          criticalDamageBonus: 25,
          attackSpeed: 6,
          evasion: 6,
          blockChance: 3,
          blockValue: 4,
          lifeSteal: 0,
          manaSteal: 0,
          damageReduction: 3,
          movementSpeed: 5,
        },
        imageUrl: "/assets/enemies/bandit.png",
      },
      {
        name: "Cultista Umbrío",
        level: 7,
        stats: {
          strength: 4,
          dexterity: 6,
          intelligence: 9,
          vitality: 6,
          physicalDefense: 3,
          magicalDefense: 7,
          luck: 4,
          agility: 5,
          endurance: 5,
          wisdom: 8,
        },
        resistances: {
          fire: 3,
          ice: 4,
          lightning: 4,
          poison: 2,
          sleep: 3,
          paralysis: 2,
          confusion: 5,
          fear: 5,
          dark: 6,
          holy: 1,
          stun: 3,
          bleed: 2,
          curse: 6,
          knockback: 2,
          criticalChanceReduction: 3,
          criticalDamageReduction: 2,
        },
        combatStats: {
          maxHP: 90,
          maxMP: 100,
          attackPower: 10,
          magicPower: 24,
          criticalChance: 10,
          criticalDamageBonus: 30,
          attackSpeed: 5,
          evasion: 6,
          blockChance: 2,
          blockValue: 3,
          lifeSteal: 0,
          manaSteal: 2,
          damageReduction: 4,
          movementSpeed: 4,
        },
        imageUrl: "/assets/enemies/cultist.png",
      },
      {
        name: "Lobo Hambriento",
        level: 6,
        stats: {
          strength: 8,
          dexterity: 9,
          intelligence: 2,
          vitality: 7,
          physicalDefense: 4,
          magicalDefense: 2,
          luck: 3,
          agility: 9,
          endurance: 5,
          wisdom: 2,
        },
        resistances: {
          fire: 1,
          ice: 3,
          lightning: 2,
          poison: 3,
          sleep: 2,
          paralysis: 3,
          confusion: 1,
          fear: 4,
          dark: 2,
          holy: 2,
          stun: 4,
          bleed: 2,
          curse: 1,
          knockback: 3,
          criticalChanceReduction: 2,
          criticalDamageReduction: 2,
        },
        combatStats: {
          maxHP: 105,
          maxMP: 20,
          attackPower: 20,
          magicPower: 4,
          criticalChance: 12,
          criticalDamageBonus: 30,
          attackSpeed: 8,
          evasion: 10,
          blockChance: 0,
          blockValue: 0,
          lifeSteal: 0,
          manaSteal: 0,
          damageReduction: 2,
          movementSpeed: 7,
        },
        imageUrl: "/assets/enemies/wolf.png",
      },
    ];

    await Enemy.insertMany(enemies);
    console.log("✓ Enemigos insertados correctamente");
    process.exit(0);
  } catch (err) {
    console.error("Error insertando enemigos:", err);
    process.exit(1);
  }
};

seed();
