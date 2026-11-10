
import mongoose from "mongoose";
import dns from "node:dns";

dns.setServers(["1.1.1.1", "8.8.8.8"]);

const connectDB = async () => {
  try {
    const connection = await mongoose.connect(
      process.env.MONGODB_URI
    );

    console.log(
      `MongoDB Connected: ${connection.connection.host}`
    );
  } catch (error) {
    console.error("MongoDB Connection Failed:", error.message);
    process.exit(1);
  }
};

export default connectDB;
