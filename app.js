// ============================================================
// Firebase Configuration — replace with your real values
// ============================================================
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Current user data
let currentUser = null;
let typingTimeout = null;

// DOM Elements
const loginScreen       = document.getElementById('loginScreen');
const chatScreen        = document.getElementById('chatScreen');
const usernameInput     = document.getElementById('usernameInput');
const joinBtn           = document.getElementById('joinBtn');
const logoutBtn         = document.getElementById('logoutBtn');
const messageForm       = document.getElementById('messageForm');
const messageInput      = document.getElementById('messageInput');
const messagesContainer = document.getElementById('messagesContainer');
const usersList         = document.getElementById('usersList');
const onlineCount       = document.getElementById('onlineCount');
const userNameEl        = document.getElementById('userName');
const userAvatarEl      = document.getElementById('userAvatar');
const typingIndicator   = document.getElementById('typingIndicator');
const searchUsers       = document.getElementById('searchUsers');
const clearChatBtn      = document.getElementById('clearChatBtn');

// ── Join Chat ────────────────────────────────────────────────
joinBtn.addEventListener('click', () => joinChat());
usernameInput.addEventListener('keydown', e => { if (e.key === 'Enter') joinChat(); });

function joinChat() {
    const name = usernameInput.value.trim();
    if (!name) { showLoginError('Please enter a username.'); return; }
    if (name.length < 2) { showLoginError('Username must be at least 2 characters.'); return; }
    if (name.length > 24) { showLoginError('Username must be 24 characters or less.'); return; }

    const uid = 'user_' + Math.random().toString(36).slice(2, 11);

    currentUser = { uid, name };
    sessionStorage.setItem('chatUser', JSON.stringify(currentUser));
    startSession();
}

function showLoginError(msg) {
    let el = document.getElementById('loginError');
    if (!el) {
        el = document.createElement('p');
        el.id = 'loginError';
        el.style.cssText = 'color:#ef4444;font-size:0.88rem;margin-top:0.75rem;text-align:center;';
        joinBtn.insertAdjacentElement('afterend', el);
    }
    el.textContent = msg;
}

// ── Restore session on page load ─────────────────────────────
window.addEventListener('load', () => {
    const saved = sessionStorage.getItem('chatUser');
    if (saved) {
        currentUser = JSON.parse(saved);
        startSession();
    } else {
        showLoginScreen();
    }
});

function startSession() {
    showChatScreen();
    setupUserPresence();
    loadMessages();
    loadOnlineUsers();
}

// ── Logout ───────────────────────────────────────────────────
logoutBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to logout?')) {
        await database.ref(`users/${currentUser.uid}`).update({
            online: false,
            lastSeen: firebase.database.ServerValue.TIMESTAMP
        });
        database.ref(`typing/${currentUser.uid}`).remove();
        database.ref('messages').off();
        database.ref('users').off();
        database.ref('typing').off();
        sessionStorage.removeItem('chatUser');
        currentUser = null;
        messagesContainer.innerHTML = '';
        showLoginScreen();
    }
});

// ── User Presence ────────────────────────────────────────────
function setupUserPresence() {
    const userRef = database.ref(`users/${currentUser.uid}`);

    userRef.set({
        uid: currentUser.uid,
        name: currentUser.name,
        online: true,
        lastSeen: firebase.database.ServerValue.TIMESTAMP
    });

    userRef.onDisconnect().update({
        online: false,
        lastSeen: firebase.database.ServerValue.TIMESTAMP
    });

    userNameEl.textContent = currentUser.name;
    userAvatarEl.src = avatarUrl(currentUser.name);
}

// ── Online Users ─────────────────────────────────────────────
function loadOnlineUsers() {
    database.ref('users').on('value', snapshot => {
        const users = snapshot.val();
        const online = [];
        if (users) {
            Object.values(users).forEach(u => {
                if (u.online && u.uid !== currentUser.uid) online.push(u);
            });
        }
        displayOnlineUsers(online);
    });
}

function displayOnlineUsers(users) {
    onlineCount.textContent = users.length;
    if (users.length === 0) {
        usersList.innerHTML = `<div class="empty-state" style="padding:2rem 0;"><p>No other users online</p></div>`;
        return;
    }
    usersList.innerHTML = users.map(u => `
        <div class="user-item">
            <img src="${avatarUrl(u.name)}" alt="${escapeHtml(u.name)}" class="avatar">
            <div class="user-item-info">
                <h4>${escapeHtml(u.name)}</h4>
                <p>Active now</p>
            </div>
            <div class="online-badge"></div>
        </div>
    `).join('');
}

searchUsers.addEventListener('input', e => {
    const term = e.target.value.toLowerCase();
    document.querySelectorAll('.user-item').forEach(item => {
        item.style.display = item.querySelector('h4').textContent.toLowerCase().includes(term) ? 'flex' : 'none';
    });
});

// ── Send Message ─────────────────────────────────────────────
messageForm.addEventListener('submit', async e => {
    e.preventDefault();
    const message = messageInput.value.trim();
    if (!message) return;

    await database.ref('messages').push({
        text: message,
        userId: currentUser.uid,
        userName: currentUser.name,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });

    messageInput.value = '';
    database.ref(`typing/${currentUser.uid}`).remove();
});

// ── Typing Indicator ─────────────────────────────────────────
messageInput.addEventListener('input', () => {
    clearTimeout(typingTimeout);
    if (messageInput.value.length > 0) {
        database.ref(`typing/${currentUser.uid}`).set({
            name: currentUser.name,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        typingTimeout = setTimeout(() => {
            database.ref(`typing/${currentUser.uid}`).remove();
        }, 3000);
    } else {
        database.ref(`typing/${currentUser.uid}`).remove();
    }
});

database.ref('typing').on('value', snapshot => {
    const typing = snapshot.val();
    const names = [];
    if (typing) {
        Object.entries(typing).forEach(([uid, data]) => {
            if (uid !== currentUser?.uid) names.push(data.name);
        });
    }
    if (names.length > 0) {
        const extra = names.length > 2 ? ` and ${names.length - 2} others` : '';
        typingIndicator.textContent = names.length === 1
            ? `${names[0]} is typing...`
            : `${names.slice(0, 2).join(', ')}${extra} are typing...`;
    } else {
        typingIndicator.textContent = '';
    }
});

// ── Load & Display Messages ───────────────────────────────────
function loadMessages() {
    messagesContainer.innerHTML = '';
    database.ref('messages').limitToLast(50).on('child_added', snapshot => {
        displayMessage(snapshot.val());
        scrollToBottom();
    });
}

function displayMessage(message) {
    const isOwn = message.userId === currentUser.uid;
    const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const div = document.createElement('div');
    div.className = `message ${isOwn ? 'own' : ''}`;
    div.innerHTML = `
        <img src="${avatarUrl(message.userName)}" alt="${escapeHtml(message.userName)}" class="avatar">
        <div class="message-content">
            <div class="message-header">
                <span class="message-author">${escapeHtml(message.userName)}</span>
                <span class="message-time">${time}</span>
            </div>
            <div class="message-bubble">${escapeHtml(message.text)}</div>
        </div>
    `;
    messagesContainer.appendChild(div);
}

// ── Clear Chat ────────────────────────────────────────────────
clearChatBtn.addEventListener('click', async () => {
    if (confirm('Clear all messages? This cannot be undone.')) {
        await database.ref('messages').remove();
        messagesContainer.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                <h3>No messages yet</h3>
                <p>Start the conversation!</p>
            </div>`;
    }
});

// ── Emoji Button ──────────────────────────────────────────────
document.querySelector('.emoji-btn').addEventListener('click', () => {
    const emojis = ['😊', '😂', '❤️', '👍', '🎉', '🔥', '✨', '💯', '😎', '🙌'];
    messageInput.value += emojis[Math.floor(Math.random() * emojis.length)];
    messageInput.focus();
});

// ── Visibility / Presence ─────────────────────────────────────
document.addEventListener('visibilitychange', () => {
    if (currentUser) {
        database.ref(`users/${currentUser.uid}`).update({ online: !document.hidden });
    }
});

// ── Utility Functions ─────────────────────────────────────────
function showLoginScreen() {
    loginScreen.classList.add('active');
    chatScreen.classList.remove('active');
}

function showChatScreen() {
    loginScreen.classList.remove('active');
    chatScreen.classList.add('active');
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
}

function avatarUrl(name) {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff&bold=true`;
}

// Init empty state
messagesContainer.innerHTML = `
    <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        <h3>No messages yet</h3>
        <p>Be the first to say hello!</p>
    </div>`;
