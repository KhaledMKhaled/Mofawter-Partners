import { db, settingsTable, commissionRulesTable, SETTING_SALES_PCT, SETTING_DIST_PCT } from "@workspace/db";
import type { CommissionType, CommissionBeneficiaryType } from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";

export const DEFAULT_SALES_PCT = 10;
export const DEFAULT_DISTRIBUTOR_PCT = 5;

/**
 * The configurable order status that triggers commission generation.
 * Stored in settings table as 'commission_trigger_status'.
 * Default = 'COLLECTED' per BRD §15.4.
 */
export const SETTING_COMMISSION_TRIGGER = "commission_trigger_status";
export const DEFAULT_COMMISSION_TRIGGER = "COLLECTED";

export async function getCommissionRates(): Promise<{
  salesPct: number;
  distributorPct: number;
  commissionTriggerStatus: string;
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
    commissionTriggerStatus: map.get(SETTING_COMMISSION_TRIGGER) ?? DEFAULT_COMMISSION_TRIGGER,
  };
}

export async function setCommissionRate(
  key: string,
  value: number | string,
): Promise<void> {
  const strValue = String(value);
  const existing = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, key));
  if (existing.length === 0) {
    await db.insert(settingsTable).values({ key, value: strValue });
  } else {
    await db
      .update(settingsTable)
      .set({ value: strValue, updatedAt: new Date() })
      .where(eq(settingsTable.key, key));
  }
}

/**
 * Evaluate the commission percentage for a specific beneficiary + event type + package.
 * Priority:
 *   1. Rule matching packageId + eventType + beneficiaryType (most specific)
 *   2. Rule matching eventType + beneficiaryType with packageId IS NULL (general event rule)
 *   3. Global settings percentage (fallback)
 *
 * Returns { percentage, ruleId } — ruleId is null when falling back to global settings.
 */
export async function evaluateCommissionRule(params: {
  packageId: number | null;
  eventType: CommissionType;
  beneficiaryType: CommissionBeneficiaryType;
  globalFallbackPct: number;
}): Promise<{ percentage: number; ruleId: number | null }> {
  const { packageId, eventType, beneficiaryType, globalFallbackPct } = params;

  // Try package-specific rule first
  if (packageId != null) {
    const [pkgRule] = await db
      .select()
      .from(commissionRulesTable)
      .where(
        and(
          eq(commissionRulesTable.packageId, packageId),
          eq(commissionRulesTable.eventType, eventType),
          eq(commissionRulesTable.beneficiaryType, beneficiaryType),
          eq(commissionRulesTable.isActive, true),
        ),
      )
      .limit(1);

    if (pkgRule) {
      return { percentage: Number(pkgRule.percentage), ruleId: pkgRule.id };
    }
  }

  // Try general event-type rule (no package constraint)
  const [generalRule] = await db
    .select()
    .from(commissionRulesTable)
    .where(
      and(
        isNull(commissionRulesTable.packageId),
        eq(commissionRulesTable.eventType, eventType),
        eq(commissionRulesTable.beneficiaryType, beneficiaryType),
        eq(commissionRulesTable.isActive, true),
      ),
    )
    .limit(1);

  if (generalRule) {
    return { percentage: Number(generalRule.percentage), ruleId: generalRule.id };
  }

  // Fall back to global settings
  return { percentage: globalFallbackPct, ruleId: null };
}
