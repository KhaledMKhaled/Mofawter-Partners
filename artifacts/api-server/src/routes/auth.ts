import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { LoginBody } from "@workspace/api-zod";
import {
  signToken,
  toUserDto,
  verifyPassword,
} from "../lib/auth";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.post("/login", async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid login payload" });
    return;
  }
  const { email, password } = parsed.data;
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()));
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const token = signToken(user);
  res.json({ token, user: toUserDto(user) });
});

router.get("/me", requireAuth, async (req, res) => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.auth!.sub));
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  res.json(toUserDto(user));
});

export default router;
