import mongoose from "mongoose";
import dotenv from "dotenv";
import { CharacterClass } from "../models/CharacterClass";

dotenv.config();

//npx ts-node src/scripts/seedCharacterClasses.ts para cargar las clases iniciales

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI!);

    await CharacterClass.deleteMany();

    const classes = [
      {
        name: "Guerrero",
        description: "Un guerrero cuya ira resuena como acero en la niebla. Guardián del reino caído.",
        iconName: "Shield",
        imageMainClassUrl: "/assets/classes/guerrero/guerrero_class_1.png",
        passiveDefault: {
          name: "Espíritu de Guardia",
          description: "Reduce el daño recibido mientras el escudo está activo.",
        },
        subclasses: [
          {
            name: "Paladín Caído (Escudo)",
            iconName: "Shield",
            imageSubclassUrl: "",
            passives: [
              {
                name: "Defensa Absoluta",
                description: "Incrementa 15% la defensa física cuando está por debajo del 30% de vida.",
              },
              {
                name: "Resistencia Inquebrantable",
                description: "Reduce 15% el daño crítico recibido.",
              },
            ],
          },
          {
            name: "Verdugo de Hierro (Espada Dos Manos)",
            iconName: "Sword",
            imageSubclassUrl: "",
            passives: [
              {
                name: "Ira Desatada",
                description: "+15% daño físico con espada de dos manos.",
              },
              {
                name: "Carga Brutal",
                description: "Primer golpe tras moverse hace 15% más de daño físico.",
              },
            ],
          },
        ],
      },
      {
        name: "Mago",
        description: "Un sabio anciano que canaliza el fuego ancestral y la escarcha del abismo.",
        iconName: "Flame",
        imageMainClassUrl: "/assets/classes/mago/mago_class_1.png",
        passiveDefault: {
          name: "Llama Interna",
          description: "Aumenta el daño elemental con el tiempo.",
        },
        subclasses: [
          {
            name: "Hechicero de Fuego",
            iconName: "Flame",
            imageSubclassUrl: "",
            passives: [
              {
                name: "Ignición",
                description: "Provoca explosión al acumular quemaduras.",
              },
              {
                name: "Chispa Divina",
                description: "Chance de lanzar una llamarada extra.",
              },
            ],
          },
          {
            name: "Sabio del Hielo",
            iconName: "Snowflake",
            imageSubclassUrl: "",
            passives: [
              {
                name: "Aliento Glacial",
                description: "Chance de congelar enemigos.",
              },
              {
                name: "Reacción Glacial",
                description: "Activa un escudo de hielo tras recibir un crítico.",
              },
            ],
          },
        ],
      },
      {
        name: "Asesino",
        description: "Sombra sigilosa entre ruinas olvidadas. Su hoja envenenada susurra muerte.",
        iconName: "Ghost",
        imageMainClassUrl: "/assets/classes/asesino/asesino_class_1.png",
        passiveDefault: {
          name: "Sombra Letal",
          description: "30% de incremento en daño crítico.",
        },
        subclasses: [
          {
            name: "Acechador Nocturno",
            iconName: "Ghost",
            imageSubclassUrl: "",
            passives: [
              {
                name: "Veneno Letal",
                description: "Aplica veneno que hace daño con el tiempo.",
              },
              {
                name: "Toxina Paralizante",
                description: "Enemigos envenenados pueden quedar inmóviles brevemente.",
              },
            ],
          },
          {
            name: "Danzarín de Sombras",
            iconName: "Zap",
            imageSubclassUrl: "",
            passives: [
              {
                name: "Reflejo Fantasmal",
                description: "Probabilidad de evadir ataques.",
              },
              {
                name: "Contraataque Sombrío",
                description: "Tras evadir, el próximo ataque es crítico garantizado.",
              },
            ],
          },
        ],
      },
      {
        name: "Arquero",
        description: "Cazador de la penumbra. Su arco canta desde los árboles muertos.",
        iconName: "GiBowArrow",
        imageMainClassUrl: "/assets/classes/arquero/arquero_class_1.png",
        passiveDefault: {
          name: "Ojo del Águila",
          description: "Aumenta el daño con el tiempo.",
        },
        subclasses: [
          {
            name: "Tirador de Precisión",
            iconName: "Target",
            imageSubclassUrl: "",
            passives: [
              {
                name: "Pulso Preciso",
                description: "Disparo cargado que inflige daño crítico garantizado.",
              },
              {
                name: "Reflejo Ágil",
                description: "Aumenta velocidad de ataque tras esquivar.",
              },
            ],
          },
          {
            name: "Sanguinario del Linde",
            iconName: "FaSpider",
            imageSubclassUrl: "",
            passives: [
              {
                name: "Olor a sangre",
                description: "Inflige más daño a enemigos con menos del 50% de vida.",
              },
              {
                name: "Tiro Venenoso",
                description: "Flecha que inflige daño de veneno con el tiempo.",
              },
            ],
          },
        ],
      },
    ];

    await CharacterClass.insertMany(classes);
    console.log("\u2714\ufe0f Clases insertadas correctamente");
    process.exit(0);
  } catch (err) {
    console.error("Error insertando clases:", err);
    process.exit(1);
  }
};

seed();
