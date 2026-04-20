import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isOrderInOwnershipWindow,
  planCommissionUpdate,
} from "../src/lib/ownership.ts";

const start = new Date("2025-01-01T00:00:00.000Z");
const end = new Date("2030-01-01T00:00:00.000Z");

const baseInput = {
  amount: 1000,
  ownershipStartDate: start,
  ownershipEndDate: end,
  ownershipStatus: "ACTIVE",
  assignedSalesId: 42,
  assignedDistributorId: 7,
  clientId: 1,
  isAdminOverride: false,
  orderType: "NEW_SUBSCRIPTION" as const,
  packageId: null,
  commissionTriggerStatus: "COLLECTED",
  salesRule: { percentage: 10, ruleId: null },
  distRule: { percentage: 5, ruleId: null },
};

describe("isOrderInOwnershipWindow (5-year ownership rule)", () => {
  it("returns true for an order placed comfortably inside the window", () => {
    assert.equal(
      isOrderInOwnershipWindow(new Date("2027-06-15T12:00:00.000Z"), start, end, "ACTIVE"),
      true,
    );
  });

  it("returns true for an order placed exactly on the start date", () => {
    assert.equal(isOrderInOwnershipWindow(start, start, end, "ACTIVE"), true);
  });

  it("returns true for an order placed exactly on the end date", () => {
    assert.equal(isOrderInOwnershipWindow(end, start, end, "ACTIVE"), true);
  });

  it("returns false for an order placed one day before the window starts", () => {
    const oneDayBefore = new Date(start.getTime() - 24 * 60 * 60 * 1000);
    assert.equal(isOrderInOwnershipWindow(oneDayBefore, start, end, "ACTIVE"), false);
  });

  it("returns false for an order placed one day past the end date", () => {
    const oneDayAfter = new Date(end.getTime() + 24 * 60 * 60 * 1000);
    assert.equal(isOrderInOwnershipWindow(oneDayAfter, start, end, "ACTIVE"), false);
  });

  it("returns false for an order placed one millisecond past the end date", () => {
    const justAfter = new Date(end.getTime() + 1);
    assert.equal(isOrderInOwnershipWindow(justAfter, start, end, "ACTIVE"), false);
  });
});

describe("planCommissionUpdate — completing an order", () => {
  it("creates SALES + DISTRIBUTOR commissions when completed inside the window", () => {
    const plan = planCommissionUpdate({
      ...baseInput,
      prevStatus: "NEW",
      newStatus: "COLLECTED",
      orderDate: new Date("2027-06-15T12:00:00.000Z"),
    });
    assert.equal(plan.kind, "create");
    if (plan.kind !== "create") return;
    assert.deepEqual(plan.commissions, [
      { userId: 42, amount: 100, roleType: "SALES" },
      { userId: 7, amount: 50, roleType: "DISTRIBUTOR" },
    ]);
  });

  it("creates commissions when completed exactly on the end date (boundary)", () => {
    const plan = planCommissionUpdate({
      ...baseInput,
      prevStatus: "NEW",
      newStatus: "COLLECTED",
      orderDate: end,
    });
    assert.equal(plan.kind, "create");
    if (plan.kind !== "create") return;
    assert.equal(plan.commissions.length, 2);
  });

  it("creates commissions when completed exactly on the start date (boundary)", () => {
    const plan = planCommissionUpdate({
      ...baseInput,
      prevStatus: "NEW",
      newStatus: "COLLECTED",
      orderDate: start,
    });
    assert.equal(plan.kind, "create");
  });

  it("does NOT create commissions when the order date is one day past the end", () => {
    const plan = planCommissionUpdate({
      ...baseInput,
      prevStatus: "NEW",
      newStatus: "COLLECTED",
      orderDate: new Date(end.getTime() + 24 * 60 * 60 * 1000),
    });
    assert.equal(plan.kind, "noop");
  });

  it("does NOT create commissions when the order date is one day before the start", () => {
    const plan = planCommissionUpdate({
      ...baseInput,
      prevStatus: "NEW",
      newStatus: "COLLECTED",
      orderDate: new Date(start.getTime() - 24 * 60 * 60 * 1000),
    });
    assert.equal(plan.kind, "noop");
  });

  it("does NOT re-create commissions when an already-completed order is re-completed", () => {
    const plan = planCommissionUpdate({
      ...baseInput,
      prevStatus: "COLLECTED",
      newStatus: "COLLECTED",
      orderDate: new Date("2027-06-15T12:00:00.000Z"),
    });
    assert.equal(plan.kind, "noop");
  });

  it("rounds commission amounts to two decimal places", () => {
    const plan = planCommissionUpdate({
      ...baseInput,
      amount: 333.33,
      prevStatus: "NEW",
      newStatus: "COLLECTED",
      orderDate: new Date("2027-06-15T12:00:00.000Z"),
    });
    assert.equal(plan.kind, "create");
    if (plan.kind !== "create") return;
    assert.equal(plan.commissions[0]!.amount, 33.33);
    assert.equal(plan.commissions[1]!.amount, 16.67);
  });
});

describe("planCommissionUpdate — reverting an order", () => {
  it("returns delete plan when reverting a COMPLETED order to PENDING", () => {
    const plan = planCommissionUpdate({
      ...baseInput,
      prevStatus: "COLLECTED",
      newStatus: "NEW",
      orderDate: new Date("2027-06-15T12:00:00.000Z"),
    });
    assert.equal(plan.kind, "delete");
  });

  it("returns delete plan even when the order date sits outside the window", () => {
    // A completed out-of-window order should not have commissions to begin with,
    // but reverting should still issue a delete to keep state consistent and idempotent.
    const plan = planCommissionUpdate({
      ...baseInput,
      prevStatus: "COLLECTED",
      newStatus: "NEW",
      orderDate: new Date(end.getTime() + 24 * 60 * 60 * 1000),
    });
    assert.equal(plan.kind, "delete");
  });

  it("does nothing when a PENDING order is set back to PENDING", () => {
    const plan = planCommissionUpdate({
      ...baseInput,
      prevStatus: "NEW",
      newStatus: "NEW",
      orderDate: new Date("2027-06-15T12:00:00.000Z"),
    });
    assert.equal(plan.kind, "noop");
  });
});
