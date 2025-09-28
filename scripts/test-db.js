#!/usr/bin/env node

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');

async function testConnection() {
  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    console.log('\n📝 Please set up your database connection:');
    console.log('1. Copy the example: cp .env.example .env.local');
    console.log('2. Edit .env.local with your PostgreSQL credentials');
    console.log('3. See DATABASE_SETUP.md for detailed instructions');
    process.exit(1);
  }

  console.log('🔌 Testing database connection...');
  console.log('📍 Database URL:', process.env.DATABASE_URL.replace(/:[^:@]*@/, ':***@'));
  
  const prisma = new PrismaClient();
  
  try {
    // Set connection timeout
    const connectPromise = prisma.$connect();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Connection timeout after 10 seconds')), 10000)
    );
    
    await Promise.race([connectPromise, timeoutPromise]);
    console.log('✅ Database connection successful!');
    
    // Test basic query
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Database query test passed:', result);
    
  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error('Error:', error.message);
    
    // Provide specific error guidance
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n� PostgreSQL is not running or not accessible');
      console.log('• Start PostgreSQL: sudo systemctl start postgresql');
      console.log('• Or on macOS: brew services start postgresql');
    } else if (error.message.includes('database') && error.message.includes('does not exist')) {
      console.log('\n🔧 Database does not exist');
      console.log('• Create it: CREATE DATABASE business_management_db;');
    } else if (error.message.includes('authentication failed')) {
      console.log('\n🔧 Authentication failed');
      console.log('• Check username/password in DATABASE_URL');
    } else if (error.message.includes('timeout')) {
      console.log('\n🔧 Connection timeout');
      console.log('• Check if PostgreSQL is running');
      console.log('• Verify hostname and port in DATABASE_URL');
    }
    
    console.log('\n📚 See DATABASE_SETUP.md for detailed setup instructions');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();