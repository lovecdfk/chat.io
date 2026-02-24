// Firebase Configuration
// IMPORTANT: Replace these with your own Firebase config
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

// Google Sign In
googleSignInBtn.addEventListener('click', async () => {
    try {
        googleSignInBtn.disabled = true;
        googleSignInBtn.innerHTML = '<div class="loading"></div> Signing in...';
        
        await auth.signInWithPopup(googleProvider);
    } catch (error) {
        console.error('Sign in error:', error);
        alert('Sign in failed: ' + error.message);
        googleSignInBtn.disabled = false;
        googleSignInBtn.innerHTML = 'Continue with Google';
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
