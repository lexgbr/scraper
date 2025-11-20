const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const readline = require('readline');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:../../../packages/data/demo.db',
    },
  },
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function main() {
  console.log('\n=== Create Admin User ===\n');

  const username = await question('Username: ');
  const password = await question('Password: ');

  if (!username || !password) {
    console.error('Username and password are required');
    process.exit(1);
  }

  if (password.length < 6) {
    console.error('Password must be at least 6 characters');
    process.exit(1);
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
      },
    });

    console.log(`\n✓ Admin user created successfully!`);
    console.log(`  Username: ${user.username}`);
    console.log(`  ID: ${user.id}\n`);
  } catch (error) {
    if (error.code === 'P2002') {
      console.error('\n✗ Username already exists\n');
    } else {
      console.error('\n✗ Error creating user:', error.message, '\n');
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    rl.close();
  }
}

main();
