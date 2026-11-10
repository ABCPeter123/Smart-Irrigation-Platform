import dotenv from "dotenv";

dotenv.config();

const isHosted = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);

export const env = {
  port: Number(process.env.PORT ?? 4000),
  // Health works without a DB. Database queries are guarded in the route.
  databaseConfigured: Boolean(process.env.DATABASE_URL),
  clientOrigin: process.env.CLIENT_ORIGIN ?? "*",
  publicReadOnly: isHosted,
};
