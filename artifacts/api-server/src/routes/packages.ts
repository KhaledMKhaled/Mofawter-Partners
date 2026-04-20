import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, packagesTable } from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const packages = await db.select().from(packagesTable);
    res.json(packages);
    return;
  } catch (err) {
    next(err);
  }
});

router.post("/", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const { name, price, vatPct } = req.body;
    if (!name || price === undefined || vatPct === undefined) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const [newPkg] = await db.insert(packagesTable).values({
      name,
      price: price.toString(),
      vatPct: vatPct.toString(),
    }).returning();

    res.status(201).json(newPkg);
    return;
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { name, price, vatPct, isActive } = req.body;
    
    // Build update object
    const values: Record<string, any> = {};
    if (name !== undefined) values.name = name;
    if (price !== undefined) values.price = price.toString();
    if (vatPct !== undefined) values.vatPct = vatPct.toString();
    if (isActive !== undefined) values.isActive = isActive;

    if (Object.keys(values).length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }

    const [updated] = await db.update(packagesTable)
      .set(values)
      .where(eq(packagesTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Package not found" });
      return;
    }

    res.json(updated);
    return;
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [deleted] = await db.delete(packagesTable).where(eq(packagesTable.id, id)).returning();
    
    if (!deleted) {
      res.status(404).json({ error: "Package not found" });
      return;
    }
    
    res.status(204).send();
    return;
  } catch (err) {
    next(err);
  }
});

export default router;
