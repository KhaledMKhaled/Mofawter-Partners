import { db } from "@workspace/db";
import {
  settingsTable,
  SETTING_SALES_PCT,
  SETTING_DIST_PCT,
} from "@workspace/db";
import { eq } from "drizzle-orm";

export const DEFAULT_SALES_PCT = 10;
export const DEFAULT_DISTRIBUTOR_PCT = 5;

export async function getCommissionRates(): Promise<{
  salesPct: number;
  distributorPct: number;
}> {
  const rows = await db.select().from(settingsTable);
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    salesPct: map.has(SETTING_SALES_PCT)
      ? Number(map.get(SETTING_SALES_PCT))
      : DEFAULT_SALES_PCT,
    distributorPct: map.has(SETTING_DIST_PCT)
      ? Number(map.get(SETTING_DIST_PCT))
      : DEFAULT_DISTRIBUTOR_PCT,
  };
}

export async function setCommissionRate(
  key: string,
  value: number,
): Promise<void> {
  const existing = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, key));
  if (existing.length === 0) {
    await db.insert(settingsTable).values({ key, value: String(value) });
  } else {
    await db
      .update(settingsTable)
      .set({ value: String(value), updatedAt: new Date() })
      .where(eq(settingsTable.key, key));
  }
}
