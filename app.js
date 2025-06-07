

// Import Firebase modules. Using the modular SDK.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
    getAuth,
    signInAnonymously,
    signInWithCustomToken,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    updateProfile // To update user's display name
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    collection,
    query,
    where,
    getDocs
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// --- Global Variables (provided by the Canvas environment) ---
// Ensure these are defined. If not, provide default values for development.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// This is your Firebase configuration object.
const firebaseConfig = {
    apiKey: "AIzaSyBkU8GgOP09YYfOmdvpypPRoXYk-SUFqWI",
    authDomain: "chatting-87797.firebaseapp.com",
    projectId: "chatting-87797",
    appId: "1:767603735256:web:14bf5c7696fa3f7e1835ad",
};

const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// --- Initialize Firebase services ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Global variables for user and Firestore (will be populated after auth)
let currentUserId = null;
let currentDisplayName = null;
let currentUserEmail = null;

// --- UI Element References ---
const authSection = document.getElementById('auth');
const chatSection = document.getElementById('chat');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const usernameInput = document.getElementById('username');
const pfpInput = document.getElementById('pfp'); // Profile picture input
const messageArea = document.createElement('p'); // Create a message area dynamically
messageArea.id = 'statusMessage';
messageArea.style.cssText = 'color: red; text-align: center; margin-top: 10px;'; // Basic styling

// Append message area to the auth modal for feedback
document.querySelector('#auth .modal').appendChild(messageArea);

/**
 * Displays a message to the user in the status message area.
 * @param {string} message - The message to display.
 * @param {string} type - 'success' or 'error' to determine message color.
 */
function showMessage(message, type) {
    messageArea.textContent = message;
    messageArea.style.color = type === 'error' ? 'red' : 'green';
    // Clear message after a few seconds
    setTimeout(() => {
        messageArea.textContent = '';
    }, 5000);
}

/**
 * Toggles the visibility of the authentication and chat sections.
 * @param {boolean} loggedIn - True if the user is logged in, false otherwise.
 */
function toggleUI(loggedIn) {
    if (loggedIn) {
        authSection.classList.add('hidden');
        chatSection.classList.remove('hidden');
        document.getElementById('chatHeader').textContent = `Welcome, ${currentDisplayName || currentUserEmail}!`;
    } else {
        authSection.classList.remove('hidden');
        chatSection.classList.add('hidden');
        emailInput.value = '';
        passwordInput.value = '';
        usernameInput.value = '';
        pfpInput.value = ''; // Clear file input
        showMessage('', ''); // Clear any previous messages
    }
}

// --- Firebase Authentication Listener ---
// This listens for changes in the authentication state (login/logout).
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // User is signed in
        currentUserId = user.uid;
        currentDisplayName = user.displayName;
        currentUserEmail = user.email;

        console.log("User logged in:", user.uid, user.email, user.displayName);

        // Ensure user data (like display name) is in Firestore if not already.
        // This is important for new registrations where display name is set after creation.
        const userDocRef = doc(db, `artifacts/${appId}/users/${currentUserId}/profile`, 'public');
        try {
            const userDocSnap = await getDoc(userDocRef);
            if (!userDocSnap.exists() || userDocSnap.data().displayName !== currentDisplayName) {
                await setDoc(userDocRef, {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName,
                    photoURL: user.photoURL || null, // Store profile picture URL if available
                    lastLogin: new Date()
                }, { merge: true }); // Use merge to update existing fields without overwriting
            }
        } catch (e) {
            console.error("Error setting user profile in Firestore:", e);
        }

        toggleUI(true);
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
window.onload = async () => {
    try {
        if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
            console.log("Signed in with custom token.");
        } else {
            // If no custom token, sign in anonymously for immediate access to public data.
            await signInAnonymously(auth);
            console.log("Signed in anonymously.");
        }
    } catch (error) {
        console.error("Initial authentication error:", error);
        showMessage(`Authentication failed: ${error.message}`, 'error');
    }
};

// --- Authentication Functions (called from HTML) ---

/**
 * Handles user login.
 */
window.login = async () => {
    const email = emailInput.value;
    const password = passwordInput.value;

    if (!email || !password) {
        showMessage("Please enter both email and password.", 'error');
        return;
    }

    try {
        await signInWithEmailAndPassword(auth, email, password);
        showMessage("Logged in successfully!", 'success');
        // UI will update via onAuthStateChanged listener
    } catch (error) {
        console.error("Login error:", error);
        showMessage(`Login failed: ${error.message}`, 'error');
    }
};

