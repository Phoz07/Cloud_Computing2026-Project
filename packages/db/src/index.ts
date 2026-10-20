import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export const db = drizzle(postgres(process.env.DATABASE_URL!), { schema });
export type DB = typeof db;

export * from "./schema";

export { eq, ne, and, or, not, inArray, isNull, desc, asc, sql, count } from "drizzle-orm";