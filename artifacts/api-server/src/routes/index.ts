import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import clientsRouter from "./clients";
import ordersRouter from "./orders";
import commissionsRouter from "./commissions";
import dashboardRouter from "./dashboard";
import settingsRouter from "./settings";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/clients", clientsRouter);
router.use("/orders", ordersRouter);
router.use("/commissions", commissionsRouter);
router.use("/dashboard", dashboardRouter);
router.use("/settings", settingsRouter);

export default router;
