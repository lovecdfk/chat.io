// Firebase Configuration
// ============================================================
// STEP 1: Go to https://console.firebase.google.com
// STEP 2: Create a project (or open existing one)
// STEP 3: Click the </> Web icon to register your app
// STEP 4: Copy your config values below
// STEP 5: In Firebase Console → Authentication → Sign-in method
//         → Enable "Google" provider
// STEP 6: In Firebase Console → Realtime Database → Create database
// STEP 7: Add your domain to Authentication → Settings → Authorized domains
// ============================================================
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",               // <- Replace this
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com", // <- Replace YOUR_PROJECT_ID
    databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com", // <- Replace YOUR_PROJECT_ID
    projectId: "YOUR_PROJECT_ID",         // <- Replace this
    storageBucket: "YOUR_PROJECT_ID.appspot.com",  // <- Replace YOUR_PROJECT_ID
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID", // <- Replace this
    appId: "YOUR_APP_ID"                  // <- Replace this
};

// Validate config before initializing
const configIncomplete = Object.values(firebaseConfig).some(v => v.includes("YOUR_"));
if (configIncomplete) {
    document.body.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0f172a;font-family:sans-serif;">
            <div style="background:#1e293b;padding:2.5rem;border-radius:16px;max-width:500px;text-align:center;border:1px solid #ef4444;">
                <div style="font-size:3rem;margin-bottom:1rem;">🔧</div>
                <h2 style="color:#f1f5f9;margin-bottom:1rem;">Firebase Setup Required</h2>
                <p style="color:#94a3b8;margin-bottom:1.5rem;line-height:1.6;">
                    You need to add your Firebase credentials to <code style="background:#0f172a;padding:2px 6px;border-radius:4px;color:#818cf8;">app.js</code> before the app will work.
                </p>
                <ol style="color:#94a3b8;text-align:left;line-height:2;padding-left:1.5rem;">
                    <li>Go to <a href="https://console.firebase.google.com" target="_blank" style="color:#818cf8;">console.firebase.google.com</a></li>
                    <li>Create or open your project</li>
                    <li>Register a Web app (&lt;/&gt; icon)</li>
                    <li>Copy the config into <strong style="color:#f1f5f9;">app.js</strong></li>
                    <li>Enable <strong style="color:#f1f5f9;">Google</strong> in Authentication → Sign-in method</li>
                    <li>Enable <strong style="color:#f1f5f9;">Realtime Database</strong></li>
                </ol>
            </div>
        </div>
    `;
    throw new Error("Firebase config not set. Please replace placeholder values in app.js.");
}

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();

// Google Auth Provider
const googleProvider = new firebase.auth.GoogleAuthProvider();

// Current user data
let currentUser = null;
let typingTimeout = null;

// DOM Elements
const loginScreen = document.getElementById('loginScreen');
const chatScreen = document.getElementById('chatScreen');
const googleSignInBtn = document.getElementById('googleSignInBtn');
const logoutBtn = document.getElementById('logoutBtn');
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');
const messagesContainer = document.getElementById('messagesContainer');
const usersList = document.getElementById('usersList');
const onlineCount = document.getElementById('onlineCount');
const userName = document.getElementById('userName');
const userAvatar = document.getElementById('userAvatar');
const typingIndicator = document.getElementById('typingIndicator');
const searchUsers = document.getElementById('searchUsers');
const clearChatBtn = document.getElementById('clearChatBtn');

// Authentication State Observer
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = {
            uid: user.uid,
            name: user.displayName,
            email: user.email,
            photoURL: user.photoURL
        };
        
        showChatScreen();
        setupUserPresence();
        loadMessages();
        loadOnlineUsers();
    } else {
        showLoginScreen();
    }
});

// Show a styled error message on the login card
function showAuthError(message) {
    let errorEl = document.getElementById('authError');
    if (!errorEl) {
        errorEl = document.createElement('div');
        errorEl.id = 'authError';
        errorEl.style.cssText = `
            background: #fef2f2;
            border: 1px solid #fecaca;
            color: #dc2626;
            padding: 0.85rem 1rem;
            border-radius: 10px;
            font-size: 0.88rem;
            line-height: 1.5;
            margin-top: 1rem;
            text-align: left;
        `;
        document.querySelector('.login-card').appendChild(errorEl);
    }
    errorEl.textContent = message;
    errorEl.style.display = 'block';
}

// Google Sign In
googleSignInBtn.addEventListener('click', async () => {
    try {
        googleSignInBtn.disabled = true;
        googleSignInBtn.innerHTML = '<div class="loading"></div> Signing in...';

        // Hide any previous error
        const prevError = document.getElementById('authError');
        if (prevError) prevError.style.display = 'none';
        
        await auth.signInWithPopup(googleProvider);
    } catch (error) {
        console.error('Sign in error:', error);

        // Friendly error messages for common auth errors
        const errorMessages = {
            'auth/popup-blocked':
                '⚠️ Popup was blocked. Please allow popups for this site and try again.',
            'auth/popup-closed-by-user':
                '⚠️ Sign-in was cancelled. Please try again.',
            'auth/unauthorized-domain':
                '⚠️ This domain is not authorized. In Firebase Console → Authentication → Settings → Authorized domains, add this site\'s domain.',
            'auth/operation-not-allowed':
                '⚠️ Google sign-in is disabled. Go to Firebase Console → Authentication → Sign-in method and enable Google.',
            'auth/network-request-failed':
                '⚠️ Network error. Please check your internet connection.',
            'auth/invalid-api-key':
                '⚠️ Invalid API key. Check your firebaseConfig values in app.js.',
            'auth/app-not-authorized':
                '⚠️ App not authorized. Check your API key and authorized domains in Firebase Console.',
        };

        const friendlyMessage = errorMessages[error.code] || `⚠️ Sign in failed: ${error.message}`;
        showAuthError(friendlyMessage);

        googleSignInBtn.disabled = false;
        googleSignInBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="20" height="20">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google`;
    }
});

