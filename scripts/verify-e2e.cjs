const mysql = require('../server/node_modules/mysql2/promise');
(async () => {
  const conn = await mysql.createConnection({ host: '127.0.0.1', port: 3306, user: 'root', password: '', database: 'syllabus_e2e_local' });
  const [s] = await conn.query("SELECT setting_value FROM administrative_settings WHERE setting_key = 'administration'");
  console.log('Admin settings on syllabus_e2e_local:', s[0]?.setting_value);
  const [syl] = await conn.query('SELECT syllabus_id, status, title FROM syllabi WHERE syllabus_id = 111');
  console.log('Syllabus 111:', syl[0]);
  await conn.end();
})().catch(console.error);
