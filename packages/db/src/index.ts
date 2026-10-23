import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export const db = drizzle(postgres(process.env.DATABASE_URL!), { schema });
export type DB = typeof db;

export * from "./schema";

export {
  eq, ne, and, or, not, inArray, notInArray, isNull, isNotNull, desc, asc, sql, count, ilike, lt, lte, gt, gte,
  type SQL,
} from "drizzle-orm";