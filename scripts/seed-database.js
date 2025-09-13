#!/usr/bin/env node


require('dotenv').config();

const {
  seedDatabase,
  checkIfSeeded,
} = require('../shared/dist/utils/seed-database');
const config = require('../shared/dist/config/env').default;

async function main() {
  try {
    console.log('🌱 Starting database seeding process...');

    const forceReseed = process.argv.includes('--force');

    if (!forceReseed) {
      const isSeeded = await checkIfSeeded(config.MONGODB_URI);

      if (isSeeded) {
        console.log(
          '⚠️  Database appears to already be seeded. Do you want to reseed? (This will clear existing data)'
        );
        console.log('   To reseed, run: npm run seed -- --force');
        return;
      }
    }

    await seedDatabase(config.MONGODB_URI);

    console.log('✅ Database seeding completed successfully!');
    console.log('   - 5 customers added');
    console.log('   - 7 products added');
    console.log(
      '   - Database indexes created for customers and products only'
    );
  } catch (error) {
    console.error('❌ Failed to seed database:', error);
    process.exit(1);
  }
}


main().catch(console.error);
