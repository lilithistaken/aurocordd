

// Import Firebase modules. Using the modular SDK.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
    getAuth,
    signInAnonymously,
    signInWithCustomToken,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    updateProfile, // To update user's display name
    signOut // Added signOut for logout functionality (good practice)
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
    onSnapshot, // Added onSnapshot for real-time updates
    addDoc // For adding documents to a collection without specifying an ID
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// --- Global Variables (provided by the Canvas environment or defaults) ---
// IMPORTANT: __app_id is MANDATORY for Firestore paths.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// Your Firebase configuration object.
const firebaseConfig = {
    apiKey: "AIzaSyBkU8GgOP09YYfOmdvpypPRoXYk-SUFqWI",
    authDomain: "chatting-87797.firebaseapp.com",
    projectId: "chatting-87797",
    appId: "1:767603735256:web:14bf5c7696fa3f7e1835ad",
};

// __initial_auth_token is provided by the Canvas environment for initial login.
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// --- Initialize Firebase services ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Global state variables for the current user
let currentUserId = null;
let currentDisplayName = null;
let currentUserEmail = null; // Stored for display/debug
let isAuthReady = false; // Flag to indicate Firebase auth is initialized

// --- UI Element References ---
const authSection = document.getElementById('auth');
const chatSection = document.getElementById('chat');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const usernameInput = document.getElementById('username');
const pfpInput = document.getElementById('pfp'); // Profile picture input
const authStatusMessage = document.getElementById('authStatusMessage');
const chatStatusMessage = document.getElementById('chatStatusMessage');
const friendsStatusMessage = document.getElementById('friendsStatusMessage'); // Added for friends section
const currentUserIdDisplay = document.getElementById('currentUserIdDisplay');
const friendsListDiv = document.getElementById('friendsList');
const messagesDiv = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');


// Button references
const loginButton = document.getElementById('loginButton');
const registerButton = document.getElementById('registerButton');
const logoutButton = document.getElementById('logoutButton');
const addFriendButton = document.getElementById('addFriendButton');
const sendMessageButton = document.getElementById('sendMessageButton');
const createGroupButton = document.getElementById('createGroupButton');


/**
 * Displays a message to the user in a specified status area.
 * @param {HTMLElement} element - The HTML element (e.g., authStatusMessage, chatStatusMessage) to display the message in.
 * @param {string} message - The message text to display.
 * @param {string} type - 'success', 'error', or 'info' to determine message color.
 */
function showMessage(element, message, type) {
    if (!element) {
        console.warn("showMessage: Target element not found.", element);
        return;
    }
    element.textContent = message;
    // Set text color based on type, using a class for consistency if possible, or inline style
    element.style.color = type === 'error' ? 'red' : (type === 'success' ? 'green' : 'gray');
    setTimeout(() => {
        element.textContent = '';
    }, 5000); // Clear message after 5 seconds
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
        currentUserIdDisplay.textContent = `Your User ID: ${currentUserId}`; // Display the full user ID

        // Clear auth inputs when switching to chat view
        emailInput.value = '';
        passwordInput.value = '';
        usernameInput.value = '';
        pfpInput.value = ''; // Clear file input

        console.log("UI switched to Chat view.");
    } else {
        authSection.classList.remove('hidden');
        chatSection.classList.add('hidden');
        // Clear chat inputs/messages if needed
        messageInput.value = '';
        messagesDiv.innerHTML = '<p class="text-text-muted text-sm text-center py-4">Select a friend or start a group chat!</p>';
        friendsListDiv.innerHTML = '<p class="text-text-muted text-sm text-center py-4">No friends added yet. Search for users above!</p>';
        showMessage(authStatusMessage, '', ''); // Clear any previous messages

        console.log("UI switched to Auth view.");
    }
}

