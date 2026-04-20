export type OrderStatus = "PENDING" | "COMPLETED";

export type CommissionDraft = {
  userId: number;
  amount: number;
  roleType: "SALES" | "DISTRIBUTOR";
};

export type CommissionPlan =
  | { kind: "noop" }
  | { kind: "create"; commissions: CommissionDraft[] }
  | { kind: "delete" };

export type PlanInput = {
  prevStatus: OrderStatus;
  newStatus: OrderStatus;
  orderDate: Date;
  amount: number;
  ownershipStartDate: Date;
  ownershipEndDate: Date;
  assignedSalesId: number;
  assignedDistributorId: number;
  rates: { salesPct: number; distributorPct: number };
};

export function isOrderInOwnershipWindow(
  orderDate: Date,
  ownershipStartDate: Date,
  ownershipEndDate: Date,
): boolean {
  return (
    orderDate.getTime() >= ownershipStartDate.getTime() &&
    orderDate.getTime() <= ownershipEndDate.getTime()
  );
}

export function planCommissionUpdate(input: PlanInput): CommissionPlan {
  const {
    prevStatus,
    newStatus,
    orderDate,
    amount,
    ownershipStartDate,
    ownershipEndDate,
    assignedSalesId,
    assignedDistributorId,
    rates,
  } = input;

  const wasCompleted = prevStatus === "COMPLETED";

  if (newStatus === "COMPLETED" && !wasCompleted) {
    if (!isOrderInOwnershipWindow(orderDate, ownershipStartDate, ownershipEndDate)) {
      return { kind: "noop" };
    }
    const salesAmount = +(amount * (rates.salesPct / 100)).toFixed(2);
    const distAmount = +(amount * (rates.distributorPct / 100)).toFixed(2);
    return {
      kind: "create",
      commissions: [
        { userId: assignedSalesId, amount: salesAmount, roleType: "SALES" },
        {
          userId: assignedDistributorId,
          amount: distAmount,
          roleType: "DISTRIBUTOR",
        },
      ],
    };
  }

  if (newStatus === "PENDING" && wasCompleted) {
    return { kind: "delete" };
  }

  return { kind: "noop" };
}
