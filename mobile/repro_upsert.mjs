import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

const t = sqliteTable("cycle_entries", {
  id: text("id").primaryKey(),
  user_id: text("user_id"),
  created_at: text("created_at"),
  updated_at: text("updated_at"),
  synced_at: text("synced_at"),
});

const { insert } = await import("drizzle-orm/sqlite-core");
const q = insert(t)
  .values({ id: "x", user_id: "u", created_at: "c", updated_at: "u", synced_at: "s" })
  .onConflictDoUpdate({ target: t.id, set: { id: "x", user_id: "u", created_at: "c", updated_at: "u", synced_at: "s" } })
  .toSQL();
console.log("SQL:", q.sql);
console.log("PARAMS:", JSON.stringify(q.params));