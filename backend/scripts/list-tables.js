require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DATABASE_URL });
c.connect()
  .then(() => c.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"))
  .then(r => { console.log(r.rows.map(x => x.table_name).join(', ')); return c.end(); })
  .catch(e => console.error(e.message));
