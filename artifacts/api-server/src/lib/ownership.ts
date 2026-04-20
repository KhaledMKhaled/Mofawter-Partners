import type { OrderStatus } from "@workspace/db";
import { ORDER_STATUS_TRANSITIONS } from "@workspace/db";

export type CommissionDraft = {
  userId: number;
  clientId: number;
  baseAmount: number;
  amount: number;
  roleType: "SALES" | "DISTRIBUTOR";
  commissionType: "NEW_SUBSCRIPTION" | "RENEWAL" | "UPGRADE" | "ADD_ON";
  appliedRuleId: number | null;
};

export type CommissionPlan =
  | { kind: "noop" }
  | { kind: "create"; commissions: CommissionDraft[] }
  | { kind: "delete" };

export type PlanInput = {
  prevStatus: OrderStatus;
  newStatus: OrderStatus;
  isAdminOverride: boolean;
  orderDate: Date;
  orderType: "NEW_SUBSCRIPTION" | "RENEWAL" | "UPGRADE" | "ADD_ON";
  packageId: number | null;
  amount: number;
  ownershipStartDate: Date;
  ownershipEndDate: Date;
  ownershipStatus: string;
  assignedSalesId: number;
  assignedDistributorId: number;
  clientId: number;
  commissionTriggerStatus: string;
  salesRule: { percentage: number; ruleId: number | null };
  distRule: { percentage: number; ruleId: number | null };
};

export function isOrderInOwnershipWindow(
  orderDate: Date,
  ownershipStartDate: Date,
  ownershipEndDate: Date,
  ownershipStatus: string,
): boolean {
  if (ownershipStatus !== "ACTIVE") return false;
  return (
    orderDate.getTime() >= ownershipStartDate.getTime() &&
    orderDate.getTime() <= ownershipEndDate.getTime()
  );
}

/**
 * Validates a status transition.
 * Normal users must follow ORDER_STATUS_TRANSITIONS.
 * Admin can override, but this must be flagged as isAdminOverride=true.
 */
export function validateStatusTransition(
  from: OrderStatus,
  to: OrderStatus,
  isAdmin: boolean,
): { valid: boolean; isOverride: boolean; reason?: string } {
  const allowed = ORDER_STATUS_TRANSITIONS[from] ?? [];

  if (allowed.includes(to)) {
    return { valid: true, isOverride: false };
  }

  if (isAdmin) {
    // Admin can make any transition that isn't from a terminal state to itself
    if (from === to) {
      return { valid: false, isOverride: false, reason: "Status is already " + from };
    }
    return {
      valid: true,
      isOverride: true,
      reason: `Admin override: ${from} → ${to} is not a standard transition`,
    };
  }

  return {
    valid: false,
    isOverride: false,
    reason: `Transition from ${from} to ${to} is not allowed`,
  };
}

/**
 * Plans what commission action to take when an order changes status.
 * Commission generation is triggered only when the order reaches the configured trigger status.
 * Reverting from trigger status deletes pending commissions (blocked if any are already PAID).
 */
export function planCommissionUpdate(input: PlanInput): CommissionPlan {
  const {
    prevStatus,
    newStatus,
    orderDate,
    orderType,
    amount,
    ownershipStartDate,
    ownershipEndDate,
    ownershipStatus,
    assignedSalesId,
    assignedDistributorId,
    clientId,
    commissionTriggerStatus,
    salesRule,
    distRule,
  } = input;

  const triggerStatus = commissionTriggerStatus as OrderStatus;

  // Moving INTO trigger status → create commissions
  if (newStatus === triggerStatus && prevStatus !== triggerStatus) {
    if (!isOrderInOwnershipWindow(orderDate, ownershipStartDate, ownershipEndDate, ownershipStatus)) {
      return { kind: "noop" };
    }

    const salesAmount = +(amount * (salesRule.percentage / 100)).toFixed(2);
    const distAmount = +(amount * (distRule.percentage / 100)).toFixed(2);

    return {
      kind: "create",
      commissions: [
        {
          userId: assignedSalesId,
          clientId,
          baseAmount: amount,
          amount: salesAmount,
          roleType: "SALES",
          commissionType: orderType,
          appliedRuleId: salesRule.ruleId,
        },
        {
          userId: assignedDistributorId,
          clientId,
          baseAmount: amount,
          amount: distAmount,
          roleType: "DISTRIBUTOR",
          commissionType: orderType,
          appliedRuleId: distRule.ruleId,
        },
      ],
    };
  }

  // Moving OUT of trigger status (e.g. Admin override reverting to EXECUTED)
  // → delete existing PENDING commissions (caller must block if PAID commissions exist)
  if (prevStatus === triggerStatus && newStatus !== triggerStatus) {
    return { kind: "delete" };
  }

  return { kind: "noop" };
}

/**
 * Calculate the ownership end date from a package's ownershipDurationMonths.
 * Falls back to 60 months (5 years) if not specified.
 */
export function calculateOwnershipEndDate(
  start: Date,
  ownershipDurationMonths: number = 60,
): Date {
  const end = new Date(start);
  end.setMonth(end.getMonth() + ownershipDurationMonths);
  return end;
}
