/**
 * Generate Bcrypt Hashes for User Passwords
 * Run: node generate-hashes.js
 */

const bcrypt = require('bcrypt');

const passwords = [
  { name: 'Admin (developer)', password: 'Admin@123' },
  { name: 'TeamLead (Ismail)', password: 'Ismail@123' },
  { name: 'Engineer (Nasri)', password: 'dev@123' }
];

async function generateHashes() {
  console.log('Generating bcrypt hashes...\n');
  
  for (const item of passwords) {
    const hash = await bcrypt.hash(item.password, 10);
    console.log(`${item.name}:`);
    console.log(`  Password: ${item.password}`);
    console.log(`  Hash: ${hash}`);
    console.log('');
  }
  
  console.log('Copy these hashes into your SQL script!');
}

generateHashes();
