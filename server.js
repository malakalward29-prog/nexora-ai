const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { run, get, all } = require('./database');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const SECRET = 'nexora-secret-2026';

// Create default admin user if not exists
async function createAdminUser() {
  try {
    const admin = await get('SELECT * FROM users WHERE email = ?', ['admin@nexora.ai']);
    if (!admin) {
      const id = uuidv4();
      const hash = await bcrypt.hash('Admin@2026', 12);
      await run('INSERT INTO users (id, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?)', 
        [id, 'admin@nexora.ai', hash, 'ADMIN', 'active']);
      await run('INSERT INTO profiles (id, user_id, full_name) VALUES (?, ?, ?)', 
        [uuidv4(), id, 'Administrator']);
      console.log('   [✓] Admin user created: admin@nexora.ai / Admin@2026');
    } else {
      console.log('   [✓] Admin user already exists');
    }
  } catch (e) {
    console.log('   [!] Admin setup error:', e.message);
  }
}

function auth(req, res, next) {
  try {
    const token = req.headers.authorization.split(' ')[1];
    req.user = jwt.verify(token, SECRET);
    next();
  } catch { res.status(401).json({ success: false, message: 'Unauthorized' }); }
}

function optAuth(req, res, next) {
  try {
    const token = req.headers.authorization.split(' ')[1];
    req.userId = jwt.verify(token, SECRET).userId;
  } catch {}
  next();
}

// API Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, fullName } = req.body;
    const id = uuidv4();
    const hash = await bcrypt.hash(password, 12);
    await run('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)', [id, email, hash]);
    await run('INSERT INTO profiles (id, user_id, full_name) VALUES (?, ?, ?)', [uuidv4(), id, fullName || '']);
    const token = jwt.sign({ userId: id }, SECRET, { expiresIn: '15m' });
    res.json({ success: true, data: { user: { id, email }, accessToken: token } });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const u = await get('SELECT * FROM users WHERE email = ?', [email]);
    if (!u || !(await bcrypt.compare(password, u.password_hash)))
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    const token = jwt.sign({ userId: u.id }, SECRET, { expiresIn: '15m' });
    const profile = await get('SELECT * FROM profiles WHERE user_id = ?', [u.id]);
    res.json({ success: true, data: { user: { id: u.id, email: u.email, role: u.role, profile }, accessToken: token } });
  } catch(e) { res.status(500).json({ success: false }); }
});

app.get('/api/auth/me', auth, async (req, res) => {
  const u = await get('SELECT id, email, role, status, email_verified FROM users WHERE id = ?', [req.user.userId]);
  const p = await get('SELECT * FROM profiles WHERE user_id = ?', [req.user.userId]);
  res.json({ success: true, data: { ...u, profile: p } });
});

app.get('/api/tools', async (req, res) => {
  const lang = req.headers['accept-language']?.startsWith('ar') ? 'ar' : 'en';
  const tools = await all('SELECT t.*, c.name_en, c.name_ar, c.slug, c.icon FROM ai_tools t JOIN categories c ON t.category_id = c.id WHERE t.is_active = 1 ORDER BY t.click_count DESC', []);
  res.json({ success: true, data: tools.map(t => ({
    id: t.id, name: lang === 'ar' && t.name_ar ? t.name_ar : t.name,
    description: lang === 'ar' && t.description_ar ? t.description_ar : t.description,
    url: t.url, icon: t.icon, isPremium: !!t.is_premium,
    category: { name: lang === 'ar' && t.name_ar ? t.name_ar : t.name_en, slug: t.slug, icon: t.icon }
  })) });
});

app.get('/api/tools/:id', optAuth, async (req, res) => {
  const t = await get('SELECT t.*, c.name_en, c.name_ar FROM ai_tools t JOIN categories c ON t.category_id = c.id WHERE t.id = ?', [req.params.id]);
  if (!t) return res.status(404).json({ success: false });
  let fav = false;
  if (req.userId) fav = !!(await get('SELECT id FROM favorites WHERE user_id = ? AND tool_id = ?', [req.userId, req.params.id]));
  res.json({ success: true, data: { ...t, isFavorited: fav } });
});

