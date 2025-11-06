/* eslint-disable no-console */
/**
 * Database Seed Script
 * Seeds initial admin users for the application
 */

const { PrismaClient } = require('@prisma/client');
const { hash } = require('bcryptjs');

const prisma = new PrismaClient();

async function seedAdminUsers() {
  console.log('🌱 Seeding admin users...');

  // Create SUPER_ADMIN user
  const superAdminPassword = await hash('Admin@2024!', 12);
  const superAdmin = await prisma.user.upsert({
    where: { email: 'czarlie12012010@gmail.com' },
    update: {},
    create: {
      email: 'czarlie12012010@gmail.com',
      name: 'Super Admin',
      password: superAdminPassword,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });
  console.log('✅ Created SUPER_ADMIN:', superAdmin.email);

  // Create ADMIN user
  const adminPassword = await hash('Admin@2024!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'czarinabalnig@gmail.com' },
    update: {},
    create: {
      email: 'czarinabalnig@gmail.com',
      name: 'Admin',
      password: adminPassword,
      role: 'ADMIN',
      isActive: true,
    },
  });
  console.log('✅ Created ADMIN:', admin.email);

  console.log('\n📧 Login Credentials:');
  console.log('='.repeat(60));
  console.log('Super Admin:');
  console.log('  Email: czarlie12012010@gmail.com');
  console.log('  Password: Admin@2024!');
  console.log('  Role: SUPER_ADMIN (Full access to all pages)');
  console.log('');
  console.log('Admin:');
  console.log('  Email: czarinabalnig@gmail.com');
  console.log('  Password: Admin@2024!');
  console.log('  Role: ADMIN (Access to operations + employee pages)');
  console.log('='.repeat(60));
  console.log('\n⚠️  Please change these default passwords after first login!');
}

async function main() {
  try {
    await seedAdminUsers();
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
