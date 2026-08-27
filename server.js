const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const SECRET = process.env.JWT_SECRET || 'nexora-secret-2026';
const PORT = process.env.PORT || 5003;

// إعداد الاتصال بقاعدة بيانات Supabase
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:Fashion123H654%40@db.rsiehsowkgygsmqlmlte.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

// Auth Middleware
function auth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const token = authHeader.split(' ')[1];
    req.user = jwt.verify(token, SECRET);
    next();
  } catch { 
    res.status(401).json({ success: false, message: 'Unauthorized' }); 
  }
}

// ---------------------- Routes ----------------------

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, fullName } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const newUser = await pool.query(
      'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role',
      [email, passwordHash, 'USER']
    );
    const user = newUser.rows[0];

    await pool.query(
      'INSERT INTO profiles (user_id, full_name) VALUES ($1, $2)',
      [user.id, fullName || email.split('@')[0]]
    );

    const token = jwt.sign({ userId: user.id, email: user.email }, SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      message: 'Account created successfully!',
      data: {
        accessToken: token,
        user: { id: user.id, email: user.email, role: user.role, profile: { full_name: fullName || email.split('@')[0] } }
      }
    });
  } catch (e) {
    console.error('Register error:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, username, password } = req.body;
    const userEmail = email || username;

    if (!userEmail || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [userEmail]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const user = userResult.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const profileResult = await pool.query('SELECT full_name FROM profiles WHERE user_id = $1', [user.id]);
    const profile = profileResult.rows[0] || { full_name: user.email.split('@')[0] };

    const token = jwt.sign({ userId: user.id, email: user.email }, SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      message: 'Login successful!',
      data: { accessToken: token, user: { id: user.id, email: user.email, role: user.role, profile } }
    });
  } catch (e) {
    console.error('Login error:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

// Check auth
app.get('/api/auth/me', auth, async (req, res) => {
  try {
    const userResult = await pool.query('SELECT id, email, role FROM users WHERE id = $1', [req.user.userId]);
    if (userResult.rows.length === 0) return res.status(404).json({ success: false });

    const user = userResult.rows[0];
    const profileResult = await pool.query('SELECT full_name FROM profiles WHERE user_id = $1', [user.id]);
    const profile = profileResult.rows[0] || { full_name: user.email.split('@')[0] };

    res.json({ success: true, data: { ...user, profile } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.get('/api/health', (req, res) => res.json({ success: true, message: 'Running' }));
app.get('/favicon.ico', (req, res) => res.status(204).end());

app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(indexPath)) res.sendFile(indexPath);
  else res.send('<h1>Nexora AI Server Running</h1>');
});

app.listen(PORT, () => console.log('NEXORA SERVER RUNNING ON PORT ' + PORT));
