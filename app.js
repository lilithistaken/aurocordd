// 🔧 Replace this config with your own from Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyBkU8GgOP09YYfOmdvpypPRoXYk-SUFqWI",
  authDomain: "chatting-87797.firebaseapp.com",
 projectId: "chatting-87797"
  appId: "1:767603735256:web:14bf5c7696fa3f7e1835ad",
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let currentChat = null;

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function register() {
  const username = document.getElementById('username').value;
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const file = document.getElementById('pfp').files[0];

  const avatarURL = await fileToBase64(file);
  const userCred = await auth.createUserWithEmailAndPassword(email, password);
  const uid = userCred.user.uid;

  await db.collection('users').doc(uid).set({ username, avatarURL, friends: [] });

  login(); // auto-login
}

async function login() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  const userCred = await auth.signInWithEmailAndPassword(email, password);
  const uid = userCred.user.uid;
  const userDoc = await db.collection('users').doc(uid).get();
  currentUser = { uid, ...userDoc.data() };

  document.getElementById('auth').classList.add('hidden');
  document.getElementById('chat').classList.remove('hidden');
  loadFriends();
}

async function addFriend() {
  const username = document.getElementById('friendSearch').value;
  const qSnap = await db.collection('users').where('username', '==', username).get();
  if (!qSnap.empty) {
    const friendDoc = qSnap.docs[0];
    const friendId = friendDoc.id;

    if (!currentUser.friends.includes(friendId)) {
      await db.collection('users').doc(currentUser.uid).update({
        friends: firebase.firestore.FieldValue.arrayUnion(friendId)
      });
      await db.collection('users').doc(friendId).update({
        friends: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
      });
      loadFriends();
    }
  } else {
    alert("User not found");
  }
}

async function loadFriends() {
  const userDoc = await db.collection('users').doc(currentUser.uid).get();
  currentUser = { uid: currentUser.uid, ...userDoc.data() };

  const friendsList = document.getElementById('friendsList');
  friendsList.innerHTML = '';
  for (const friendId of currentUser.friends) {
    const friendDoc = await db.collection('users').doc(friendId).get();
    const data = friendDoc.data();
    const btn = document.createElement('button');
    btn.innerText = data.username;
    btn.onclick = () => openChat(friendId, data.username);
    friendsList.appendChild(btn);
  }
}

function chatId(uid1, uid2) {
  return [uid1, uid2].sort().join("_");
}

function openChat(friendId, friendName) {
  currentChat = chatId(currentUser.uid, friendId);
  document.getElementById('chatHeader').innerText = "Chat with " + friendName;
  listenForMessages();
}

function listenForMessages() {
  const messagesDiv = document.getElementById('messages');
  messagesDiv.innerHTML = '';

  db.collection('chats').doc(currentChat).collection('messages')
    .orderBy('timestamp')
    .onSnapshot(snapshot => {
      messagesDiv.innerHTML = '';
      snapshot.forEach(doc => {
        const msg = doc.data();
        const p = document.createElement('p');
        p.innerHTML = `<img src="${msg.avatar}" width="25" height="25" /> <strong>${msg.senderName}</strong>: ${msg.text}`;
        messagesDiv.appendChild(p);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
      });
    });
}

async function sendMessage() {
  const text = document.getElementById('messageInput').value;
  if (!text || !currentChat) return;

  await db.collection('chats').doc(currentChat).collection('messages').add({
    sender: currentUser.uid,
    senderName: currentUser.username,
    avatar: currentUser.avatarURL,
    text,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });

  document.getElementById('messageInput').value = '';
}

function createGroup() {
  const name = prompt("Group name?");
  if (!name) return;

  const members = [currentUser.uid];
  const groupId = 'group_' + Date.now();

  db.collection('groups').doc(groupId).set({ name, members });
  openGroupChat(groupId, name);
}

function openGroupChat(groupId, name) {
  currentChat = groupId;
  document.getElementById('chatHeader').innerText = "Group: " + name;
  listenForMessages();
}
