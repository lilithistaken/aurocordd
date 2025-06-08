

// Import Firebase modules. Using the modular SDK.
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
    addDoc, // Needed for adding messages
    orderBy, // Needed for ordering messages by timestamp
    serverTimestamp // Needed for consistent timestamps
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);


// --- Global Variables ---
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';



const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// --- Initialize Firebase services ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
// Firebase Storage initialization removed
// const storage = getStorage(app);


// Global state variables for the current user and active chat
let currentUserId = null;
let currentDisplayName = null;
let currentUserEmail = null;
let currentUserPhotoURL = null; // Still holds value if photoURL is part of auth profile, but won't be set by app
let unsubscribeFriends = null;
let unsubscribeMessages = null;
let selectedFriendId = null;
let selectedFriendDisplayName = null;


// --- UI Element References ---
const authSection = document.getElementById('auth');
const chatSection = document.getElementById('chat');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const usernameInput = document.getElementById('username');
// const pfpInput = document.getElementById('pfp'); // Removed
const authStatusMessage = document.getElementById('authStatusMessage');
const chatStatusMessage = document.getElementById('chatStatusMessage');
const friendsStatusMessage = document.getElementById('friendsStatusMessage');
const currentUserIdDisplay = document.getElementById('currentUserIdDisplay');
const friendsListDiv = document.getElementById('friendsList');
const messagesDiv = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');

// Settings Modal elements
const settingsModal = document.getElementById('settingsModal');
const newUsernameInput = document.getElementById('newUsername');
// const newPfpInput = document.getElementById('newPfp'); // Removed
// const currentProfilePic = document.getElementById('currentProfilePic'); // Removed
const settingsStatusMessage = document.getElementById('settingsStatusMessage');


// Button references
const loginButton = document.getElementById('loginButton');
const registerButton = document.getElementById('registerButton');
const logoutButton = document.getElementById('logoutButton');
const addFriendButton = document.getElementById('addFriendButton');
const sendMessageButton = document.getElementById('sendMessageButton');
const createGroupButton = document.getElementById('createGroupButton');
const openSettingsButton = document.getElementById('openSettingsButton');
const saveSettingsButton = document.getElementById('saveSettingsButton');
const cancelSettingsButton = document.getElementById('cancelSettingsButton');


/**
 * Displays a message to the user in a specified status area.
 * @param {HTMLElement} element - The HTML element to display the message in.
 * @param {string} message - The message text to display.
 * @param {string} type - 'success', 'error', or 'info' to determine message color.
 */
function showMessage(element, message, type) {
    if (!element) {
        console.warn("showMessage: Target element not found.", element);
        return;
    }
    element.textContent = message;
    element.style.color = type === 'error' ? 'red' : (type === 'success' ? 'green' : 'gray');
    setTimeout(() => {
        element.textContent = '';
    }, 5000);
}

/**
 * Toggles the visibility of the authentication and chat sections.
 * @param {boolean} loggedIn - True if the user is logged in, false otherwise.
 */
function toggleUI(loggedIn) {
    console.log(`toggleUI called. loggedIn: ${loggedIn}`);
    if (loggedIn) {
        authSection.classList.add('hidden');
        chatSection.classList.remove('hidden');
        document.getElementById('chatHeader').textContent = `Welcome, ${currentDisplayName || currentUserEmail || 'User'}!`;
        currentUserIdDisplay.textContent = `Your User ID: ${currentUserId}`;

        emailInput.value = '';
        passwordInput.value = '';
        usernameInput.value = '';

        console.log("UI switched to Chat view.");
    } else {
        authSection.classList.remove('hidden');
        chatSection.classList.add('hidden');
        if (messageInput) messageInput.value = '';
        if (messagesDiv) messagesDiv.innerHTML = '<p class="text-text-muted text-sm text-center py-4">Select a friend or start a group chat!</p>';
        if (friendsListDiv) friendsListDiv.innerHTML = '<p class="text-text-muted text-sm text-center py-4">No friends added yet. Search for users above!</p>';
        showMessage(authStatusMessage, '', '');

        console.log("UI switched to Auth view.");
    }
}

/**
 * Updates the public user profile document for searching.
 * @param {string} uid - The user's UID.
 * @param {string} displayName - The user's display name.
 * @param {string} email - The user's email.
 * // @param {string|null} photoURL - The user's photo URL. // Removed
 */
