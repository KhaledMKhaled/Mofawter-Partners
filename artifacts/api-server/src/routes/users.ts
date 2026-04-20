import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { hashPassword, toUserDto, type AuthRole } from "../lib/auth";
import { requireAuth, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

router.use(requireAuth);

router.get("/", async (req, res) => {
  const role = (req.query.role as AuthRole | undefined) ?? undefined;
  const distributorIdQ = req.query.distributorId
    ? Number(req.query.distributorId)
    : undefined;
  const conditions = [];
  if (role) conditions.push(eq(usersTable.role, role));
  if (distributorIdQ !== undefined && !Number.isNaN(distributorIdQ)) {
    conditions.push(eq(usersTable.distributorId, distributorIdQ));
  }
  // Distributors can only see their own team
  if (req.auth!.role === "DISTRIBUTOR") {
    conditions.push(eq(usersTable.distributorId, req.auth!.sub));
  } else if (req.auth!.role === "SALES") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const rows = await (conditions.length
    ? db
        .select()
        .from(usersTable)
        .where(conditions.length === 1 ? conditions[0] : and(...conditions))
    : db.select().from(usersTable));
  res.json(rows.map(toUserDto));
});

router.post(
  "/",
  requireRole("ADMIN", "DISTRIBUTOR"),
  async (req, res) => {
    const { name, email, password, role, distributorId } = req.body ?? {};
    if (!name || !email || !password || !role) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }
    if (!["ADMIN", "DISTRIBUTOR", "SALES"].includes(role)) {
      res.status(400).json({ error: "Invalid role" });
      return;
    }
    // Distributors can only create SALES under themselves
    let resolvedDistributorId: number | null = distributorId ?? null;
    if (req.auth!.role === "DISTRIBUTOR") {
      if (role !== "SALES") {
        res
          .status(403)
          .json({ error: "Distributors can only create Sales agents" });
        return;
      }
      resolvedDistributorId = req.auth!.sub;
    } else {
      // Admin path
      if (role === "SALES" && !resolvedDistributorId) {
        res
          .status(400)
          .json({ error: "Sales agents must be assigned to a distributor" });
        return;
      }
      if (role !== "SALES") resolvedDistributorId = null;
    }
    const passwordHash = await hashPassword(password);
    try {
      const [created] = await db
        .insert(usersTable)
        .values({
          name,
          email: String(email).toLowerCase(),
          passwordHash,
          role,
          distributorId: resolvedDistributorId,
        })
        .returning();
      res.status(201).json(toUserDto(created));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not create user";
      res.status(400).json({ error: msg });
    }
  },
);

export default router;
