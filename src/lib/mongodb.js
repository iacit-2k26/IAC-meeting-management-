import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB || "zoom_meeting_management";

if (!uri) {
  console.warn("MONGODB_URI is not set. MongoDB-dependent features will stay disabled until it is configured.");
}

let client;
let clientPromise;

if (uri) {
  const options = {};

  if (process.env.NODE_ENV === "development") {
    const globalWithMongo = globalThis;

    if (!globalWithMongo.__mongoClientPromise) {
      client = new MongoClient(uri, options);
      globalWithMongo.__mongoClientPromise = client.connect();
    }

    clientPromise = globalWithMongo.__mongoClientPromise;
  } else {
    client = new MongoClient(uri, options);
    clientPromise = client.connect();
  }
}

export async function getDatabase() {
  if (!clientPromise) {
    throw new Error("MongoDB is not configured. Set MONGODB_URI in your environment variables.");
  }

  const connectedClient = await clientPromise;
  return connectedClient.db(databaseName);
}

export default clientPromise;