app.post('/api/tools/:id/click', optAuth, async (req, res) => {
  const t = await get('SELECT * FROM ai_tools WHERE id = ?', [req.params.id]);
  if (!t) return res.status(404).json({ success: false });
  await run('UPDATE ai_tools SET click_count = click_count + 1 WHERE id = ?', [req.params.id]);
  res.json({ success: true, data: { url: t.url } });
});

app.get('/api/categories', async (req, res) => {
  const cats = await all('SELECT c.*, (SELECT COUNT(*) FROM ai_tools WHERE category_id = c.id) as count FROM categories c WHERE is_active = 1', []);
  res.json({ success: true, data: cats });
});

app.get('/api/favorites', auth, async (req, res) => {
  const favs = await all('SELECT f.*, t.name, t.url, t.icon FROM favorites f JOIN ai_tools t ON f.tool_id = t.id WHERE f.user_id = ?', [req.user.userId]);
  res.json({ success: true, data: favs });
});

app.post('/api/favorites', auth, async (req, res) => {
  const { toolId } = req.body;
  const ex = await get('SELECT id FROM favorites WHERE user_id = ? AND tool_id = ?', [req.user.userId, toolId]);
  if (!ex) await run('INSERT INTO favorites (id, user_id, tool_id) VALUES (?, ?, ?)', [uuidv4(), req.user.userId, toolId]);
  res.json({ success: true });
});

app.delete('/api/favorites/:toolId', auth, async (req, res) => {
  await run('DELETE FROM favorites WHERE user_id = ? AND tool_id = ?', [req.user.userId, req.params.toolId]);
  res.json({ success: true });
});

app.get('/api/user/profile', auth, async (req, res) => {
  const u = await get('SELECT id, email, role FROM users WHERE id = ?', [req.user.userId]);
  const p = await get('SELECT * FROM profiles WHERE user_id = ?', [req.user.userId]);
  const f = await get('SELECT COUNT(*) as c FROM favorites WHERE user_id = ?', [req.user.userId]);
  res.json({ success: true, data: { ...u, profile: p, stats: { favoritesCount: f.c } } });
});

app.put('/api/user/profile', auth, async (req, res) => {
  const { fullName, language } = req.body;
  await run('UPDATE profiles SET full_name = ?, language = ? WHERE user_id = ?', [fullName, language, req.user.userId]);
  res.json({ success: true });
});

app.get('/api/admin/dashboard', auth, async (req, res) => {
  const u = await get('SELECT role FROM users WHERE id = ?', [req.user.userId]);
  if (u.role !== 'ADMIN') return res.status(403).json({ success: false });
  const users = await get('SELECT COUNT(*) as c FROM users');
  const tools = await get('SELECT COUNT(*) as c FROM ai_tools');
  const clicks = await get('SELECT COUNT(*) as c FROM affiliate_clicks');
  res.json({ success: true, data: { stats: { totalUsers: users.c, totalTools: tools.c, totalClicks: clicks.c } } });
});

app.get('/api/health', (req, res) => res.json({ success: true, message: 'Running' }));

