const { db, run } = require('./database');

async function setup() {
  console.log('Creating tables...');

  await run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT UNIQUE, password_hash TEXT,
    role TEXT DEFAULT 'USER', status TEXT DEFAULT 'ACTIVE',
    email_verified INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY, user_id TEXT UNIQUE, full_name TEXT,
    language TEXT DEFAULT 'en', plan TEXT DEFAULT 'FREE',
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  await run(`CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY, name_en TEXT, name_ar TEXT,
    slug TEXT UNIQUE, icon TEXT, is_active INTEGER DEFAULT 1
  )`);

  await run(`CREATE TABLE IF NOT EXISTS ai_tools (
    id TEXT PRIMARY KEY, name TEXT, name_ar TEXT,
    description TEXT, description_ar TEXT, url TEXT,
    icon TEXT, category_id TEXT, is_premium INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1, click_count INTEGER DEFAULT 0,
    FOREIGN KEY(category_id) REFERENCES categories(id)
  )`);

  await run(`CREATE TABLE IF NOT EXISTS favorites (
    id TEXT PRIMARY KEY, user_id TEXT, tool_id TEXT,
    UNIQUE(user_id, tool_id),
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(tool_id) REFERENCES ai_tools(id)
  )`);

  await run(`CREATE TABLE IF NOT EXISTS affiliate_clicks (
    id TEXT PRIMARY KEY, user_id TEXT, tool_id TEXT,
    ip_address TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY, user_id TEXT, action TEXT,
    details TEXT, ip_address TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  console.log('Tables created!');
}

setup().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });