import { Router, type IRouter } from "express";
import { requireAuth, requireRole } from "../middlewares/auth";
import {
  getCommissionRates,
  setCommissionRate,
} from "../lib/commission";
import {
  SETTING_SALES_PCT,
  SETTING_DIST_PCT,
} from "@workspace/db";

const router: IRouter = Router();
router.use(requireAuth);

router.get("/commission-rates", async (_req, res) => {
  res.json(await getCommissionRates());
});

router.put(
  "/commission-rates",
  requireRole("ADMIN"),
  async (req, res) => {
    const { salesPct, distributorPct } = req.body ?? {};
    const sp = Number(salesPct);
    const dp = Number(distributorPct);
    if (
      Number.isNaN(sp) ||
      Number.isNaN(dp) ||
      sp < 0 ||
      sp > 100 ||
      dp < 0 ||
      dp > 100
    ) {
      res.status(400).json({ error: "Rates must be between 0 and 100" });
      return;
    }
    await setCommissionRate(SETTING_SALES_PCT, sp);
    await setCommissionRate(SETTING_DIST_PCT, dp);
    res.json(await getCommissionRates());
  },
);

export default router;
