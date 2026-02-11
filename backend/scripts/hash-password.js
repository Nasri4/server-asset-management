/**
 * Generate bcrypt hash for a password
 * Usage: node scripts/hash-password.js "yourpassword"
 */

const bcrypt = require('bcrypt');

const password = process.argv[2] || 'developer123';

bcrypt.hash(password, 12).then((hash) => {
  console.log('\n========================================');
  console.log('Password:', password);
  console.log('========================================');
  console.log('\nBcrypt Hash (copy this):');
  console.log(hash);
  console.log('\n========================================');
  console.log('SQL UPDATE statement:');
  console.log('========================================\n');
  console.log(`UPDATE dbo.Users`);
  console.log(`SET password_hash = '${hash}'`);
  console.log(`WHERE username = 'developer';`);
  console.log('\n========================================\n');
}).catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
