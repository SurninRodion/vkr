const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/db');

async function main() {
  const email = process.argv[2] || 'admin@promptlearn.local';
  const password = process.argv[3] || 'admin123';
  const name = process.argv[4] || 'Admin';

  console.log('[CreateAdminUser] Email:', email);

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, row) => {
    if (err) {
      console.error('[CreateAdminUser] DB error:', err.message);
      process.exit(1);
    }

    if (row) {
      console.log('[CreateAdminUser] User already exists, updating role to admin...');
      db.run(
        `
          UPDATE users
          SET role = 'admin'
          WHERE email = ?
        `,
        [email],
        function (updateErr) {
          if (updateErr) {
            console.error('[CreateAdminUser] Error updating role:', updateErr.message);
            process.exit(1);
          }
          console.log('[CreateAdminUser] Role updated to admin for', email);
          process.exit(0);
        }
      );
      return;
    }

    try {
      const passwordHash = await bcrypt.hash(password, 10);
      const id = uuidv4();

      db.run(
        `
          INSERT INTO users (id, email, password_hash, name, role, points, level)
          VALUES (?, ?, ?, ?, 'admin', 0, 1)
        `,
        [id, email, passwordHash, name],
        function (insertErr) {
          if (insertErr) {
            console.error('[CreateAdminUser] Error inserting admin user:', insertErr.message);
            process.exit(1);
          }
          console.log('[CreateAdminUser] Admin user created:');
          console.log('  email   :', email);
          console.log('  password:', password);
          process.exit(0);
        }
      );
    } catch (hashErr) {
      console.error('[CreateAdminUser] Error hashing password:', hashErr.message);
      process.exit(1);
    }
  });
}

main();

