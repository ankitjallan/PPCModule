require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Client } = require('pg');
async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const tables = ['raw_materials','stock','fg_codes','spec_sheets','spec_sheet_films','spec_sheet_cylinders','spec_sheet_process','sales_orders','production_orders','production_stage_tracking','production_rm_allocation','work_orders','machines','ptd_entries','customers'];
  for (const t of tables) {
    const r = await client.query('SELECT column_name FROM information_schema.columns WHERE table_name=$1', [t]);
    console.log(t + ':\n  ' + r.rows.map(x => x.column_name).join(', ') + '\n');
  }
  await client.end();
}
run().catch(e => console.error(e.message));
