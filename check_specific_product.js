const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const productCode = 'Romper With Hanger (RWH-10282025)';
  
  const records = await prisma.sortingDistribution.findMany({
    where: { 
      productCode: productCode,
      deletedAt: null 
    },
    orderBy: { rowNumber: 'asc' },
  });
  
  console.log(`Records for product code "${productCode}":`, records.length);
  
  if (records.length > 0) {
    records.forEach((r, i) => {
      if (r.quantity > 0 || r.checked) {
        console.log(`Row ${r.rowNumber}: quantity=${r.quantity}, checked=${r.checked}`);
      }
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