// Logout
logoutBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to logout?')) {
        try {
            // Update presence to offline
            await database.ref(`users/${currentUser.uid}`).update({
                online: false,
                lastSeen: firebase.database.ServerValue.TIMESTAMP
            });
            
            await auth.signOut();
        } catch (error) {
            console.error('Logout error:', error);
            alert('Logout failed: ' + error.message);
        }
    }
});

// Setup User Presence
function setupUserPresence() {
    const userRef = database.ref(`users/${currentUser.uid}`);
    
    // Set user data
    userRef.set({
        uid: currentUser.uid,
        name: currentUser.name,
        email: currentUser.email,
        photoURL: currentUser.photoURL,
        online: true,
        lastSeen: firebase.database.ServerValue.TIMESTAMP
    });
    
    // Handle disconnect
    userRef.onDisconnect().update({
        online: false,
        lastSeen: firebase.database.ServerValue.TIMESTAMP
    });
    
    // Update UI
    userName.textContent = currentUser.name;
    userAvatar.src = currentUser.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(currentUser.name);
}

// Load Online Users
function loadOnlineUsers() {
    const usersRef = database.ref('users');
    
    usersRef.on('value', snapshot => {
        const users = snapshot.val();
        const onlineUsers = [];
        
        if (users) {
            Object.values(users).forEach(user => {
                if (user.online && user.uid !== currentUser.uid) {
                    onlineUsers.push(user);
                }
            });
        }
        
        displayOnlineUsers(onlineUsers);
    });
}

// Display Online Users
function displayOnlineUsers(users) {
    onlineCount.textContent = users.length;
    
    if (users.length === 0) {
        usersList.innerHTML = `
            <div class="empty-state" style="padding: 2rem 0;">
                <p>No other users online</p>
            </div>
        `;
        return;
    }
    
    usersList.innerHTML = users.map(user => `
        <div class="user-item">
            <img src="${user.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.name)}" 
                 alt="${user.name}" 
                 class="avatar">
            <div class="user-item-info">
                <h4>${user.name}</h4>
                <p>Active now</p>
            </div>
            <div class="online-badge"></div>
        </div>
    `).join('');
}

