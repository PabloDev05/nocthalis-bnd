import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI as string;
    if (!uri) {
      throw new Error("Falta la variable de entorno MONGO_URI");
    }

    await mongoose.connect(uri);
    console.log(`Conectado a MongoDB (${process.env.NODE_ENV || "desconocido"})`);
  } catch (error) {
    console.error("Error al conectar a MongoDB:", error);
    process.exit(1);
  }
};

export const disconnectDB = async () => {
  await mongoose.disconnect();
  console.log("Desconectado de MongoDB");
};