async function updatePublicUserProfile(uid, displayName, email) {
    // Path: /artifacts/{appId}/public/data/user_search_profiles/{uid}
    const publicProfilesCollection = collection(db, 'artifacts', appId, 'public', 'data', 'user_search_profiles');
    const publicProfileRef = doc(publicProfilesCollection, uid);
    try {
        await setDoc(publicProfileRef, {
            uid: uid,
            displayName: displayName || 'Unnamed User',
            email: email,
            // photoURL: photoURL || null, // Removed
            lastUpdated: new Date().toISOString()
        }, { merge: true });
        console.log(`Public user profile for ${displayName} (${uid}) updated successfully.`);
    } catch (e) {
        console.error("Error updating public user profile:", e);
    }
}


// --- Firebase Authentication Listener ---
onAuthStateChanged(auth, async (user) => {
    console.log("onAuthStateChanged triggered. User:", user ? user.uid : "null");

    if (user) {
        currentUserId = user.uid;
        currentDisplayName = user.displayName;
        currentUserEmail = user.email;
        currentUserPhotoURL = user.photoURL; // Still holds value from auth, but not managed by app

        console.log("User logged in:", user.uid, user.email, user.displayName);

        // Update user's private profile document (e.g., last login, photoURL)
        // Path: /artifacts/{appId}/users/{currentUserId}/profile/public
        const privateProfileRef = doc(db, 'artifacts', appId, 'users', currentUserId, 'profile', 'public');
        try {
            await setDoc(privateProfileRef, {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || 'Unnamed User',
                photoURL: user.photoURL || null, // Still store from auth if available
                lastLogin: new Date().toISOString()
            }, { merge: true });
            console.log("Private user profile updated/created in Firestore.");
        } catch (e) {
            console.error("Error setting private user profile in Firestore:", e);
            showMessage(chatStatusMessage, `Error updating profile: ${e.message}`, 'error');
        }

        // Also update the public search profile
        await updatePublicUserProfile(currentUserId, currentDisplayName, currentUserEmail); // photoURL argument removed

        toggleUI(true);
        listenForFriends();

    } else {
        currentUserId = null;
        currentDisplayName = null;
        currentUserEmail = null;
        currentUserPhotoURL = null;
        console.log("User logged out.");
        toggleUI(false);
        if (unsubscribeFriends) {
            unsubscribeFriends();
            unsubscribeFriends = null;
            console.log("Unsubscribed from friends listener on logout.");
        }
        if (unsubscribeMessages) {
            unsubscribeMessages();
            unsubscribeMessages = null;
            console.log("Unsubscribed from messages listener on logout.");
        }
    }
});

// --- Initial Authentication Handling ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOMContentLoaded: App loaded. Awaiting authentication state from Firebase.");
    if (initialAuthToken) {
        try {
            await signInWithCustomToken(auth, initialAuthToken);
            console.log("Signed in with custom token via __initial_auth_token.");
        } catch (error) {
            console.error("Initial custom token authentication error:", error);
            showMessage(authStatusMessage, `Auto-login failed: ${error.message}. Please log in.`, 'error');
        }
    }
});

// --- Authentication Functions ---
async function login() {
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
        showMessage(authStatusMessage, "Please enter both email and password.", 'error');
        return;
    }

    try {
        console.log("Attempting login...");
        await signInWithEmailAndPassword(auth, email, password);
        showMessage(authStatusMessage, "Logged in successfully!", 'success');
    } catch (error) {
        console.error("Login error:", error);
        showMessage(authStatusMessage, `Login failed: ${error.message}`, 'error');
    }
}

async function register() {
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    const username = usernameInput.value.trim();

    if (!email || !password || !username) {
        showMessage(authStatusMessage, "Please fill in email, password, and display name.", 'error');
        return;
    }
    if (password.length < 6) {
        showMessage(authStatusMessage, "Password should be at least 6 characters.", 'error');
        return;
    }

    try {
        console.log("Attempting registration...");
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await updateProfile(user, { displayName: username });
        currentDisplayName = username;

        const privateProfileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'public');
        await setDoc(privateProfileRef, {
            uid: user.uid,
            email: user.email,
            displayName: username,
            photoURL: null, // Always null for new registrations without storage
            registeredAt: new Date().toISOString()
        });

        await updatePublicUserProfile(user.uid, username, email); // photoURL argument removed

        showMessage(authStatusMessage, "Registered successfully! You are now logged in.", 'success');
        console.log("Registration successful.");
    } catch (error) {
        console.error("Registration error:", error);
        showMessage(authStatusMessage, `Registration failed: ${error.message}`, 'error');
    }
}

async function logout() {
    try {
        console.log("Attempting logout...");
        await signOut(auth);
        showMessage(chatStatusMessage, "Logged out successfully.", 'success');
        console.log("Logout successful.");
    } catch (error) {
        console.error("Logout error:", error);
        showMessage(chatStatusMessage, `Logout failed: ${error.message}`, 'error');
    }
}

// --- Friend Management ---
function listenForFriends() {
    if (!currentUserId) {
        console.log("Not authenticated. Cannot listen for friends.");
        return;
    }
    console.log(`Listening for friends for user: ${currentUserId}`);

    const friendsCollectionRef = collection(db, 'artifacts', appId, 'users', currentUserId, 'friends');

    if (unsubscribeFriends) {
        unsubscribeFriends();
        console.log("Unsubscribed from previous friends listener.");
    }

    unsubscribeFriends = onSnapshot(friendsCollectionRef, (snapshot) => {
        console.log(`Friends list updated. Number of friends: ${snapshot.size}`);
        friendsListDiv.innerHTML = '';
        if (snapshot.empty) {
            friendsListDiv.innerHTML = '<p class="text-text-muted text-sm text-center py-4">No friends added yet. Search for users above!</p>';
            return;
        }

        snapshot.forEach(docSnap => {
            const friendData = docSnap.data();
            const friendItem = document.createElement('div');
            friendItem.className = 'friend-item';
            friendItem.dataset.friendId = friendData.userId;
            friendItem.innerHTML = `
                <span class="friend-item-display-name">${friendData.displayName}</span>
                <span class="friend-item-id">ID: ${friendData.userId.substring(0, 8)}...</span>
            `;
            friendsListDiv.appendChild(friendItem);

            friendItem.addEventListener('click', () => {
                selectFriendForChat(friendData.userId, friendData.displayName);
            });
        });
        showMessage(friendsStatusMessage, `Loaded ${snapshot.size} friends.`, 'info');
    }, (error) => {
        console.error("Error listening to friends:", error);
        showMessage(friendsStatusMessage, `Error loading friends: ${error.message}`, 'error');
    });
}

async function addFriend() {
    const friendSearchUsername = document.getElementById('friendSearch').value.trim();
    if (!friendSearchUsername) {
        showMessage(friendsStatusMessage, "Please enter a username to search.", 'error');
        return;
    }
    if (friendSearchUsername === currentDisplayName) {
        showMessage(friendsStatusMessage, "You cannot add yourself as a friend.", 'error');
        return;
    }
    if (!currentUserId) {
        showMessage(friendsStatusMessage, "Please log in to add friends.", 'error');
        return;
    }

    try {
        console.log(`Searching for user with display name: "${friendSearchUsername}"`);
        const publicProfilesCollection = collection(db, 'artifacts', appId, 'public', 'data', 'user_search_profiles');
        const q = query(publicProfilesCollection, where('displayName', '==', friendSearchUsername));
        const querySnapshot = await getDocs(q);

        let friendId = null;
        let friendActualDisplayName = null;

        querySnapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (data.uid !== currentUserId) {
                friendId = data.uid;
                friendActualDisplayName = data.displayName;
            }
        });

        if (!friendId) {
            showMessage(friendsStatusMessage, `User "${friendSearchUsername}" not found or cannot add self.`, 'error');
            return;
        }

        const userFriendsRef = doc(db, 'artifacts', appId, 'users', currentUserId, 'friends', friendId);
        const friendFriendsRef = doc(db, 'artifacts', appId, 'users', friendId, 'friends', currentUserId);

        const existingFriendDoc = await getDoc(userFriendsRef);
        if (existingFriendDoc.exists()) {
            showMessage(friendsStatusMessage, `${friendSearchUsername} is already your friend!`, 'info');
            return;
        }

        // Add friendship both ways
        await setDoc(userFriendsRef, {
            userId: friendId,
            displayName: friendActualDisplayName,
            addedAt: new Date().toISOString()
        });

        await setDoc(friendFriendsRef, {
            userId: currentUserId,
            displayName: currentDisplayName,
            addedAt: new Date().toISOString()
        });

        // Send welcome message to shared conversation
        const conversationId = getConversationId(currentUserId, friendId);
        console.log('Conversation ID created:', conversationId);

        const messagesCollectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'chats', conversationId, 'messages');
        await addDoc(messagesCollectionRef, {
            senderId: 'system',
            senderDisplayName: 'Aurocord',
            text: `${currentDisplayName} and ${friendActualDisplayName} are now connected. Say hi!`,
            timestamp: serverTimestamp()
        });

        showMessage(friendsStatusMessage, `Friend "${friendActualDisplayName}" added successfully!`, 'success');
        document.getElementById('friendSearch').value = '';

    } catch (error) {
        console.error("Error adding friend:", error);
        showMessage(friendsStatusMessage, `Error adding friend: ${error.message}`, 'error');
    }
}


// --- Messaging Functions ---

/**
 * Generates a consistent conversation ID for a direct chat between two users.
 * The ID is formed by sorting the two UIDs to ensure consistency.
 * @param {string} uid1 - User ID 1.
 * @param {string} uid2 - User ID 2.
 * @returns {string} The conversation ID.
 */
function getConversationId(uid1, uid2) {
    // Sort UIDs alphabetically to create a consistent conversation ID
    return [uid1, uid2].sort().join('_');
}

/**
 * Selects a friend to chat with and loads their messages.
 * @param {string} friendId - The UID of the friend to chat with.
 * @param {string} friendDisplayName - The display name of the friend.
 */
function selectFriendForChat(friendId, friendDisplayName) {
    if (!currentUserId) {
        showMessage(chatStatusMessage, "Please log in to chat.", 'error');
        return;
    }

    selectedFriendId = friendId;
    selectedFriendDisplayName = friendDisplayName;
    console.log(`Selected chat with: ${selectedFriendDisplayName} (ID: ${selectedFriendId})`);

    // Highlight the selected friend in the friends list UI
    document.querySelectorAll('.friend-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.friendId === friendId) {
            item.classList.add('active');
        }
    });

    messagesDiv.innerHTML = ''; // Clear previous messages
    showMessage(chatStatusMessage, `Loading chat with ${selectedFriendDisplayName}...`, 'info');

    // Get the conversation ID for this chat
    const conversationId = getConversationId(currentUserId, selectedFriendId);

    // Start listening for messages in this conversation
    listenForMessages(conversationId);

    // Enable message input field
    messageInput.disabled = false;
    messageInput.focus();
}

/**
 * Listens for real-time messages in a given conversation.
 * @param {string} conversationId - The ID of the conversation to listen to.
 */
function listenForMessages(conversationId) {
    if (unsubscribeMessages) {
        unsubscribeMessages();
        console.log("Unsubscribed from previous messages listener.");
    }

    const messagesCollectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'chats', conversationId, 'messages');
    const q = query(messagesCollectionRef, orderBy('timestamp'));

    unsubscribeMessages = onSnapshot(q, (snapshot) => {
        console.log(`Messages updated for conversation ${conversationId}. Number of messages: ${snapshot.size}`);
        messagesDiv.innerHTML = '';
        if (snapshot.empty) {
            messagesDiv.innerHTML = '<p class="text-text-muted text-sm text-center py-4">No messages yet. Say hello!</p>';
            return;
        }

        snapshot.forEach(docSnap => {
            const messageData = docSnap.data();
            const messageElement = document.createElement('div');
            messageElement.classList.add('message');

            if (messageData.senderId === currentUserId) {
                messageElement.classList.add('self');
            } else {
                messageElement.classList.add('other');
            }

            const senderDisplayName = messageData.senderDisplayName || 'Unknown User';
            const messageText = messageData.text || '';
            const timestamp = messageData.timestamp ? new Date(messageData.timestamp.toDate()).toLocaleTimeString() : 'N/A';

            messageElement.innerHTML = `
                <strong class="font-semibold">${senderDisplayName}</strong> <span class="text-xs text-text-muted">(${timestamp})</span><br>
                ${messageText}
            `;
            messagesDiv.appendChild(messageElement);
        });

        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        showMessage(chatStatusMessage, `Chat loaded with ${selectedFriendDisplayName}`, 'success');
    }, (error) => {
        console.error("Error listening to messages:", error);
        showMessage(chatStatusMessage, `Error loading chat: ${error.message}`, 'error');
    });
}

async function sendMessage() {
    const messageText = messageInput.value.trim();

    if (!messageText) {
        showMessage(chatStatusMessage, "Message cannot be empty.", 'error');
        return;
    }
    if (!currentUserId) {
        showMessage(chatStatusMessage, "Please log in to send messages.", 'error');
        return;
    }
    if (!selectedFriendId) {
        showMessage(chatStatusMessage, "Please select a friend to chat with first.", 'error');
        return;
    }

    try {
        const conversationId = getConversationId(currentUserId, selectedFriendId);
        const messagesCollectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'chats', conversationId, 'messages');

        await addDoc(messagesCollectionRef, {
            senderId: currentUserId,
            senderDisplayName: currentDisplayName || currentUserEmail,
            text: messageText,
            timestamp: serverTimestamp()
        });

        console.log(`Message sent to ${selectedFriendDisplayName}: "${messageText}"`);
        messageInput.value = '';
    } catch (error) {
        console.error("Error sending message:", error);
        showMessage(chatStatusMessage, `Failed to send message: ${error.message}`, 'error');
    }
}

// --- Group Creation (Placeholder function) ---
async function createGroup() {
    if (!currentUserId) {
        showMessage(chatStatusMessage, "Please log in to create groups.", 'error');
        return;
    }
    showMessage(chatStatusMessage, "Group creation functionality is not yet implemented.", 'info');
}

// --- Settings Functions ---
function openSettingsModal() {
    if (!currentUserId) {
        showMessage(chatStatusMessage, "You must be logged in to access settings.", 'error');
        return;
    }
    newUsernameInput.value = currentDisplayName || '';
    // Profile picture display and input removed
    // if (currentUserPhotoURL) {
    //     currentProfilePic.src = currentUserPhotoURL;
    //     currentProfilePic.classList.remove('hidden');
    // } else {
    //     currentProfilePic.classList.add('hidden');
    // }
    settingsModal.classList.remove('hidden');
    console.log("Settings modal opened.");
}

function closeSettingsModal() {
    settingsModal.classList.add('hidden');
    // newPfpInput.value = ''; // Removed
    console.log("Settings modal closed.");
}

async function saveSettings() {
    const newUsername = newUsernameInput.value.trim();
    // const newPhotoFile = newPfpInput.files[0]; // Removed
    const user = auth.currentUser;

    if (!user) {
        showMessage(settingsStatusMessage, "Not logged in.", 'error');
        return;
    }

    // let photoURLToUpdate = currentUserPhotoURL; // Removed
    let updatePromises = [];

    // 1. Update Username
    if (newUsername && newUsername !== currentDisplayName) {
        console.log(`Updating username to: ${newUsername}`);
        updatePromises.push(updateProfile(user, { displayName: newUsername }));
        currentDisplayName = newUsername;
    }

    // 2. Profile Picture logic removed
    // if (newPhotoFile) { ... }

    try {
        await Promise.all(updatePromises);

        // Update Firestore private profile
        const privateProfileRef = doc(db, 'artifacts', appId, 'users', currentUserId, 'profile', 'public');
        await setDoc(privateProfileRef, {
            displayName: currentDisplayName,
            photoURL: null // Ensure photoURL is explicitly null or remove the field if not needed
        }, { merge: true });

        // Update public search profile
        await updatePublicUserProfile(currentUserId, currentDisplayName, currentUserEmail); // photoURL argument removed

        showMessage(chatStatusMessage, "Settings saved successfully!", 'success');
        closeSettingsModal();
    } catch (error) {
        console.error("Error saving settings:", error);
        showMessage(settingsStatusMessage, `Error saving settings: ${error.message}`, 'error');
    }
}


// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    if (loginButton) loginButton.addEventListener('click', login);
    if (registerButton) registerButton.addEventListener('click', register);
    if (logoutButton) logoutButton.addEventListener('click', logout);
    if (addFriendButton) addFriendButton.addEventListener('click', addFriend);
    if (sendMessageButton) sendMessageButton.addEventListener('click', sendMessage);
    if (createGroupButton) createGroupButton.addEventListener('click', createGroup);

    // Settings buttons
    if (openSettingsButton) openSettingsButton.addEventListener('click', openSettingsModal);
    if (saveSettingsButton) saveSettingsButton.addEventListener('click', saveSettings);
    if (cancelSettingsButton) cancelSettingsButton.addEventListener('click', closeSettingsModal);

    if (messageInput) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }

    const friendSearchInput = document.getElementById('friendSearch');
    if (friendSearchInput) {
        friendSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addFriend();
            }
        });
    }
});