// Search Users
searchUsers.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const userItems = document.querySelectorAll('.user-item');
    
    userItems.forEach(item => {
        const name = item.querySelector('h4').textContent.toLowerCase();
        item.style.display = name.includes(searchTerm) ? 'flex' : 'none';
    });
});

// Send Message
messageForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const message = messageInput.value.trim();
    if (!message) return;
    
    try {
        const messageData = {
            text: message,
            userId: currentUser.uid,
            userName: currentUser.name,
            userPhoto: currentUser.photoURL,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };
        
        await database.ref('messages').push(messageData);
        messageInput.value = '';
        
        // Clear typing indicator
        database.ref(`typing/${currentUser.uid}`).remove();
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message');
    }
});

// Typing Indicator
messageInput.addEventListener('input', () => {
    const isTyping = messageInput.value.length > 0;
    
    clearTimeout(typingTimeout);
    
    if (isTyping) {
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

// Listen to Typing Indicators
database.ref('typing').on('value', snapshot => {
    const typing = snapshot.val();
    const typingUsers = [];
    
    if (typing) {
        Object.entries(typing).forEach(([uid, data]) => {
            if (uid !== currentUser.uid) {
                typingUsers.push(data.name);
            }
        });
    }
    
    if (typingUsers.length > 0) {
        const text = typingUsers.length === 1 
            ? `${typingUsers[0]} is typing...`
            : `${typingUsers.slice(0, 2).join(', ')} ${typingUsers.length > 2 ? `and ${typingUsers.length - 2} others` : ''} are typing...`;
        typingIndicator.textContent = text;
    } else {
        typingIndicator.textContent = '';
    }
});

// Load Messages
function loadMessages() {
    const messagesRef = database.ref('messages').limitToLast(50);
    
    messagesRef.on('child_added', snapshot => {
        const message = snapshot.val();
        displayMessage(message);
        scrollToBottom();
    });
}

// Display Message
function displayMessage(message) {
    const isOwn = message.userId === currentUser.uid;
    const time = new Date(message.timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isOwn ? 'own' : ''}`;
    messageDiv.innerHTML = `
        <img src="${message.userPhoto || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(message.userName)}" 
             alt="${message.userName}" 
             class="avatar">
        <div class="message-content">
            <div class="message-header">
                <span class="message-author">${message.userName}</span>
                <span class="message-time">${time}</span>
            </div>
            <div class="message-bubble">
                ${escapeHtml(message.text)}
            </div>
        </div>
    `;
    
    messagesContainer.appendChild(messageDiv);
}

// Clear Chat
clearChatBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear all messages? This cannot be undone.')) {
        try {
            await database.ref('messages').remove();
            messagesContainer.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                    <h3>No messages yet</h3>
                    <p>Start the conversation!</p>
                </div>
            `;
        } catch (error) {
            console.error('Error clearing chat:', error);
            alert('Failed to clear chat');
        }
    }
});

// Emoji Button (Simple implementation - can be expanded)
document.querySelector('.emoji-btn').addEventListener('click', () => {
    const emojis = ['😊', '😂', '❤️', '👍', '🎉', '🔥', '✨', '💯'];
    const emoji = emojis[Math.floor(Math.random() * emojis.length)];
    messageInput.value += emoji;
    messageInput.focus();
});

// Utility Functions
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
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Handle page visibility for presence
document.addEventListener('visibilitychange', () => {
    if (currentUser) {
        database.ref(`users/${currentUser.uid}`).update({
            online: !document.hidden
        });
    }
});

// Auto-scroll when new messages arrive
messagesContainer.addEventListener('DOMNodeInserted', () => {
    const isScrolledToBottom = messagesContainer.scrollHeight - messagesContainer.clientHeight <= messagesContainer.scrollTop + 100;
    if (isScrolledToBottom) {
        scrollToBottom();
    }
});

// Initialize empty state
messagesContainer.innerHTML = `
    <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        <h3>No messages yet</h3>
        <p>Be the first to say hello!</p>
    </div>
`;