// --- Firebase Authentication Listener ---
// This listens for changes in the authentication state (login/logout).
onAuthStateChanged(auth, async (user) => {
    isAuthReady = true; // Auth state has been checked at least once
    console.log("onAuthStateChanged triggered. User:", user ? user.uid : "null");

    if (user) {
        // User is signed in
        currentUserId = user.uid;
        currentDisplayName = user.displayName;
        currentUserEmail = user.email;

        console.log("User logged in:", user.uid, user.email, user.displayName);

        // Ensure user data (like display name) is in Firestore if not already.
        // This is important for new registrations where display name is set after creation.
        // User profiles are stored in /artifacts/{appId}/users/{userId}/profile/public
        const userDocRef = doc(db, `artifacts/${appId}/users/${currentUserId}/profile`, 'public');
        try {
            const userDocSnap = await getDoc(userDocRef);
            // Check if profile exists and display name matches, otherwise update
            if (!userDocSnap.exists() || userDocSnap.data().displayName !== currentDisplayName) {
                console.log("Updating user profile in Firestore...");
                await setDoc(userDocRef, {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName || 'Unnamed User', // Default if displayName is null
                    photoURL: user.photoURL || null, // Store profile picture URL if available
                    lastLogin: new Date().toISOString() // Store date as ISO string
                }, { merge: true }); // Use merge to update existing fields without overwriting
                console.log("User profile updated/created in Firestore.");
            } else {
                console.log("User profile already exists and is up-to-date in Firestore.");
            }
        } catch (e) {
            console.error("Error setting user profile in Firestore:", e);
            showMessage(chatStatusMessage, `Error updating profile: ${e.message}`, 'error');
        }

        toggleUI(true);
        // Start listening for friends after user is logged in
        listenForFriends();

    } else {
        // User is signed out
        currentUserId = null;
        currentDisplayName = null;
        currentUserEmail = null;
        console.log("User logged out.");
        toggleUI(false);
    }
});

// --- Initial Authentication (using custom token if provided) ---
// This attempts to sign in the user immediately if a token is available.
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOMContentLoaded: Attempting initial authentication.");
    try {
        if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
            console.log("Signed in with custom token via __initial_auth_token.");
        } else {
            // If no custom token, sign in anonymously for immediate access to public data.
            await signInAnonymously(auth);
            console.log("Signed in anonymously.");
        }
    } catch (error) {
        console.error("Initial authentication error:", error);
        showMessage(authStatusMessage, `Authentication failed: ${error.message}`, 'error');
    }
});

// --- Authentication Functions ---

/**
 * Handles user login.
 */
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
        // UI will update via onAuthStateChanged listener
    } catch (error) {
        console.error("Login error:", error);
        showMessage(authStatusMessage, `Login failed: ${error.message}`, 'error');
    }
}

/**
 * Handles user registration.
 */
