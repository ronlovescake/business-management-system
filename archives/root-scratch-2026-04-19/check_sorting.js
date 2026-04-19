const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const records = await prisma.sortingDistribution.findMany({
    where: { deletedAt: null },
    orderBy: { rowNumber: 'asc' },
    take: 10,
  });

  console.log('Total records found:', records.length);

  if (records.length > 0) {
    console.log('\nFirst 3 records:');
    records.slice(0, 3).forEach((r, i) => {
      console.log(`\nRecord ${i + 1}:`);
      console.log(`  Product Code: ${r.productCode}`);
      console.log(`  Row Number: ${r.rowNumber}`);
      console.log(`  Quantity: ${r.quantity} (type: ${typeof r.quantity})`);
      console.log(`  Percentage: ${r.percentage}`);
      console.log(`  Distribution: ${r.distribution}`);
      console.log(`  Checked: ${r.checked}`);
    });
  } else {
    console.log('No records found in the database');
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
