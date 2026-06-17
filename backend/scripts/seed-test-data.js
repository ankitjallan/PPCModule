require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const { Client } = require('pg');

const client = new Client({ connectionString: process.env.DATABASE_URL });

const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0]; };
const daysAhead = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().split('T')[0]; };

async function seed() {
  await client.connect();
  console.log('Connected. Seeding...\n');

  // ── USERS ─────────────────────────────────────────────────────
  const hash = await bcrypt.hash('User@1234', 10);
  const extraUsers = [
    { name: 'Ankit Sharma (PPC)',  email: 'ppc@mipl.com',      role: 'ppc_planner'      },
    { name: 'Ravi Store Manager',  email: 'store@mipl.com',     role: 'store_inventory'  },
    { name: 'Suresh Operator',     email: 'operator@mipl.com',  role: 'machine_operator' },
    { name: 'Priya Sales',         email: 'sales@mipl.com',     role: 'sales'            },
    { name: 'Director Management', email: 'mgmt@mipl.com',      role: 'management'       },
  ];
  for (const u of extraUsers) {
    const roleRes = await client.query(`SELECT id FROM roles WHERE name=$1`, [u.role]);
    if (!roleRes.rows[0]) continue;
    await client.query(
      `INSERT INTO users (name, email, password_hash, role_id) VALUES ($1,$2,$3,$4) ON CONFLICT (email) DO NOTHING`,
      [u.name, u.email, hash, roleRes.rows[0].id]
    );
  }
  console.log('✅ Users seeded (password: User@1234)');

  // ── CUSTOMERS ─────────────────────────────────────────────────
  const custList = [
    { code: 'BRIT001', name: 'Britannia Industries Ltd',    contact: 'Rajesh Sharma', phone: '9876543210', email: 'procurement@britannia.com' },
    { code: 'ITC002',  name: 'ITC Limited - Foods Division',contact: 'Priya Nair',   phone: '9123456789', email: 'packaging@itc.in'           },
    { code: 'HUL003',  name: 'Hindustan Unilever Ltd',      contact: 'Amit Patel',   phone: '9988776655', email: 'supply@hul.com'             },
    { code: 'PARD004', name: 'Parle Products Pvt Ltd',      contact: 'Suresh Kumar', phone: '9871234560', email: 'ops@parle.com'              },
    { code: 'AMUL005', name: 'Amul Dairy Cooperative',      contact: 'Nalini Shah',  phone: '9765432100', email: 'packing@amul.com'           },
    { code: 'MTR006',  name: 'MTR Foods Pvt Ltd',           contact: 'Venkat Rao',   phone: '9654321098', email: 'purchase@mtrfoods.com'      },
  ];
  for (const c of custList) {
    await client.query(
      `INSERT INTO customers (code, name, contact_person, phone, email) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (code) DO NOTHING`,
      [c.code, c.name, c.contact, c.phone, c.email]
    );
  }
  const custIds = {};
  for (const c of custList) {
    const r = await client.query(`SELECT id FROM customers WHERE code=$1`, [c.code]);
    custIds[c.code] = r.rows[0]?.id;
  }
  console.log('✅ Customers seeded');

  // ── RAW MATERIALS ─────────────────────────────────────────────
  // Columns: item_code, item_name, item_type, item_subtype, gsm, width_mm, micron, uom
  const rmList = [
    { code: '104787', name: '12MIC X 949MM BOPP BST',          type: 'BOPP', sub: 'BOPP TRANS BST',  gsm: 10.8,  width: 949,  mic: 12  },
    { code: '104788', name: '18MIC X 939MM Met BOPP HSL',       type: 'BOPP', sub: 'MET BOPP',        gsm: 16.2,  width: 939,  mic: 18  },
    { code: '104791', name: '15MIC X 955MM TPT BOPP BST',       type: 'BOPP', sub: 'BOPP TRANS BST',  gsm: 13.5,  width: 955,  mic: 15  },
    { code: '100197', name: '12MIC X 1005MM TPT BOPP BST',      type: 'BOPP', sub: 'BOPP TRANS BST',  gsm: 10.8,  width: 1005, mic: 12  },
    { code: '101006', name: '15MIC X 920MM TPT BOPP BST',       type: 'BOPP', sub: 'BOPP TRANS BST',  gsm: 13.5,  width: 920,  mic: 15  },
    { code: '104934', name: '15MIC X 1115MM TPT BOPP BST',      type: 'BOPP', sub: 'BOPP TRANS BST',  gsm: 13.5,  width: 1115, mic: 15  },
    { code: '105164', name: '21MIC X 1050MM TAPE GRADE BOPP',   type: 'BOPP', sub: 'BOPP TAPE GRADE', gsm: 18.9,  width: 1050, mic: 21  },
    { code: '104523', name: '12MIC X 1125MM PET Chemical',      type: 'PET',  sub: 'PET CHEMICAL',    gsm: 16.8,  width: 1125, mic: 12  },
    { code: '104399', name: '8MIC X 1215MM PET Chemical',       type: 'PET',  sub: 'PET CHEMICAL',    gsm: 11.2,  width: 1215, mic:  8  },
    { code: '100019', name: '12MIC X 1215MM PET Corona',        type: 'PET',  sub: 'PET CORONA',      gsm: 16.8,  width: 1215, mic: 12  },
    { code: '100393', name: '12MIC X 1175MM PET Corona',        type: 'PET',  sub: 'PET CORONA',      gsm: 16.8,  width: 1175, mic: 12  },
    { code: '103714', name: '10MIC X 1115MM CC Met PET',        type: 'PET',  sub: 'MET PET',         gsm: 14.0,  width: 1115, mic: 10  },
    { code: '104402', name: '8MIC X 1210MM Met PET Chemical',   type: 'PET',  sub: 'MET PET',         gsm: 11.2,  width: 1210, mic:  8  },
    { code: '104783', name: '12MIC X 1210MM Met PET Corona',    type: 'PET',  sub: 'MET PET',         gsm: 16.8,  width: 1210, mic: 12  },
    { code: '104795', name: '105MIC X 985MM PE White',          type: 'PE',   sub: 'PE WHITE',        gsm: 99.75, width: 985,  mic: 105 },
    { code: '103829', name: '21MIC X 1115MM PE Natural',        type: 'PE',   sub: 'PE NATURAL',      gsm: 19.32, width: 1115, mic: 21  },
    { code: '104432', name: '25MIC X 1215MM PE Natural',        type: 'PE',   sub: 'PE NATURAL',      gsm: 23.0,  width: 1215, mic: 25  },
    { code: '104847', name: '40MIC X 1215MM PE Natural',        type: 'PE',   sub: 'PE NATURAL',      gsm: 36.8,  width: 1215, mic: 40  },
    { code: '104432B', name: '33MIC X 1175MM PE White',         type: 'PE',   sub: 'PE WHITE',        gsm: 31.02, width: 1175, mic: 33  },
    { code: '100199', name: '12MIC X 1080MM TPT BOPP BST',      type: 'BOPP', sub: 'BOPP TRANS BST',  gsm: 10.8,  width: 1080, mic: 12  },
  ];
  for (const r of rmList) {
    await client.query(
      `INSERT INTO raw_materials (item_code, item_name, item_type, item_subtype, gsm, width_mm, micron, uom)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'KGS') ON CONFLICT (item_code) DO NOTHING`,
      [r.code, r.name, r.type, r.sub, r.gsm, r.width, r.mic]
    );
  }
  const rmIds = {};
  for (const r of rmList) {
    const res = await client.query(`SELECT id FROM raw_materials WHERE item_code=$1`, [r.code]);
    rmIds[r.code] = res.rows[0]?.id;
  }
  console.log('✅ Raw materials seeded');

  // ── STOCK ─────────────────────────────────────────────────────
  // Columns: raw_material_id, store_stock, qc_hold, process_stock, pending_movement, last_30_cons, pending_po, qc_pending
  const stockData = [
    { code: '104787', store: 2650.96, qc: 0,     proc: 0, move: 0,     cons30: 3094.29, ppo: 574.46, qcpend: 0 },
    { code: '104788', store: 4455.23, qc: 44.45, proc: 0, move: 0,     cons30: 0,       ppo: 0,      qcpend: 0 },
    { code: '104791', store: 6034.8,  qc: 0,     proc: 0, move: 0,     cons30: 28,      ppo: 4,      qcpend: 0 },
    { code: '100197', store: 578.32,  qc: 0,     proc: 0, move: 286.6, cons30: 0,       ppo: 0,      qcpend: 0 },
    { code: '101006', store: 883.4,   qc: 0,     proc: 0, move: 0,     cons30: 3316.65, ppo: 891.35, qcpend: 0 },
    { code: '104934', store: 0,       qc: 0,     proc: 0, move: 0,     cons30: 8846.91, ppo: 1140.29,qcpend: 0 },
    { code: '105164', store: 212.7,   qc: 0,     proc: 0, move: 0,     cons30: 1004.17, ppo: 3000,   qcpend: 0 },
    { code: '104523', store: 2672.23, qc: 0,     proc: 0, move: 0,     cons30: 0,       ppo: 0,      qcpend: 0 },
    { code: '104399', store: 4615.5,  qc: 0,     proc: 0, move: 0,     cons30: 0,       ppo: 0,      qcpend: 0 },
    { code: '100019', store: 3535.89, qc: 0,     proc: 0, move: 0,     cons30: 0,       ppo: 0,      qcpend: 0 },
    { code: '100393', store: 1632.64, qc: 0,     proc: 0, move: 0,     cons30: 0,       ppo: 0,      qcpend: 0 },
    { code: '103714', store: 1393.82, qc: 0,     proc: 0, move: 0,     cons30: 0,       ppo: 0,      qcpend: 0 },
    { code: '104402', store: 4546.23, qc: 0,     proc: 0, move: 0,     cons30: 0,       ppo: 0,      qcpend: 0 },
    { code: '104783', store: 1000.84, qc: 0,     proc: 0, move: 0,     cons30: 0,       ppo: 0,      qcpend: 0 },
    { code: '104795', store: 5148.9,  qc: 0,     proc: 0, move: 0,     cons30: 0,       ppo: 0,      qcpend: 0 },
    { code: '103829', store: 5413.6,  qc: 0,     proc: 0, move: 0,     cons30: 0,       ppo: 0,      qcpend: 0 },
    { code: '104432', store: 2304.6,  qc: 0,     proc: 0, move: 0,     cons30: 0,       ppo: 5500,   qcpend: 0 },
    { code: '104847', store: 109.2,   qc: 0,     proc: 0, move: 0,     cons30: 0,       ppo: 0,      qcpend: 0 },
    { code: '104432B', store: 1632.64,qc: 0,     proc: 0, move: 0,     cons30: 0,       ppo: 0,      qcpend: 0 },
    { code: '100199', store: 802,     qc: 0,     proc: 0, move: 0,     cons30: 795.4,   ppo: 0,      qcpend: 0 },
  ];
  for (const s of stockData) {
    const rmId = rmIds[s.code];
    if (!rmId) continue;
    await client.query(
      `INSERT INTO stock (raw_material_id, store_stock, qc_hold, process_stock, pending_movement, last_30_cons, pending_po, qc_pending)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (raw_material_id) DO UPDATE SET
         store_stock=EXCLUDED.store_stock, qc_hold=EXCLUDED.qc_hold, process_stock=EXCLUDED.process_stock,
         pending_movement=EXCLUDED.pending_movement, last_30_cons=EXCLUDED.last_30_cons,
         pending_po=EXCLUDED.pending_po, qc_pending=EXCLUDED.qc_pending, updated_at=NOW()`,
      [rmId, s.store, s.qc, s.proc, s.move, s.cons30, s.ppo, s.qcpend]
    );
  }
  console.log('✅ Stock seeded');

  // ── MACHINES ──────────────────────────────────────────────────
  // Columns: name, machine_code, process_category_id, speed_mpm, width_mm
  // process_categories has: id, name (Printing, ECL, Lamination, Slitting, Pouching)
  const catRes = await client.query(`SELECT id, name FROM process_categories`);
  const catByName = {};
  catRes.rows.forEach(r => { catByName[r.name] = r.id; });
  const machList = [
    { name: 'PELICAN-1', code: 'PEL1',  catName: 'Printing',   speed: 375, width: 1300 },
    { name: 'PELICAN-2', code: 'PEL2',  catName: 'Printing',   speed: 350, width: 1300 },
    { name: 'FONGKEE-1', code: 'FON1',  catName: 'ECL',        speed: 250, width: 1300 },
    { name: 'FONGKEE-2', code: 'FON2',  catName: 'ECL',        speed: 250, width: 1300 },
    { name: 'CL-450',    code: 'CL450', catName: 'Lamination', speed: 150, width: 1300 },
    { name: 'CL-300',    code: 'CL300', catName: 'Lamination', speed: 130, width: 1300 },
    { name: 'SLITTER-1', code: 'SLT1',  catName: 'Slitting',   speed: 500, width: 1300 },
    { name: 'SLITTER-2', code: 'SLT2',  catName: 'Slitting',   speed: 500, width: 1300 },
    { name: 'POUCHER-1', code: 'PCH1',  catName: 'Pouching',   speed: 80,  width: 600  },
  ];
  const machIds = {};
  for (const m of machList) {
    await client.query(
      `INSERT INTO machines (name, machine_code, process_category_id, speed_mpm, width_mm)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (machine_code) DO NOTHING`,
      [m.name, m.code, catByName[m.catName], m.speed, m.width]
    );
    const r = await client.query(`SELECT id FROM machines WHERE machine_code=$1`, [m.code]);
    machIds[m.code] = r.rows[0]?.id;
  }
  console.log('✅ Machines seeded');

  // ── FG CODES ──────────────────────────────────────────────────
  // Columns: fg_code, description, customer_id, fg_type
  const fgList = [
    { code: 'FG-1001', desc: 'BRITANNIA GOOD DAY BUTTER 80G - 3PLY LAMINATE', cust: 'BRIT001', type: 'LAMINATE ROLL 3PLY' },
    { code: 'FG-1002', desc: 'BRITANNIA MARIE GOLD 200G - 2PLY LAMINATE',     cust: 'BRIT001', type: 'LAMINATE ROLL 2PLY' },
    { code: 'FG-1003', desc: 'ITC SUNFEAST DARK FANTASY 75G - 4PLY LAMINATE', cust: 'ITC002',  type: 'LAMINATE ROLL 4PLY' },
    { code: 'FG-1004', desc: 'HUL KNORR SOUP SACHET 10G - 3PLY LAMINATE',    cust: 'HUL003',  type: 'LAMINATE ROLL 3PLY' },
    { code: 'FG-1005', desc: 'PARLE-G GLUCOSE BISCUIT 100G - 1PLY POLY',     cust: 'PARD004', type: 'POLY ROLL 1PLY'     },
    { code: 'FG-1006', desc: 'AMUL BUTTER 100G - 3PLY LAMINATE',             cust: 'AMUL005', type: 'LAMINATE ROLL 3PLY' },
    { code: 'FG-1007', desc: 'MTR RASAM POWDER 100G - 3PLY LAMINATE',        cust: 'MTR006',  type: 'LAMINATE ROLL 3PLY' },
    { code: 'FG-1008', desc: 'ITC AASHIRVAAD ATTA 5KG - 2PLY LAMINATE',     cust: 'ITC002',  type: 'LAMINATE ROLL 2PLY' },
  ];
  const fgIds = {};
  for (const f of fgList) {
    await client.query(
      `INSERT INTO fg_codes (fg_code, description, customer_id, fg_type) VALUES ($1,$2,$3,$4) ON CONFLICT (fg_code) DO NOTHING`,
      [f.code, f.desc, custIds[f.cust], f.type]
    );
    const r = await client.query(`SELECT id FROM fg_codes WHERE fg_code=$1`, [f.code]);
    fgIds[f.code] = r.rows[0]?.id;
  }
  console.log('✅ FG codes seeded');

  // ── SPEC SHEETS ───────────────────────────────────────────────
  // spec_sheets cols: fg_code_id, version, is_current, total_gsm, width_mm, job_name, no_of_colors, notes, created_by
  // spec_sheet_films cols: spec_sheet_id, layer_no, raw_material_id, item_code, item_name, gsm, width_mm, micron, std_wastage
  // spec_sheet_process cols: spec_sheet_id, has_printing, has_ecl, has_lam1, has_lam2, has_slitting, has_pouching + machine ids
  const adminR = await client.query(`SELECT id FROM users WHERE email='admin@mipl.com'`);
  const adminId = adminR.rows[0]?.id;

  const specDefs = [
    {
      fg: 'FG-1001', gsm: 36,    width: 949,  jobName: 'BRITANNIA GOOD DAY BUTTER 80G', colors: 6,
      films: [
        { layer: 1, code: '104787', gsm: 10.8, width: 949,  mic: 12,  wastage: 1.05 },
        { layer: 2, code: '104788', gsm: 16.2, width: 939,  mic: 18,  wastage: 1.05 },
      ],
      process: { printing: true, ecl: true, lam1: false, lam2: false, slitting: true, pouching: false },
    },
    {
      fg: 'FG-1002', gsm: 51.32, width: 1175, jobName: 'BRITANNIA MARIE GOLD 200G', colors: 6,
      films: [
        { layer: 1, code: '100393', gsm: 16.8, width: 1175, mic: 12,  wastage: 1.035 },
        { layer: 2, code: '104432B',gsm: 31.02,width: 1175, mic: 33,  wastage: 1.035 },
      ],
      process: { printing: true, ecl: false, lam1: true, lam2: false, slitting: true, pouching: false },
    },
    {
      fg: 'FG-1003', gsm: 60.82, width: 1125, jobName: 'ITC SUNFEAST DARK FANTASY 75G', colors: 5,
      films: [
        { layer: 1, code: '104523', gsm: 16.8, width: 1125, mic: 12,  wastage: 1.05 },
        { layer: 2, code: '103714', gsm: 14.0, width: 1115, mic: 10,  wastage: 1.05 },
        { layer: 3, code: '103829', gsm: 19.32,width: 1115, mic: 21,  wastage: 1.05 },
      ],
      process: { printing: true, ecl: true, lam1: true, lam2: false, slitting: true, pouching: false },
    },
    {
      fg: 'FG-1004', gsm: 50.8,  width: 1215, jobName: 'HUL KNORR SOUP SACHET 10G', colors: 5,
      films: [
        { layer: 1, code: '104399', gsm: 11.2, width: 1215, mic: 8,   wastage: 1.05 },
        { layer: 2, code: '104402', gsm: 11.2, width: 1210, mic: 8,   wastage: 1.05 },
        { layer: 3, code: '104432', gsm: 23.0, width: 1215, mic: 25,  wastage: 1.05 },
      ],
      process: { printing: true, ecl: false, lam1: true, lam2: true, slitting: true, pouching: false },
    },
    {
      fg: 'FG-1005', gsm: 100.25,width: 985,  jobName: 'PARLE-G GLUCOSE BISCUIT 100G', colors: 3,
      films: [
        { layer: 1, code: '104795', gsm: 99.75,width: 985,  mic: 105, wastage: 1.0  },
      ],
      process: { printing: true, ecl: false, lam1: false, lam2: false, slitting: true, pouching: false },
    },
  ];

  const ssIds = {};
  for (const s of specDefs) {
    const fgId = fgIds[s.fg];
    if (!fgId) continue;
    const existing = await client.query(`SELECT id FROM spec_sheets WHERE fg_code_id=$1 AND is_current=true`, [fgId]);
    if (existing.rows[0]) { ssIds[s.fg] = existing.rows[0].id; continue; }

    const ssR = await client.query(
      `INSERT INTO spec_sheets (fg_code_id, version, is_current, total_gsm, width_mm, job_name, no_of_colors, created_by)
       VALUES ($1,1,true,$2,$3,$4,$5,$6) RETURNING id`,
      [fgId, s.gsm, s.width, s.jobName, s.colors, adminId]
    );
    const ssId = ssR.rows[0].id;
    ssIds[s.fg] = ssId;

    for (const f of s.films) {
      const rmId = rmIds[f.code] || null;
      const rmInfo = rmList.find(r => r.code === f.code);
      await client.query(
        `INSERT INTO spec_sheet_films (spec_sheet_id, layer_no, raw_material_id, item_code, item_name, gsm, width_mm, micron, std_wastage)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [ssId, f.layer, rmId, f.code, rmInfo?.name || f.code, f.gsm, f.width, f.mic, f.wastage]
      );
    }

    const p = s.process;
    await client.query(
      `INSERT INTO spec_sheet_process (spec_sheet_id, has_printing, has_ecl, has_lam1, has_lam2, has_slitting, has_pouching,
         printing_machine_id, ecl_machine_id, lam1_machine_id, lam2_machine_id, slitting_machine_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [ssId,
       p.printing, p.ecl, p.lam1, p.lam2, p.slitting, p.pouching,
       p.printing ? machIds['PEL1'] : null,
       p.ecl      ? machIds['FON1'] : null,
       p.lam1     ? machIds['CL450'] : null,
       p.lam2     ? machIds['CL450'] : null,
       p.slitting ? machIds['SLT1'] : null,
      ]
    );
  }
  console.log('✅ Spec sheets seeded');

  // ── SALES ORDERS ──────────────────────────────────────────────
  // Columns: so_number, customer_id, fg_code_id, job_name, order_type, qty_kg, qty_rolls, delivery_date, priority, status, so_date, created_by
  const soList = [
    { no: 'SO-2026-00001', cust: 'BRIT001', fg: 'FG-1001', job: 'GOOD DAY BUTTER 80G',   date: daysAgo(20), delv: daysAhead(5),  qty: 1500, type: 'REPEAT', status: 'IN_PROGRESS', pri: 'HIGH'   },
    { no: 'SO-2026-00002', cust: 'ITC002',  fg: 'FG-1003', job: 'SUNFEAST DARK FANTASY',  date: daysAgo(18), delv: daysAhead(3),  qty: 2000, type: 'REPEAT', status: 'IN_PROGRESS', pri: 'URGENT' },
    { no: 'SO-2026-00003', cust: 'HUL003',  fg: 'FG-1004', job: 'KNORR SOUP SACHET 10G',  date: daysAgo(15), delv: daysAhead(10), qty: 800,  type: 'NEW',    status: 'PENDING',     pri: 'NORMAL' },
    { no: 'SO-2026-00004', cust: 'PARD004', fg: 'FG-1005', job: 'PARLE-G GLUCOSE 100G',   date: daysAgo(12), delv: daysAhead(8),  qty: 3000, type: 'REPEAT', status: 'PENDING',     pri: 'HIGH'   },
    { no: 'SO-2026-00005', cust: 'BRIT001', fg: 'FG-1002', job: 'BRITANNIA MARIE GOLD',   date: daysAgo(10), delv: daysAhead(12), qty: 1200, type: 'REPEAT', status: 'IN_PROGRESS', pri: 'NORMAL' },
    { no: 'SO-2026-00006', cust: 'AMUL005', fg: 'FG-1006', job: 'AMUL BUTTER 100G',       date: daysAgo(8),  delv: daysAhead(15), qty: 600,  type: 'NEW',    status: 'PENDING',     pri: 'NORMAL' },
    { no: 'SO-2026-00007', cust: 'MTR006',  fg: 'FG-1007', job: 'MTR RASAM POWDER 100G',  date: daysAgo(6),  delv: daysAhead(20), qty: 900,  type: 'REPEAT', status: 'PENDING',     pri: 'LOW'    },
    { no: 'SO-2026-00008', cust: 'ITC002',  fg: 'FG-1008', job: 'AASHIRVAAD ATTA 5KG',    date: daysAgo(5),  delv: daysAhead(18), qty: 2500, type: 'REPEAT', status: 'PENDING',     pri: 'NORMAL' },
    { no: 'SO-2026-00009', cust: 'HUL003',  fg: 'FG-1004', job: 'KNORR SOUP SACHET PREV', date: daysAgo(30), delv: daysAgo(2),    qty: 1000, type: 'REPEAT', status: 'COMPLETED',   pri: 'HIGH'   },
    { no: 'SO-2026-00010', cust: 'BRIT001', fg: 'FG-1001', job: 'GOOD DAY BUTTER PREV',   date: daysAgo(35), delv: daysAgo(5),    qty: 750,  type: 'REPEAT', status: 'COMPLETED',   pri: 'NORMAL' },
    { no: 'SO-2026-00011', cust: 'ITC002',  fg: 'FG-1003', job: 'DARK FANTASY PREV',      date: daysAgo(25), delv: daysAgo(3),    qty: 500,  type: 'NEW',    status: 'COMPLETED',   pri: 'URGENT' },
    { no: 'SO-2026-00012', cust: 'PARD004', fg: 'FG-1005', job: 'PARLE-G LARGE RUN',      date: daysAgo(3),  delv: daysAhead(25), qty: 4000, type: 'REPEAT', status: 'PENDING',     pri: 'HIGH'   },
    // Overdue
    { no: 'SO-2026-00013', cust: 'AMUL005', fg: 'FG-1006', job: 'AMUL BUTTER OVERDUE',    date: daysAgo(40), delv: daysAgo(8),    qty: 1100, type: 'REPEAT', status: 'IN_PROGRESS', pri: 'URGENT' },
    { no: 'SO-2026-00014', cust: 'MTR006',  fg: 'FG-1007', job: 'MTR RASAM OVERDUE',      date: daysAgo(45), delv: daysAgo(10),   qty: 850,  type: 'REPEAT', status: 'IN_PROGRESS', pri: 'URGENT' },
  ];

  const soIds = {};
  for (const so of soList) {
    const custId = custIds[so.cust];
    const fgId   = fgIds[so.fg];
    if (!custId || !fgId) continue;
    const existing = await client.query(`SELECT id FROM sales_orders WHERE so_number=$1`, [so.no]);
    if (existing.rows[0]) { soIds[so.no] = existing.rows[0].id; continue; }
    const r = await client.query(
      `INSERT INTO sales_orders (so_number, customer_id, fg_code_id, job_name, order_type, qty_kg, delivery_date, priority, status, so_date, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [so.no, custId, fgId, so.job, so.type, so.qty, so.delv, so.pri, so.status, so.date, adminId]
    );
    soIds[so.no] = r.rows[0].id;
  }
  console.log('✅ Sales orders seeded');

  // ── WORK ORDERS & PRODUCTION ORDERS ──────────────────────────
  // work_orders cols: wo_number, sales_order_id, created_by
  // production_orders cols: work_order_id, sales_order_id, spec_sheet_id, spec_overridden, target_output_kg, target_output_km, status
  const prodSOs = ['SO-2026-00001','SO-2026-00002','SO-2026-00005','SO-2026-00009','SO-2026-00010','SO-2026-00011','SO-2026-00013','SO-2026-00014'];
  const completedSOs = new Set(['SO-2026-00009','SO-2026-00010','SO-2026-00011']);

  let woSeq = 1;
  const poIds = {};
  for (const soNo of prodSOs) {
    const soData = soList.find(s => s.no === soNo);
    const soId   = soIds[soNo];
    const ssId   = ssIds[soData?.fg];
    const specDef = specDefs.find(s => s.fg === soData?.fg);
    if (!soId || !ssId || !specDef) continue;

    const existingWO = await client.query(`SELECT id FROM work_orders WHERE sales_order_id=$1`, [soId]);
    let woId;
    if (existingWO.rows[0]) {
      woId = existingWO.rows[0].id;
    } else {
      const woNo = `WO-2026-${String(woSeq++).padStart(5,'0')}`;
      const wr = await client.query(
        `INSERT INTO work_orders (wo_number, sales_order_id, created_by) VALUES ($1,$2,$3) RETURNING id`,
        [woNo, soId, adminId]
      );
      woId = wr.rows[0].id;
    }

    const targetKm = (soData.qty * 1000000) / specDef.gsm / specDef.width;
    const isCompleted = completedSOs.has(soNo);

    const existingPO = await client.query(`SELECT id FROM production_orders WHERE sales_order_id=$1`, [soId]);
    let poId;
    if (existingPO.rows[0]) {
      poId = existingPO.rows[0].id;
    } else {
      const pr = await client.query(
        `INSERT INTO production_orders (work_order_id, sales_order_id, spec_sheet_id, target_output_kg, target_output_km, status)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [woId, soId, ssId, soData.qty, Math.round(targetKm * 100) / 100, isCompleted ? 'COMPLETED' : 'IN_PROGRESS']
      );
      poId = pr.rows[0].id;
    }
    poIds[soNo] = poId;

    // Stage tracking: production_stage_tracking cols: production_order_id, stage, machine_id, target_km, ptd_km, ptd_kg, status, pass_no, sequence_order
    const p = specDef.process;
    const stages = [];
    if (p.printing) stages.push({ stage: 'PRINTING', machCode: 'PEL1', seq: 1 });
    if (p.ecl)      stages.push({ stage: 'ECL',      machCode: 'FON1', seq: 2 });
    if (p.lam1)     stages.push({ stage: 'LAM1',     machCode: 'CL450', seq: 3 });
    if (p.lam2)     stages.push({ stage: 'LAM2',     machCode: 'CL450', seq: 4, pass: '2ND' });
    if (p.slitting) stages.push({ stage: 'SLITTING', machCode: 'SLT1', seq: 5 });

    for (const st of stages) {
      const ptdKm = isCompleted ? targetKm : targetKm * (0.3 + Math.random() * 0.5);
      const ptdKg = ptdKm * specDef.gsm / 1000000 * specDef.width;
      const stStatus = isCompleted ? 'COMPLETED' : ptdKm > 0 ? 'IN_PROGRESS' : 'PENDING';
      await client.query(
        `INSERT INTO production_stage_tracking (production_order_id, stage, machine_id, target_km, ptd_km, ptd_kg, status, pass_no, sequence_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT DO NOTHING`,
        [poId, st.stage, machIds[st.machCode], Math.round(targetKm*100)/100, Math.round(ptdKm*100)/100, Math.round(ptdKg*100)/100, stStatus, st.pass || '1ST', st.seq]
      ).catch(() => {});
    }

    // RM allocation: production_rm_allocation cols: production_order_id, raw_material_id, layer_no, bom_qty, allocated_qty, rm_status
    for (const f of specDef.films) {
      const rmId = rmIds[f.code];
      if (!rmId) continue;
      const bomQty = targetKm * f.width / 1000 * f.wastage;
      const stR = await client.query(`SELECT total_stock FROM stock WHERE raw_material_id=$1`, [rmId]);
      const stockAvail = parseFloat(stR.rows[0]?.total_stock || 0);
      const rmStatus = stockAvail >= bomQty ? 'AVAILABLE' : stockAvail > 0 ? 'APO' : 'SHORT';
      await client.query(
        `INSERT INTO production_rm_allocation (production_order_id, raw_material_id, layer_no, bom_qty, allocated_qty, rm_status)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
        [poId, rmId, f.layer, Math.round(bomQty*100)/100, Math.round(stockAvail*100)/100, rmStatus]
      ).catch(() => {});
    }
  }
  console.log('✅ Work orders, production orders, stage tracking seeded');

  // ── PTD ENTRIES ───────────────────────────────────────────────
  // Columns: production_order_id, stage, machine_id, shift_no, entry_date, actual_output_kg, actual_output_km, operator_name, entered_by
  const ptdSOs = ['SO-2026-00001','SO-2026-00002','SO-2026-00005','SO-2026-00009','SO-2026-00010','SO-2026-00011'];
  for (const soNo of ptdSOs) {
    const poId  = poIds[soNo];
    const soData = soList.find(s => s.no === soNo);
    const specDef = specDefs.find(s => s.fg === soData?.fg);
    if (!poId || !specDef) continue;
    const isCompleted = completedSOs.has(soNo);
    const numDays = isCompleted ? 5 : 3;
    for (let d = numDays; d >= 1; d--) {
      const dt = daysAgo(d);
      const dailyKg = soData.qty / numDays;
      const dailyKm = dailyKg * 1000000 / specDef.gsm / specDef.width;
      if (specDef.process.printing) {
        await client.query(
          `INSERT INTO ptd_entries (production_order_id, stage, machine_id, shift_no, entry_date, actual_output_kg, actual_output_km, operator_name, entered_by)
           VALUES ($1,'PRINTING',$2,1,$3,$4,$5,'Suresh Operator',$6) ON CONFLICT DO NOTHING`,
          [poId, machIds['PEL1'], dt, Math.round(dailyKg*0.95*100)/100, Math.round(dailyKm*0.95*100)/100, adminId]
        ).catch(() => {});
      }
      if (specDef.process.ecl) {
        await client.query(
          `INSERT INTO ptd_entries (production_order_id, stage, machine_id, shift_no, entry_date, actual_output_kg, actual_output_km, operator_name, entered_by)
           VALUES ($1,'ECL',$2,2,$3,$4,$5,'Raju Operator',$6) ON CONFLICT DO NOTHING`,
          [poId, machIds['FON1'], dt, Math.round(dailyKg*0.90*100)/100, Math.round(dailyKm*0.90*100)/100, adminId]
        ).catch(() => {});
      }
      if (specDef.process.lam1) {
        await client.query(
          `INSERT INTO ptd_entries (production_order_id, stage, machine_id, shift_no, entry_date, actual_output_kg, actual_output_km, operator_name, entered_by)
           VALUES ($1,'LAM1',$2,1,$3,$4,$5,'Mohan Operator',$6) ON CONFLICT DO NOTHING`,
          [poId, machIds['CL450'], dt, Math.round(dailyKg*0.92*100)/100, Math.round(dailyKm*0.92*100)/100, adminId]
        ).catch(() => {});
      }
    }
  }
  console.log('✅ PTD entries seeded');

  console.log('\n🎉 All test data seeded!\n');
  console.log('Login credentials:');
  console.log('  admin@mipl.com     → Admin@1234  (Admin)');
  console.log('  ppc@mipl.com       → User@1234   (PPC Planner)');
  console.log('  store@mipl.com     → User@1234   (Store/Inventory)');
  console.log('  operator@mipl.com  → User@1234   (Machine Operator)');
  console.log('  sales@mipl.com     → User@1234   (Sales)');
  console.log('  mgmt@mipl.com      → User@1234   (Management)\n');

  await client.end();
}

seed().catch(err => { console.error('Seed failed:', err.message); process.exit(1); });
