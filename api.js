const API_BASE = 'http://localhost:5001/api';
let authToken = localStorage.getItem('nexora_token');
let currentUser = null;

async function api(endpoint, options) {
  const url = API_BASE + endpoint;
  const config = {
    headers: { 'Content-Type': 'application/json' },
    ...options
  };
  if (authToken) config.headers['Authorization'] = 'Bearer ' + authToken;
  if (config.body) config.body = JSON.stringify(config.body);
  const res = await fetch(url, config);
  return await res.json();
}

async function checkAuth() {
  if (!authToken) return;
  try {
    const data = await api('/auth/me');
    if (data.success) {
      currentUser = data.data;
      updateUIForUser();
    }
  } catch (e) {
    authToken = null;
    localStorage.removeItem('nexora_token');
  }
}

function updateUIForUser() {
  if (!currentUser) return;
  const nav = document.querySelector('.nav-actions');
  if (nav) {
    nav.innerHTML = '<button class="btn btn-dark" onclick="toggleLanguage()">EN</button>' +
      '<button class="btn btn-dark" onclick="showProfile()">' + (currentUser.profile?.full_name || currentUser.email) + '</button>' +
      '<button class="btn btn-purple" onclick="logout()">Logout</button>';
  }
}

function updateUIForGuest() {
  const nav = document.querySelector('.nav-actions');
  if (nav) {
    nav.innerHTML = '<button class="btn btn-dark" onclick="toggleLanguage()">EN</button>' +
      '<button class="btn btn-dark login" onclick="openModal(\'login\')">Log in</button>' +
      '<button class="btn btn-purple" onclick="openModal(\'signup\')">Start Free</button>';
  }
}

async function loginUser(email, password) {
  const data = await api('/auth/login', { method: 'POST', body: { email, password } });
  if (data.success) {
    authToken = data.data.accessToken;
    currentUser = data.data.user;
    localStorage.setItem('nexora_token', authToken);
    closeModal();
    updateUIForUser();
    alert('Login successful!');
  } else {
    alert(data.message || 'Invalid credentials');
  }
}

async function registerUser(email, password, fullName) {
  const data = await api('/auth/register', { method: 'POST', body: { email, password, fullName } });
  if (data.success) {
    authToken = data.data.accessToken;
    currentUser = data.data.user;
    localStorage.setItem('nexora_token', authToken);
    closeModal();
    updateUIForUser();
    alert('Account created!');
  } else {
    alert(data.message || 'Error occurred');
  }
}

function logout() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem('nexora_token');
  updateUIForGuest();
  alert('Logged out');
}

function submitForm() {
  const email = document.getElementById("userEmail").value;
  const password = document.getElementById("userPassword").value;
  if (!email || !password) {
    alert('Please enter email and password');
    return;
  }
  if (currentMode === "signup") {
    const name = document.getElementById("userName").value;
    if (!name) { alert('Please enter your name'); return; }
    registerUser(email, password, name);
  } else {
    loginUser(email, password);
  }
}

checkAuth();