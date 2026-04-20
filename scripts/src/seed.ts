import bcrypt from "bcryptjs";
import {
  db,
  pool,
  usersTable,
  clientsTable,
  ordersTable,
  commissionsTable,
  settingsTable,
  packagesTable,
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
  await db.delete(packagesTable);

  console.log("Seeding default commission rates...");
  await db.insert(settingsTable).values([
    { key: SETTING_SALES_PCT, value: "10" },
    { key: SETTING_DIST_PCT, value: "5" },
  ]);

  console.log("Seeding packages...");
  const packages = await db.insert(packagesTable).values([
    { name: "Starter Package", price: "5000.00", vatPct: "14" },
    { name: "Pro Package", price: "12000.00", vatPct: "14" },
    { name: "Enterprise Package", price: "45000.00", vatPct: "14" },
  ]).returning();

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
        taxCardNumber: "100-200-300",
        taxCardName: "Acme Industries LLc",
        issuingAuthority: "Cairo",
        commercialRegistryNumber: "12345",
        businessType: "Software",
        email: "contact@acme.test",
        phone1: "01000000001",
        nationalId: "29001010100000",
        address: "123 Tech St, Cairo",
        assignedSalesId: sales.id,
        assignedDistributorId: distributor.id,
        ownershipStartDate: start,
        ownershipEndDate: end,
      },
      {
        name: "Globex Corp",
        taxCardNumber: "200-300-400",
        taxCardName: "Globex Corporation",
        issuingAuthority: "Giza",
        commercialRegistryNumber: "67890",
        businessType: "Import Export",
        email: "info@globex.test",
        phone1: "01000000002",
        nationalId: "29001010100001",
        address: "456 Trade Ave, Giza",
        assignedSalesId: sales.id,
        assignedDistributorId: distributor.id,
        ownershipStartDate: start,
        ownershipEndDate: end,
      },
      {
        name: "Initech Holdings",
        taxCardNumber: "300-400-500",
        taxCardName: "Initech LLC",
        issuingAuthority: "Alex",
        commercialRegistryNumber: "54321",
        businessType: "Consulting",
        email: "hello@initech.test",
        phone1: "01000000003",
        nationalId: "29001010100002",
        address: "789 Corp Blvd, Alex",
        assignedSalesId: sales.id,
        assignedDistributorId: distributor.id,
        ownershipStartDate: start,
        ownershipEndDate: end,
      },
    ])
    .returning();

  console.log("Creating orders...");
  
  const extractAmount = (pkg: any) => Number(pkg.price);
  const extractVatString = (pkg: any) => (Number(pkg.price) * (Number(pkg.vatPct) / 100)).toFixed(2);

  const orders = await db
    .insert(ordersTable)
    .values([
      {
        clientId: clients[0].id,
        packageId: packages[1].id,
        orderName: packages[1].name,
        amount: packages[1].price,
        vatAmount: extractVatString(packages[1]),
        receiptNumber: "R-1001",
        isFullyCollected: true,
        status: "COMPLETED",
      },
      {
        clientId: clients[0].id,
        packageId: packages[0].id,
        orderName: packages[0].name,
        amount: packages[0].price,
        vatAmount: extractVatString(packages[0]),
        receiptNumber: "R-1002",
        status: "PENDING",
      },
      {
        clientId: clients[1].id,
        packageId: packages[2].id,
        orderName: packages[2].name,
        amount: packages[2].price,
        vatAmount: extractVatString(packages[2]),
        receiptNumber: "R-1003",
        isFullyCollected: true,
        status: "COMPLETED",
      },
      {
        clientId: clients[2].id,
        packageId: packages[0].id,
        orderName: packages[0].name,
        amount: packages[0].price,
        vatAmount: extractVatString(packages[0]),
        receiptNumber: "R-1004",
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
  console.log(`Created ${packages.length} packages, ${clients.length} clients, ${orders.length} orders, ${commissionRows.length} commissions.`);

  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
