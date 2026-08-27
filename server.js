const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const SECRET = process.env.JWT_SECRET || 'nexora-secret-2026';
const PORT = process.env.PORT || 5003;

// إعداد Supabase Client المباشر
const SUPABASE_URL = 'https://rsiehsowkgygsmqlmlte.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzaWVoc293a2d5Z3NtcWxtbHRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAwMDAwMDAsImV4cCI6MjA1NTU2MDAwMH0.fake'; 
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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

// ---------------------- API Routes ----------------------

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, fullName } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const { data: user, error: userError } = await supabase
      .from('users')
      .insert([{ email, password_hash: passwordHash, role: 'USER' }])
      .select()
      .single();

    if (userError) {
      return res.status(400).json({ success: false, message: userError.message });
    }

    await supabase
      .from('profiles')
      .insert([{ user_id: user.id, full_name: fullName || email.split('@')[0] }]);

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

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', userEmail)
      .single();

    if (error || !user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', user.id)
      .single();

    const token = jwt.sign({ userId: user.id, email: user.email }, SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      message: 'Login successful!',
      data: {
        accessToken: token,
        user: { id: user.id, email: user.email, role: user.role, profile: profile || { full_name: user.email.split('@')[0] } }
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Check Auth
app.get('/api/auth/me', auth, async (req, res) => {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('id', req.user.userId)
      .single();

    if (!user) return res.status(404).json({ success: false });

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', user.id)
      .single();

    res.json({ success: true, data: { ...user, profile: profile || { full_name: user.email.split('@')[0] } } });
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