/**
 * Handles user registration.
 */
window.register = async () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    const username = usernameInput.value; // Display name for registration

    if (!email || !password || !username) {
        showMessage("Please fill in email, password, and display name.", 'error');
        return;
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Update user profile with display name
        await updateProfile(user, { displayName: username });
        currentDisplayName = username; // Update local state immediately

        // Store user profile in Firestore for easy lookups
        const userDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/profile`, 'public');
        await setDoc(userDocRef, {
            uid: user.uid,
            email: user.email,
            displayName: username,
            photoURL: null, // Profile picture will be handled separately if uploaded
            registeredAt: new Date()
        });

        showMessage("Registered successfully! You are now logged in.", 'success');
        // UI will update via onAuthStateChanged listener
    } catch (error) {
        console.error("Registration error:", error);
        showMessage(`Registration failed: ${error.message}`, 'error');
    }
};

// --- Friend Management (Placeholder functions) ---

/**
 * Searches for a user by username and adds them as a friend.
 */
window.addFriend = async () => {
    const friendUsername = document.getElementById('friendSearch').value.trim();
    if (!friendUsername) {
        showMessage("Please enter a username to search.", 'error');
        return;
    }
    if (friendUsername === currentDisplayName) {
        showMessage("You cannot add yourself as a friend.", 'error');
        return;
    }

    if (!currentUserId) {
        showMessage("Please log in to add friends.", 'error');
        return;
    }

    try {
        // Query users collection for the display name
        const usersRef = collection(db, `artifacts/${appId}/users`);
        const q = query(usersRef, where('profile.displayName', '==', friendUsername));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            showMessage(`User "${friendUsername}" not found.`, 'error');
            return;
        }

        let friendId = null;
        querySnapshot.forEach(docSnap => {
            // Assuming display names are unique or taking the first match
            friendId = docSnap.id;
        });

        if (friendId && friendId !== currentUserId) {
            // Add friend relationship in Firestore for both users (mutual friendship)
            const userFriendsRef = doc(db, `artifacts/${appId}/users/${currentUserId}/friends`, friendId);
            const friendFriendsRef = doc(db, `artifacts/${appId}/users/${friendId}/friends`, currentUserId);

            await setDoc(userFriendsRef, {
                userId: friendId,
                displayName: friendUsername,
                addedAt: new Date()
            });
            await setDoc(friendFriendsRef, {
                userId: currentUserId,
                displayName: currentDisplayName,
                addedAt: new Date()
            });

            showMessage(`Friend "${friendUsername}" added successfully!`, 'success');
            document.getElementById('friendSearch').value = ''; // Clear input
            // You would typically have a real-time listener to update friendsList UI here
        } else if (friendId === currentUserId) {
            showMessage("You are already yourself!", 'error');
        }

    } catch (error) {
        console.error("Error adding friend:", error);
        showMessage(`Error adding friend: ${error.message}`, 'error');
    }
};

// --- Message Sending (Placeholder function) ---
window.sendMessage = () => {
    const messageInput = document.getElementById('messageInput');
    const messageText = messageInput.value.trim();

    if (!messageText) {
        showMessage("Message cannot be empty.", 'error');
        return;
    }

    if (!currentUserId) {
        showMessage("Please log in to send messages.", 'error');
        return;
    }

    // This is a placeholder. Real message sending would involve:
    // 1. Determining the recipient (e.g., selected friend or group chat)
    // 2. Storing the message in Firestore (e.g., in a 'chats' collection)
    // 3. Displaying the message in the #messages div in real-time

    console.log(`Sending message: "${messageText}" from ${currentDisplayName || currentUserId}`);
    showMessage("Message sent (placeholder).", 'success');
    messageInput.value = ''; // Clear input field

    // Example of adding to messages div (for display only, not actual storage)
    const messagesDiv = document.getElementById('messages');
    const newMessage = document.createElement('div');
    newMessage.classList.add('message', 'self'); // Assuming 'self' for sent messages
    newMessage.innerHTML = `<strong>${currentDisplayName || 'You'}</strong>: ${messageText}`;
    messagesDiv.appendChild(newMessage);
    messagesDiv.scrollTop = messagesDiv.scrollHeight; // Scroll to bottom
};

// --- Group Creation (Placeholder function) ---
window.createGroup = () => {
    if (!currentUserId) {
        showMessage("Please log in to create groups.", 'error');
        return;
    }
    showMessage("Group creation functionality is not yet implemented.", 'info');
    // This would typically open a modal to select group members and set a group name.
};
