import { expect, test } from "bun:test";

test("DB_POOL_MAX sets the postgres.js pool size", async () => {
  process.env.DATABASE_URL ??= "postgres://postgres:postgres@localhost:5432/db";
  process.env.DB_POOL_MAX = "3";
  const { db } = await import("../src/index");
  expect(db.$client.options.max).toBe(3);
});
