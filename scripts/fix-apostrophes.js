/**
 * Script to fix HTML-encoded apostrophes in database
 * Replaces &#x27; with ' in customer names and product names
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixApostrophes() {
  try {
    console.log('🔍 Searching for records with escaped apostrophes...\n');

    // Fix customer names
    const customers = await prisma.customer.findMany({
      where: {
        OR: [
          { customerName: { contains: '&#x27;' } },
          { businessName: { contains: '&#x27;' } },
        ],
      },
    });

    console.log(`Found ${customers.length} customers with escaped apostrophes`);

    let customerCount = 0;
    for (const customer of customers) {
      const updates = {};
      if (customer.customerName.includes('&#x27;')) {
        updates.customerName = customer.customerName.replace(/&#x27;/g, "'");
      }
      if (customer.businessName?.includes('&#x27;')) {
        updates.businessName = customer.businessName.replace(/&#x27;/g, "'");
      }

      if (Object.keys(updates).length > 0) {
        await prisma.customer.update({
          where: { id: customer.id },
          data: updates,
        });
        customerCount++;
        console.log(
          `  ✅ Fixed: ${updates.customerName || customer.customerName}`
        );
      }
    }

    // Fix product names
    const products = await prisma.product.findMany({
      where: {
        OR: [
          { code: { contains: '&#x27;' } },
          { name: { contains: '&#x27;' } },
        ],
      },
    });

    console.log(`\nFound ${products.length} products with escaped apostrophes`);

    let productCount = 0;
    for (const product of products) {
      const updates = {};
      if (product.code?.includes('&#x27;')) {
        updates.code = product.code.replace(/&#x27;/g, "'");
      }
      if (product.name?.includes('&#x27;')) {
        updates.name = product.name.replace(/&#x27;/g, "'");
      }

      if (Object.keys(updates).length > 0) {
        await prisma.product.update({
          where: { id: product.id },
          data: updates,
        });
        productCount++;
        console.log(`  ✅ Fixed: ${updates.name || product.name}`);
      }
    }

    console.log('\n✨ Summary:');
    console.log(`   Customers fixed: ${customerCount}`);
    console.log(`   Products fixed: ${productCount}`);
    console.log('\n✅ Done! Apostrophes have been restored.');
  } catch (error) {
    console.error('❌ Error fixing apostrophes:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fixApostrophes();
