// --- Tenor GIF API Key ---
const TENOR_API_KEY = 'AIzaSyCnoEuNR2jhVdXVu78x1SAb1V9VLgFMye8'; // Replace with your actual key

// Firebase Modular SDK Imports
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
    getAuth,
    signInWithCustomToken,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    updateProfile,
    signOut
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    collection,
    query,
    where,
    getDocs,
    onSnapshot,
    addDoc,
    orderBy,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// App Configuration
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = {
    apiKey: "AIzaSyBkU8GgOP09YYfOmdvpypPRoXYk-SUFqWI",
    authDomain: "chatting-87797.firebaseapp.com",
    projectId: "chatting-87797",
    appId: "1:767603735256:web:14bf5c7696fa3f7e1835ad",
};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Global State
let currentUserId = null;
let currentDisplayName = null;
let currentUserEmail = null;
let selectedFriendId = null;
let selectedFriendDisplayName = null;
let unsubscribeFriends = null;
let unsubscribeMessages = null;

// DOM Elements
const getEl = id => document.getElementById(id);
const authSection = getEl('auth');
const chatSection = getEl('chat');
const emailInput = getEl('email');
const passwordInput = getEl('password');
const usernameInput = getEl('username');
const authStatusMessage = getEl('authStatusMessage');
const chatStatusMessage = getEl('chatStatusMessage');
const friendsStatusMessage = getEl('friendsStatusMessage');
const currentUserIdDisplay = getEl('currentUserIdDisplay');
const friendsListDiv = getEl('friendsList');
const messagesDiv = getEl('messages');
const messageInput = getEl('messageInput');
const settingsModal = getEl('settingsModal');
const newUsernameInput = getEl('newUsername');

// Buttons
const loginButton = getEl('loginButton');
const registerButton = getEl('registerButton');
const logoutButton = getEl('logoutButton');
const addFriendButton = getEl('addFriendButton');
const sendMessageButton = getEl('sendMessageButton');
const createGroupButton = getEl('createGroupButton');
const openSettingsButton = getEl('openSettingsButton');
const saveSettingsButton = getEl('saveSettingsButton');
const cancelSettingsButton = getEl('cancelSettingsButton');

// Show status message
function showMessage(el, msg, type = 'info') {
    if (!el) return;
    el.textContent = msg;
    el.style.color = type === 'error' ? 'red' : type === 'success' ? 'green' : 'gray';
    setTimeout(() => (el.textContent = ''), 5000);
}

// Toggle auth/chat UI
function toggleUI(loggedIn) {
    if (loggedIn) {
        authSection.classList.add('hidden');
        chatSection.classList.remove('hidden');
        getEl('chatHeader').textContent = `Welcome, ${currentDisplayName || currentUserEmail || 'User'}!`;
        currentUserIdDisplay.textContent = `Your User ID: ${currentUserId}`;
    } else {
        authSection.classList.remove('hidden');
        chatSection.classList.add('hidden');
        messagesDiv.innerHTML = '<p class="text-text-muted text-sm text-center py-4">Select a friend or start a group chat!</p>';
        friendsListDiv.innerHTML = '<p class="text-text-muted text-sm text-center py-4">No friends added yet. Search for users above!</p>';
    }
}

// Handle Auth Change
onAuthStateChanged(auth, async user => {
    if (user) {
        currentUserId = user.uid;
        currentDisplayName = user.displayName;
        currentUserEmail = user.email;
        await updateProfileData();
        toggleUI(true);
        listenForFriends();
    } else {
        currentUserId = null;
        currentDisplayName = null;
        currentUserEmail = null;
        toggleUI(false);
        unsubscribeListeners();
    }
});

function unsubscribeListeners() {
    if (unsubscribeFriends) unsubscribeFriends();
    if (unsubscribeMessages) unsubscribeMessages();
}

// Profile Sync
async function updateProfileData() {
    const publicProfileRef = doc(db, 'artifacts', appId, 'users', currentUserId, 'profile', 'public');
    await setDoc(publicProfileRef, {
        uid: currentUserId,
        email: currentUserEmail,
        displayName: currentDisplayName || 'Unnamed User',
        photoURL: null,
        lastLogin: new Date().toISOString()
    }, { merge: true });
}

// Login/Register
async function login() {
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    if (!email || !password) return showMessage(authStatusMessage, 'Fill in both fields', 'error');
    try {
        await signInWithEmailAndPassword(auth, email, password);
        showMessage(authStatusMessage, 'Logged in successfully!', 'success');
    } catch (e) {
        showMessage(authStatusMessage, e.message, 'error');
    }
}

async function register() {
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    const username = usernameInput.value.trim();
    if (!email || !password || !username) return showMessage(authStatusMessage, 'Complete all fields', 'error');
    if (password.length < 6) return showMessage(authStatusMessage, 'Password too short', 'error');
    try {
        const { user } = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(user, { displayName: username });
        currentDisplayName = username;
        await updateProfileData();
        showMessage(authStatusMessage, 'Registered and logged in!', 'success');
    } catch (e) {
        showMessage(authStatusMessage, e.message, 'error');
    }
}

async function logout() {
    try {
        await signOut(auth);
        showMessage(chatStatusMessage, 'Logged out', 'success');
    } catch (e) {
        showMessage(chatStatusMessage, e.message, 'error');
    }
}

// Event Bindings
addEventListener('DOMContentLoaded', () => {
    loginButton?.addEventListener('click', login);
    registerButton?.addEventListener('click', register);
    logoutButton?.addEventListener('click', logout);
    openSettingsButton?.addEventListener('click', () => settingsModal.classList.remove('hidden'));
    cancelSettingsButton?.addEventListener('click', () => settingsModal.classList.add('hidden'));
});
