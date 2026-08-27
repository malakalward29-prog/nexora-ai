const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const SECRET = process.env.JWT_SECRET || 'nexora-secret-2026';
const PORT = process.env.PORT || 5003;

// ---------------------- Auth Middlewares ----------------------
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

function optAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.split(' ')[1];
      req.userId = jwt.verify(token, SECRET).userId;
    }
  } catch {}
  next();
}

// ---------------------- Authentication Routes ----------------------

// Register Route
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, fullName } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const userId = uuidv4();
    const token = jwt.sign({ userId, email }, SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      message: 'Account created successfully!',
      data: {
        accessToken: token,
        user: {
          id: userId,
          email: email,
          role: 'USER',
          profile: { full_name: fullName || email.split('@')[0] }
        }
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Login Route
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, username, password } = req.body;
    const userEmail = email || username;

    if (!userEmail || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const userId = uuidv4();
    const token = jwt.sign({ userId, email: userEmail }, SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      message: 'Login successful!',
      data: {
        accessToken: token,
        user: {
          id: userId,
          email: userEmail,
          role: 'USER',
          profile: { full_name: userEmail.split('@')[0] }
        }
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Check Session / Current User
app.get('/api/auth/me', auth, async (req, res) => {
  res.json({
    success: true,
    data: {
      id: req.user.userId,
      email: req.user.email || 'user@nexora.ai',
      role: 'USER',
      profile: { full_name: (req.user.email || 'User').split('@')[0] }
    }
  });
});

// ---------------------- General APIs ----------------------

app.get('/api/health', (req, res) => res.json({ success: true, message: 'Running' }));
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Serve HTML with embedded API script
app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send('<h1>Nexora AI Server Running</h1>');
  }
});

// Start Server
app.listen(PORT, () => {
  console.log('============================================');
  console.log('      NEXORA AI SERVER RUNNING ON PORT ' + PORT);
  console.log('============================================');
});
