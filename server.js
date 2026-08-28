const http = require('http');
const fs = require('fs');
const path = require('path');

// ذاكرة مؤقتة بسيطة لتخزين المستخدمين (بدون الحاجة لقاعدة بيانات معقدة)
let users = [];
let sessions = {};

const server = http.createServer((req, res) => {
    let filePath = path.join(__dirname, 'public', req.url === '/' ? 'index.html' : req.url);
    
    // API المسارات الخاصة بتسجيل الدخول والخروج والتحقق
    if (req.url.startsWith('/api/')) {
        res.setHeader('Content-Type', 'application/json');
        
        if (req.url === '/api/auth/register' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    const existing = users.find(u => u.email === data.email);
                    if (existing) {
                        res.writeHead(400);
                        res.end(JSON.stringify({ success: false, message: 'Email already exists' }));
                        return;
                    }
                    const newUser = {
                        email: data.email,
                        password: data.password,
                        profile: { full_name: data.fullName }
                    };
                    users.push(newUser);
                    const token = 'token_' + Math.random().toString(36).substring(2);
                    sessions[token] = newUser;
                    res.writeHead(200);
                    res.end(JSON.stringify({ success: true, data: { accessToken: token, user: newUser } }));
                } catch (err) {
                    res.writeHead(400);
                    res.end(JSON.stringify({ success: false, message: 'Invalid data' }));
                }
            });
            return;
        }

        if (req.url === '/api/auth/login' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    const user = users.find(u => u.email === data.email && u.password === data.password);
                    if (!user) {
                        res.writeHead(400);
                        res.end(JSON.stringify({ success: false, message: 'Invalid credentials' }));
                        return;
                    }
                    const token = 'token_' + Math.random().toString(36).substring(2);
                    sessions[token] = user;
                    res.writeHead(200);
                    res.end(JSON.stringify({ success: true, data: { accessToken: token, user: user } }));
                } catch (err) {
                    res.writeHead(400);
                    res.end(JSON.stringify({ success: false, message: 'Invalid data' }));
                }
            });
            return;
        }

        if (req.url === '/api/auth/me') {
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1];
            if (token && sessions[token]) {
                res.writeHead(200);
                res.end(JSON.stringify({ success: true, data: sessions[token] }));
            } else {
                res.writeHead(404);
                res.end(JSON.stringify({ success: false, message: 'Unauthorized' }));
            }
            return;
        }
    }

    // تقديم ملفات الموقع الثابتة (HTML/CSS/JS)
    fs.readFile(filePath, (err, content) => {
        if (err) {
            // في حال لم يجد الملف، يعرض الصفحة الرئيسية افتراضياً
            fs.readFile(path.join(__dirname, 'public', 'index.html'), (err2, content2) => {
                if (err2) {
                    res.writeHead(404);
                    res.end('Page not found');
                } else {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(content2);
                }
            });
        } else {
            let ext = path.extname(filePath);
            let contentType = 'text/html';
            if (ext === '.js') contentType = 'text/javascript';
            if (ext === '.css') contentType = 'text/css';
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
