import bcrypt from "bcryptjs";
import {
  db,
  pool,
  usersTable,
  clientsTable,
  ordersTable,
  commissionsTable,
  settingsTable,
  SETTING_SALES_PCT,
  SETTING_DIST_PCT,
} from "@workspace/db";

function addFiveYears(start: Date): Date {
  const end = new Date(start);
  end.setFullYear(end.getFullYear() + 5);
  return end;
}

async function seed() {
  console.log("Clearing existing data...");
  await db.delete(commissionsTable);
  await db.delete(ordersTable);
  await db.delete(clientsTable);
  await db.delete(usersTable);
  await db.delete(settingsTable);

  console.log("Seeding default commission rates...");
  await db.insert(settingsTable).values([
    { key: SETTING_SALES_PCT, value: "10" },
    { key: SETTING_DIST_PCT, value: "5" },
  ]);

  console.log("Hashing passwords...");
  const adminHash = await bcrypt.hash("admin123", 10);
  const distHash = await bcrypt.hash("distributor123", 10);
  const salesHash = await bcrypt.hash("sales123", 10);

  console.log("Creating users...");
  const [admin] = await db
    .insert(usersTable)
    .values({
      name: "Avery Admin",
      email: "admin@demo.test",
      passwordHash: adminHash,
      role: "ADMIN",
    })
    .returning();

  const [distributor] = await db
    .insert(usersTable)
    .values({
      name: "Dana Distributor",
      email: "distributor@demo.test",
      passwordHash: distHash,
      role: "DISTRIBUTOR",
    })
    .returning();

  const [sales] = await db
    .insert(usersTable)
    .values({
      name: "Sam Sales",
      email: "sales@demo.test",
      passwordHash: salesHash,
      role: "SALES",
      distributorId: distributor.id,
    })
    .returning();

  console.log("Creating clients...");
  const start = new Date();
  const end = addFiveYears(start);
  const clients = await db
    .insert(clientsTable)
    .values([
      {
        name: "Acme Industries",
        assignedSalesId: sales.id,
        assignedDistributorId: distributor.id,
        ownershipStartDate: start,
        ownershipEndDate: end,
      },
      {
        name: "Globex Corp",
        assignedSalesId: sales.id,
        assignedDistributorId: distributor.id,
        ownershipStartDate: start,
        ownershipEndDate: end,
      },
      {
        name: "Initech Holdings",
        assignedSalesId: sales.id,
        assignedDistributorId: distributor.id,
        ownershipStartDate: start,
        ownershipEndDate: end,
      },
    ])
    .returning();

  console.log("Creating orders...");
  const orders = await db
    .insert(ordersTable)
    .values([
      {
        clientId: clients[0].id,
        orderName: "Q1 Software Subscription",
        amount: "12500.00",
        status: "COMPLETED",
      },
      {
        clientId: clients[0].id,
        orderName: "Onboarding Services",
        amount: "3400.00",
        status: "PENDING",
      },
      {
        clientId: clients[1].id,
        orderName: "Annual License Renewal",
        amount: "48000.00",
        status: "COMPLETED",
      },
      {
        clientId: clients[2].id,
        orderName: "Custom Integration",
        amount: "8750.00",
        status: "PENDING",
      },
    ])
    .returning();

  console.log("Generating commissions for COMPLETED orders...");
  const completed = orders.filter((o) => o.status === "COMPLETED");
  const commissionRows = [] as (typeof commissionsTable.$inferInsert)[];
  for (const o of completed) {
    const amount = Number(o.amount);
    commissionRows.push(
      {
        orderId: o.id,
        userId: sales.id,
        amount: (amount * 0.1).toFixed(2),
        roleType: "SALES",
      },
      {
        orderId: o.id,
        userId: distributor.id,
        amount: (amount * 0.05).toFixed(2),
        roleType: "DISTRIBUTOR",
      },
    );
  }
  if (commissionRows.length > 0) {
    await db.insert(commissionsTable).values(commissionRows);
  }

  console.log("\nSeed complete!");
  console.log("--------------------------------");
  console.log("Login credentials (all passwords are role + 123):");
  console.log(`  ADMIN       -> admin@demo.test       / admin123`);
  console.log(`  DISTRIBUTOR -> distributor@demo.test / distributor123`);
  console.log(`  SALES       -> sales@demo.test       / sales123`);
  console.log("--------------------------------");
  console.log(`Admin id=${admin.id}, Distributor id=${distributor.id}, Sales id=${sales.id}`);
  console.log(`Created ${clients.length} clients, ${orders.length} orders, ${commissionRows.length} commissions.`);

  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
