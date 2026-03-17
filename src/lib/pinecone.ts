import { Pinecone } from "@pinecone-database/pinecone";

export const getPineconeClient = () => {
  const apiKey = process.env.PINECONE_API_KEY;
  if (!apiKey) {
    throw new Error("PINECONE_API_KEY is not defined in environment variables.");
  }
  return new Pinecone({ apiKey });
};