// Serve HTML with embedded API script
app.get('/', (req, res) => {
  let html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
  const apiScript = `<script>
const API_BASE=window.location.origin+'/api';
let authToken=localStorage.getItem('nexora_token');
let currentUser=null;
async function api(endpoint,options={}){
  options=options||{};
  const url=API_BASE+endpoint;
  const headers={'Content-Type':'application/json'};
  if(authToken)headers['Authorization']='Bearer '+authToken;
  const config={method:options.method||'GET',headers:headers};
  if(options.body)config.body=JSON.stringify(options.body);
  const res=await fetch(url,config);
  return await res.json();
}
async function checkAuth(){
  if(!authToken)return;
  try{
    const data=await api('/auth/me');
    if(data.success){currentUser=data.data;updateUIForUser();}
  }catch(e){localStorage.removeItem('nexora_token');authToken=null;}
}
function updateUIForUser(){
  if(!currentUser)return;
  const nav=document.querySelector('.nav-actions');
  if(nav)nav.innerHTML='<button class="btn btn-dark" onclick="toggleLanguage()">EN</button><button class="btn btn-dark" onclick="showProfile()">'+(currentUser.profile&&currentUser.profile.full_name?currentUser.profile.full_name:currentUser.email)+'</button><button class="btn btn-purple" onclick="logout()">Logout</button>';
}
function updateUIForGuest(){
  const nav=document.querySelector('.nav-actions');
  if(nav)nav.innerHTML='<button class="btn btn-dark" onclick="toggleLanguage()">EN</button><button class="btn btn-dark login" onclick="openModal(\'login\')">Log in</button><button class="btn btn-purple" onclick="openModal(\'signup\')">Start Free</button>';
}
async function loginUser(email,password){
  const data=await api('/auth/login',{method:'POST',body:{email:email,password:password}});
  if(data.success){
    authToken=data.data.accessToken;currentUser=data.data.user;
    localStorage.setItem('nexora_token',authToken);
    closeModal();updateUIForUser();alert('Login successful! Welcome, '+(currentUser.profile&&currentUser.profile.full_name?currentUser.profile.full_name:currentUser.email));
  }else{alert(data.message||'Invalid credentials');}
}
async function registerUser(email,password,fullName){
  const data=await api('/auth/register',{method:'POST',body:{email:email,password:password,fullName:fullName}});
  if(data.success){
    authToken=data.data.accessToken;currentUser=data.data.user;
    localStorage.setItem('nexora_token',authToken);
    closeModal();updateUIForUser();alert('Account created! Welcome, '+fullName);
  }else{alert(data.message||'Error creating account');}
}
function logout(){
  authToken=null;currentUser=null;
  localStorage.removeItem('nexora_token');
  updateUIForGuest();alert('Logged out successfully');
}
checkAuth();
</script>`;
  html = html.replace('</body>', apiScript + '</body>');
  res.send(html);
});

const PORT = process.env.PORT || 5003;
// مسار تسجيل الدخول
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    // هنا يمكنك إضافة التحقق من بيانات المستخدم من قاعدة البيانات
    if (username === "admin" && password === "123456") {
        return res.json({ success: true, message: "تم تسجيل الدخول بنجاح!" });
    } else {
        return res.status(401).json({ success: false, message: "بيانات الدخول غير صحيحة" });
    }
});
app.listen(PORT, async () => {
  console.log('');
  console.log('  ============================================');
  console.log('       NEXORA AI SERVER RUNNING');
  console.log('  ============================================');
  console.log('   Website: http://localhost:' + PORT);
  console.log('   Admin:   admin@nexora.ai');
  console.log('   Pass:    Admin@2026');
  console.log('  ============================================');
  await createAdminUser();
  console.log('');
});
app.get('/favicon.ico', (req, res) => res.status(204).end());
// تفعيل استقبال الـ JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 1. مسار تسجيل الدخول المطابق لملف index.html
app.post('/api/auth/login', (req, res) => {
    const { email, username, password } = req.body;
    const userIdentifier = email || username;

    console.log("طلب دخول للمستخدم:", userIdentifier);

    // استجابة بنجاح لتجربة الدخول
    return res.json({ 
        success: true, 
        message: "تم تسجيل الدخول بنجاح!",
        data: {
            accessToken: "fake-jwt-token-12345",
            user: { 
                email: userIdentifier, 
                profile: { full_name: userIdentifier.split('@')[0] } 
            }
        }
    });
});

// 2. مسار إنشاء حساب جديد المطابق لملف index.html
app.post('/api/auth/register', (req, res) => {
    const { email, password, fullName } = req.body;

    return res.json({ 
        success: true, 
        message: "تم إنشاء الحساب بنجاح!",
        data: {
            accessToken: "fake-jwt-token-12345",
            user: { 
                email: email, 
                profile: { full_name: fullName } 
            }
        }
    });
});

// 3. مسار التحقق من الجلسة (Check Auth)
app.get('/api/auth/me', (req, res) => {
    return res.json({
        success: true,
        data: {
            email: "admin@nexora.ai",
            profile: { full_name: "Admin User" }
        }
    });
});
