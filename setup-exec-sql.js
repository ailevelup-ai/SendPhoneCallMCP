const fs = require('fs');
const path = require('path');

// Read the SQL file
const sqlPath = path.join(__dirname, 'direct-exec-sql-setup.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

console.log('===========================================================');
console.log('IMPORTANT: You need to run the following SQL in your Supabase SQL Editor:');
console.log('===========================================================');
console.log(sql);
console.log('===========================================================');
console.log('After executing this SQL, you can run the server and the models/voices should work correctly.');
console.log('==========================================================='); 