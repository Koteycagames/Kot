import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { getDatabase, ref, onValue, push, set, serverTimestamp, query, orderByChild, equalTo, get } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyBKp-HUZXSGSfBfEhl-HIjaC3Yflpqxg7s",
    authDomain: "kotogram-9b0b9.firebaseapp.com",
    databaseURL: "https://kotogram-9b0b9-default-rtdb.firebaseio.com",
    projectId: "kotogram-9b0b9",
    storageBucket: "kotogram-9b0b9.firebasestorage.app",
    messagingSenderId: "755607509917",
    appId: "1:755607509917:web:29b1b85eea516bde702d74"
};

const IMGBB_API_KEY = "706ffb03d5653cdf91990abac2ce7a29";
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

let currentUser = null;
let currentChatUser = null;
let unsubscribeMessages = null;

// DOM Элементы
const chatList = document.getElementById('chat-list');
const appContainer = document.querySelector('.app-container');
const messageInput = document.getElementById('message-input');
const messagesContainer = document.getElementById('messages-container');
const newChatModal = document.getElementById('new-chat-modal');
const newChatError = document.getElementById('new-chat-error');

// Аутентификация
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('my-display-name').textContent = user.displayName || "Я";
        document.getElementById('my-phone-number').textContent = user.phoneNumber;
        loadMyChats();
    } else {
        window.location.href = "../login/login.html";
    }
});

// Выход
document.getElementById('logout-btn').onclick = () => signOut(auth);

// Открытие модалки нового чата
document.getElementById('new-chat-btn').onclick = () => {
    newChatModal.style.display = 'flex';
    newChatError.textContent = '';
};

// Закрытие модалок
document.getElementById('close-new-chat-btn').onclick = () => newChatModal.style.display = 'none';
document.getElementById('close-preview-btn').onclick = () => document.getElementById('image-preview-modal').style.display = 'none';

// Поиск пользователя и начало чата
document.getElementById('start-new-chat-btn').onclick = async () => {
    const phone = document.getElementById('new-chat-phone').value.trim();
    if (!phone) return;

    const usersRef = ref(db, 'users');
    const userQuery = query(usersRef, orderByChild('phoneNumber'), equalTo(phone));
    
    try {
        const snapshot = await get(userQuery);
        if (snapshot.exists()) {
            const userData = Object.values(snapshot.val())[0];
            newChatModal.style.display = 'none';
            openChat(userData);
        } else {
            newChatError.textContent = "Пользователь не найден в KotoGram";
        }
    } catch (e) {
        newChatError.textContent = "Ошибка поиска";
    }
};

function openChat(user) {
    currentChatUser = user;
    document.getElementById('no-chat-selected').style.display = 'none';
    document.getElementById('active-chat').style.display = 'flex';
    document.getElementById('current-chat-name').textContent = user.displayName || user.phoneNumber;
    appContainer.classList.add('chat-open');
    loadMessages();
}

document.getElementById('back-to-sidebar-btn').onclick = () => appContainer.classList.remove('chat-open');

function loadMessages() {
    if (unsubscribeMessages) unsubscribeMessages();
    const chatId = currentUser.uid < currentChatUser.uid ? `${currentUser.uid}_${currentChatUser.uid}` : `${currentChatUser.uid}_${currentUser.uid}`;
    const msgRef = ref(db, `chats/${chatId}/messages`);
    
    unsubscribeMessages = onValue(msgRef, (snapshot) => {
        messagesContainer.innerHTML = '';
        snapshot.forEach(child => {
            const msg = child.val();
            const div = document.createElement('div');
            div.style.alignSelf = msg.senderId === currentUser.uid ? 'flex-end' : 'flex-start';
            div.style.background = msg.senderId === currentUser.uid ? '#effdde' : '#fff';
            div.style.padding = '8px 12px';
            div.style.borderRadius = '10px';
            div.style.maxWidth = '80%';
            div.style.boxShadow = '0 1px 2px rgba(0,0,0,0.1)';
            
            if (msg.imageUrl) div.innerHTML += `<img src="${msg.imageUrl}" style="max-width:100%; border-radius:8px;"><br>`;
            if (msg.text) div.innerHTML += `<span>${msg.text}</span>`;
            
            messagesContainer.appendChild(div);
        });
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });
}

function sendMessage(text = '', img = null) {
    if (!text && !img) return;
    const chatId = currentUser.uid < currentChatUser.uid ? `${currentUser.uid}_${currentChatUser.uid}` : `${currentChatUser.uid}_${currentUser.uid}`;
    push(ref(db, `chats/${chatId}/messages`), {
        senderId: currentUser.uid,
        text: text,
        imageUrl: img,
        timestamp: serverTimestamp()
    });
    messageInput.value = '';
}

document.getElementById('send-btn').onclick = () => sendMessage(messageInput.value);
messageInput.onkeydown = (e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(messageInput.value); } };

// Работа с ImgBB
document.getElementById('attach-btn').onclick = () => document.getElementById('image-input').click();
document.getElementById('image-input').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        document.getElementById('preview-image').src = ev.target.result;
        document.getElementById('image-preview-modal').style.display = 'flex';
    };
    reader.readAsDataURL(file);
};

document.getElementById('send-image-btn').onclick = async () => {
    const file = document.getElementById('image-input').files[0];
    const btn = document.getElementById('send-image-btn');
    btn.disabled = true; btn.textContent = 'Загрузка...';

    const formData = new FormData();
    formData.append('image', file);
    
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: formData });
    const data = await res.json();
    
    if (data.success) {
        sendMessage('', data.data.url);
        document.getElementById('image-preview-modal').style.display = 'none';
    }
    btn.disabled = false; btn.textContent = 'Отправить картинку';
};

// Загрузка существующих чатов (упрощенно)
function loadMyChats() {
    onValue(ref(db, 'users'), (snapshot) => {
        chatList.innerHTML = '';
        snapshot.forEach(child => {
            const user = child.val();
            if (user.uid === currentUser.uid) return;
            const item = document.createElement('div');
            item.className = 'chat-item';
            item.style.padding = '15px';
            item.style.borderBottom = '1px solid #eee';
            item.style.cursor = 'pointer';
            item.innerHTML = `<b>${user.displayName || user.phoneNumber}</b><br><small>${user.phoneNumber}</small>`;
            item.onclick = () => openChat(user);
            chatList.appendChild(item);
        });
    });
}
