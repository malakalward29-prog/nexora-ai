const { run, get } = require('./database');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

async function seed() {
  console.log('Seeding...');

  const existing = await get('SELECT id FROM users WHERE email = ?', ['admin@nexora.ai']);
  if (existing) {
    console.log('Already seeded!');
    process.exit(0);
  }

  const adminId = uuidv4();
  const hash = await bcrypt.hash('Admin@2026', 12);
  await run('INSERT INTO users (id, email, password_hash, role, email_verified) VALUES (?, ?, ?, "ADMIN", 1)',
    [adminId, 'admin@nexora.ai', hash]);
  await run('INSERT INTO profiles (id, user_id, full_name, plan) VALUES (?, ?, "Admin", "BUSINESS")',
    [uuidv4(), adminId]);

  const cats = [
    [uuidv4(), 'Writing', 'كتابة', 'writing', '✍️'],
    [uuidv4(), 'Design', 'تصميم', 'design', '🎨'],
    [uuidv4(), 'Images', 'صور', 'images', '🖼️'],
    [uuidv4(), 'Audio', 'صوت', 'audio', '🎙️'],
    [uuidv4(), 'Video', 'فيديو', 'video', '🎬'],
    [uuidv4(), 'Programming', 'برمجة', 'programming', '💻'],
    [uuidv4(), 'Documents', 'مستندات', 'documents', '📄'],
    [uuidv4(), 'Business', 'أعمال', 'business', '📈'],
  ];
  for (const c of cats) {
    await run('INSERT INTO categories (id, name_en, name_ar, slug, icon) VALUES (?, ?, ?, ?, ?)', c);
  }

  const tools = [
    [uuidv4(), 'ChatGPT', 'شات جي بي تي', 'AI assistant for writing.', 'مساعد ذكاء اصطناعي.', 'https://chatgpt.com', '✍️', cats[0][0], 0],
    [uuidv4(), 'Canva AI', 'كانفا', 'Design with AI.', 'تصميم بالذكاء.', 'https://canva.com', '🎨', cats[1][0], 0],
    [uuidv4(), 'Midjourney', 'ميدجرني', 'Generate images.', 'توليد صور.', 'https://midjourney.com', '🖼️', cats[2][0], 1],
    [uuidv4(), 'TopMediai', 'توب ميديا', 'AI voice tools.', 'أدوات صوت.', 'https://topmediai.com', '🎙️', cats[3][0], 0],
    [uuidv4(), 'Runway', 'رانواي', 'AI video.', 'فيديو بالذكاء.', 'https://runwayml.com', '🎬', cats[4][0], 1],
    [uuidv4(), 'Copilot', 'كوبايلوت', 'AI coding.', 'برمجة بالذكاء.', 'https://github.com/copilot', '💻', cats[5][0], 1],
    [uuidv4(), 'ChatPDF', 'شات بي دي اف', 'Chat with PDFs.', 'دردشة مع PDF.', 'https://chatpdf.com', '📄', cats[6][0], 0],
    [uuidv4(), 'Jasper', 'جاسبر', 'AI marketing.', 'تسويق بالذكاء.', 'https://jasper.ai', '📈', cats[7][0], 1],
  ];
  for (const t of tools) {
    await run('INSERT INTO ai_tools (id, name, name_ar, description, description_ar, url, icon, category_id, is_premium) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', t);
  }

  console.log('Done!');
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });