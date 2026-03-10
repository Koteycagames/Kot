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

// Три полоски (меню)
document.getElementById('burger-menu-btn').onclick = () => alert("Меню в разработке");
document.getElementById('logout-btn').onclick = () => signOut(auth);

// Новый чат
document.getElementById('new-chat-btn').onclick = () => document.getElementById('new-chat-modal').style.display = 'flex';
document.getElementById('close-new-chat-btn').onclick = () => document.getElementById('new-chat-modal').style.display = 'none';

document.getElementById('start-new-chat-btn').onclick = async () => {
    const phone = document.getElementById('new-chat-phone').value.trim();
    if (!phone) return;
    const usersRef = ref(db, 'users');
    const userQuery = query(usersRef, orderByChild('phoneNumber'), equalTo(phone));
    const snap = await get(userQuery);
    if (snap.exists()) {
        const userData = Object.values(snap.val())[0];
        document.getElementById('new-chat-modal').style.display = 'none';
        openChat(userData);
    } else {
        document.getElementById('new-chat-error').textContent = "Не найден";
    }
};

function openChat(user) {
    currentChatUser = user;
    document.getElementById('no-chat-selected').style.display = 'none';
    document.getElementById('active-chat').style.display = 'flex';
    document.getElementById('current-chat-name').textContent = user.displayName || user.phoneNumber;
    document.querySelector('.app-container').classList.add('chat-open');
    loadMessages();
}

// Кнопка НАЗАД (стрелочка)
document.getElementById('back-to-sidebar-btn').onclick = () => {
    document.querySelector('.app-container').classList.remove('chat-open');
};

function loadMessages() {
    if (unsubscribeMessages) unsubscribeMessages();
    const chatId = currentUser.uid < currentChatUser.uid ? `${currentUser.uid}_${currentChatUser.uid}` : `${currentChatUser.uid}_${currentUser.uid}`;
    unsubscribeMessages = onValue(ref(db, `chats/${chatId}/messages`), (snap) => {
        const container = document.getElementById('messages-container');
        container.innerHTML = '';
        snap.forEach(c => {
            const m = c.val();
            const d = document.createElement('div');
            d.style.alignSelf = m.senderId === currentUser.uid ? 'flex-end' : 'flex-start';
            d.style.background = m.senderId === currentUser.uid ? '#effdde' : '#fff';
            d.style.padding = '8px 12px'; d.style.borderRadius = '10px'; d.style.margin = '4px 0';
            if (m.imageUrl) d.innerHTML += `<img src="${m.imageUrl}" style="max-width:200px; display:block; border-radius:5px;">`;
            if (m.text) d.innerHTML += `<span>${m.text}</span>`;
            container.appendChild(d);
        });
        container.scrollTop = container.scrollHeight;
    });
}

function sendMessage(t = '', img = null) {
    if (!t && !img) return;
    const chatId = currentUser.uid < currentChatUser.uid ? `${currentUser.uid}_${currentChatUser.uid}` : `${currentChatUser.uid}_${currentUser.uid}`;
    push(ref(db, `chats/${chatId}/messages`), { senderId: currentUser.uid, text: t, imageUrl: img, timestamp: serverTimestamp() });
    document.getElementById('message-input').value = '';
}

document.getElementById('send-btn').onclick = () => sendMessage(document.getElementById('message-input').value);

// Список чатов (фильтруем себя!)
function loadMyChats() {
    onValue(ref(db, 'users'), (snap) => {
        const list = document.getElementById('chat-list');
        list.innerHTML = '';
        snap.forEach(c => {
            const u = c.val();
            if (u.uid === currentUser.uid) return; // СЕБЯ НЕ ПОКАЗЫВАЕМ
            const d = document.createElement('div');
            d.className = 'chat-item';
            d.innerHTML = `<b>${u.displayName || u.phoneNumber}</b><br><small>${u.phoneNumber}</small>`;
            d.onclick = () => openChat(u);
            list.appendChild(d);
        });
    });
}

// Картинки
document.getElementById('attach-btn').onclick = () => document.getElementById('image-input').click();
document.getElementById('image-input').onchange = (e) => {
    const f = e.target.files[0];
    if (f) {
        const r = new FileReader();
        r.onload = (ev) => {
            document.getElementById('preview-image').src = ev.target.result;
            document.getElementById('image-preview-modal').style.display = 'flex';
        };
        r.readAsDataURL(f);
    }
};

document.getElementById('close-preview-btn').onclick = () => document.getElementById('image-preview-modal').style.display = 'none';

document.getElementById('send-image-btn').onclick = async () => {
    const f = document.getElementById('image-input').files[0];
    const b = document.getElementById('send-image-btn');
    b.disabled = true; b.textContent = '...';
    const fd = new FormData(); fd.append('image', f);
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: fd });
    const json = await res.json();
    if (json.success) {
        sendMessage('', json.data.url);
        document.getElementById('image-preview-modal').style.display = 'none';
    }
    b.disabled = false; b.textContent = 'Отправить';
};
