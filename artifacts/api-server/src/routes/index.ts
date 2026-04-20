import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import clientsRouter from "./clients";
import ordersRouter from "./orders";
import commissionsRouter from "./commissions";
import dashboardRouter from "./dashboard";
import settingsRouter from "./settings";
import packagesRouter from "./packages";
import commissionRulesRouter from "./commission-rules";
import paymentBatchesRouter from "./payment-batches";
import auditLogsRouter from "./audit-logs";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/clients", clientsRouter);
router.use("/orders", ordersRouter);
router.use("/commissions", commissionsRouter);
router.use("/dashboard", dashboardRouter);
router.use("/settings", settingsRouter);
router.use("/packages", packagesRouter);
router.use("/commission-rules", commissionRulesRouter);
router.use("/payment-batches", paymentBatchesRouter);
router.use("/audit-logs", auditLogsRouter);

export default router;