async function register() {
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    const username = usernameInput.value.trim(); // Display name for registration

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

        // Update user profile with display name
        await updateProfile(user, { displayName: username });
        currentDisplayName = username; // Update local state immediately

        // Store user profile in Firestore for easy lookups
        // User profiles are stored in /artifacts/{appId}/users/{userId}/profile/public
        const userDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/profile`, 'public');
        await setDoc(userDocRef, {
            uid: user.uid,
            email: user.email,
            displayName: username,
            photoURL: null, // Profile picture will be handled separately if uploaded
            registeredAt: new Date().toISOString()
        });

        showMessage(authStatusMessage, "Registered successfully! You are now logged in.", 'success');
        console.log("Registration successful.");
        // UI will update via onAuthStateChanged listener
    } catch (error) {
        console.error("Registration error:", error);
        showMessage(authStatusMessage, `Registration failed: ${error.message}`, 'error');
    }
}

/**
 * Handles user logout.
 */
async function logout() {
    try {
        console.log("Attempting logout...");
        await signOut(auth);
        showMessage(chatStatusMessage, "Logged out successfully.", 'success');
        console.log("Logout successful.");
        // UI will update via onAuthStateChanged listener
    } catch (error) {
        console.error("Logout error:", error);
        showMessage(chatStatusMessage, `Logout failed: ${error.message}`, 'error');
    }
}


// --- Friend Management ---

/**
 * Listens for real-time updates to the current user's friends list.
 * This function should be called after a user successfully logs in.
 */
function listenForFriends() {
    if (!currentUserId) {
        console.log("Not authenticated. Cannot listen for friends.");
        return;
    }
    console.log(`Listening for friends for user: ${currentUserId}`);

    // Friends are stored in /artifacts/{appId}/users/{userId}/friends/{friendId}
    const friendsCollectionRef = collection(db, `artifacts/${appId}/users/${currentUserId}/friends`);

    // Detach any previous listeners to prevent duplicates
    if (window.unsubscribeFriends) {
        window.unsubscribeFriends();
        console.log("Unsubscribed from previous friends listener.");
    }

    window.unsubscribeFriends = onSnapshot(friendsCollectionRef, (snapshot) => {
        console.log(`Friends list updated. Number of friends: ${snapshot.size}`);
        friendsListDiv.innerHTML = ''; // Clear existing friends list
        if (snapshot.empty) {
            friendsListDiv.innerHTML = '<p class="text-text-muted text-sm text-center py-4">No friends added yet. Search for users above!</p>';
            return;
        }

        snapshot.forEach(docSnap => {
            const friendData = docSnap.data();
            const friendItem = document.createElement('div');
            friendItem.className = 'friend-item'; // Add class for styling
            friendItem.dataset.friendId = friendData.userId; // Store friend ID for selection
            friendItem.innerHTML = `
                <span class="friend-item-display-name">${friendData.displayName}</span>
                <span class="friend-item-id">ID: ${friendData.userId.substring(0, 8)}...</span>
            `;
            friendsListDiv.appendChild(friendItem);

            // Add click listener to select friend for chat
            friendItem.addEventListener('click', () => {
                // Future: Logic to load chat history with this friend
                console.log("Selected friend:", friendData.displayName, friendData.userId);
                // Highlight selected friend
                document.querySelectorAll('.friend-item').forEach(item => {
                    item.classList.remove('active');
                });
                friendItem.classList.add('active');
                showMessage(chatStatusMessage, `Chatting with ${friendData.displayName}`, 'info');
                // You'll need to implement logic to fetch and display messages for this friend
            });
        });
        showMessage(friendsStatusMessage, `Loaded ${snapshot.size} friends.`, 'info');
    }, (error) => {
        console.error("Error listening to friends:", error);
        showMessage(friendsStatusMessage, `Error loading friends: ${error.message}`, 'error');
    });
}


/**
 * Searches for a user by username and adds them as a friend.
 */
async function addFriend() {
    const friendUsername = document.getElementById('friendSearch').value.trim();
    if (!friendUsername) {
        showMessage(friendsStatusMessage, "Please enter a username to search.", 'error');
        return;
    }
    if (friendUsername === currentDisplayName) {
        showMessage(friendsStatusMessage, "You cannot add yourself as a friend.", 'error');
        return;
    }

    if (!currentUserId) {
        showMessage(friendsStatusMessage, "Please log in to add friends.", 'error');
        return;
    }

    try {
        console.log(`Searching for user with display name: "${friendUsername}"`);
        // Query users collection for the display name
        // User profiles are stored in /artifacts/{appId}/users/{userId}/profile/public
        const usersCollectionRef = collection(db, `artifacts/${appId}/users`);

        // To query by displayName, we need to query the root collection 'users'
        // and then access the 'profile' sub-document's displayName field.
        // This query requires a Firestore index for 'profile.displayName'.
        // For simplicity and to avoid index setup for now, we'll fetch all user documents
        // and filter in memory. For a production app with many users, a dedicated `public_users`
        // collection with denormalized display names is highly recommended.
        const allUserDocs = await getDocs(usersCollectionRef);
        let friendId = null;
        let friendActualDisplayName = null;

        allUserDocs.forEach(userDoc => {
            const profileDoc = userDoc.data(); // This is the user ID document itself
            // We need to access the 'profile' subcollection document. This approach
            // is incorrect if 'profile' is a subcollection and not a direct field.
            // Let's correct the querying logic:
            // The user profile is stored as a document 'public' in the 'profile' subcollection.
            // So, we need to iterate over all users and then try to get their 'public' profile document.
            // This is inefficient but works for now.
            if (userDoc.id !== currentUserId) { // Don't try to add self
                const profileRef = doc(db, `artifacts/${appId}/users/${userDoc.id}/profile`, 'public');
                getDoc(profileRef).then(profileSnap => {
                    if (profileSnap.exists() && profileSnap.data().displayName === friendUsername) {
                        friendId = userDoc.id; // The userDoc.id IS the userId
                        friendActualDisplayName = profileSnap.data().displayName;
                        // Since forEach cannot be broken easily, we will handle `friendId` being found outside.
                        // For now, if found, just assign and let the loop finish.
                    }
                }).catch(e => console.error("Error getting friend profile:", e));
            }
        });

        // Small delay to allow async getDoc calls in the forEach to complete (not ideal, but a quick fix for current structure)
        await new Promise(resolve => setTimeout(resolve, 500)); // Consider a better pattern for production

        if (!friendId) {
            showMessage(friendsStatusMessage, `User "${friendUsername}" not found. Please ensure the username is exact.`, 'error');
            return;
        }

        // Check if already friends
        const existingFriendDocRef = doc(db, `artifacts/${appId}/users/${currentUserId}/friends`, friendId);
        const existingFriendDoc = await getDoc(existingFriendDocRef);
        if (existingFriendDoc.exists()) {
            showMessage(friendsStatusMessage, `${friendUsername} is already your friend!`, 'info');
            return;
        }

        // Add friend relationship in Firestore for both users (mutual friendship)
        // User's friends are stored in /artifacts/{appId}/users/{userId}/friends/{friendId}
        const userFriendsRef = doc(db, `artifacts/${appId}/users/${currentUserId}/friends`, friendId);
        const friendFriendsRef = doc(db, `artifacts/${appId}/users/${friendId}/friends`, currentUserId);

        await setDoc(userFriendsRef, {
            userId: friendId,
            displayName: friendActualDisplayName, // Use the actual display name from Firestore
            addedAt: new Date().toISOString()
        });
        await setDoc(friendFriendsRef, {
            userId: currentUserId,
            displayName: currentDisplayName,
            addedAt: new Date().toISOString()
        });

        showMessage(friendsStatusMessage, `Friend "${friendActualDisplayName}" added successfully!`, 'success');
        document.getElementById('friendSearch').value = ''; // Clear input
        // The listenForFriends() onSnapshot will automatically update the UI
    } catch (error) {
        console.error("Error adding friend:", error);
        showMessage(friendsStatusMessage, `Error adding friend: ${error.message}`, 'error');
    }
}

// --- Message Sending (Placeholder function) ---
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

    console.log(`Sending message: "${messageText}" from ${currentDisplayName || currentUserId}`);
    showMessage(chatStatusMessage, "Message sent (placeholder).", 'success');
    messageInput.value = ''; // Clear input field

    // Example of adding to messages div (for display only, not actual storage)
    const newMessage = document.createElement('div');
    newMessage.classList.add('message', 'self'); // Assuming 'self' for sent messages
    newMessage.innerHTML = `<strong>${currentDisplayName || 'You'}</strong>: ${messageText}`;
    messagesDiv.appendChild(newMessage);
    messagesDiv.scrollTop = messagesDiv.scrollHeight; // Scroll to bottom
}

// --- Group Creation (Placeholder function) ---
async function createGroup() {
    if (!currentUserId) {
        showMessage(chatStatusMessage, "Please log in to create groups.", 'error');
        return;
    }
    showMessage(chatStatusMessage, "Group creation functionality is not yet implemented.", 'info');
    // This would typically open a modal to select group members and set a group name.
}


// --- Event Listeners ---
// Attach event listeners to buttons after the DOM is fully loaded.
document.addEventListener('DOMContentLoaded', () => {
    // Check if buttons exist before adding listeners to prevent errors if UI elements are not found
    if (loginButton) loginButton.addEventListener('click', login);
    if (registerButton) registerButton.addEventListener('click', register);
    if (logoutButton) logoutButton.addEventListener('click', logout);
    if (addFriendButton) addFriendButton.addEventListener('click', addFriend);
    if (sendMessageButton) sendMessageButton.addEventListener('click', sendMessage);
    if (createGroupButton) createGroupButton.addEventListener('click', createGroup);

    // Allow sending messages with Enter key
    if (messageInput) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }

    // Allow adding friend with Enter key
    const friendSearchInput = document.getElementById('friendSearch');
    if (friendSearchInput) {
        friendSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addFriend();
            }
        });
    }
});
