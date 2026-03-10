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
        document.getElementById('my-display-name').textContent = user.displayName || "Мой профиль";
        document.getElementById('my-phone-number').textContent = user.phoneNumber;
        loadMyChats();
    } else {
        window.location.href = "../login/login.html";
    }
});

document.getElementById('logout-btn').onclick = () => signOut(auth);

const newChatModal = document.getElementById('new-chat-modal');
document.getElementById('new-chat-btn').onclick = () => {
    newChatModal.style.display = 'flex';
    document.getElementById('new-chat-error').textContent = '';
};
document.getElementById('close-new-chat-btn').onclick = () => newChatModal.style.display = 'none';

// УМНЫЙ ПОИСК
document.getElementById('start-new-chat-btn').onclick = async () => {
    let rawPhone = document.getElementById('new-chat-phone').value.trim();
    if (!rawPhone) return;

    // Очищаем для стандартного поиска (оставляем +)
    let searchPhone = rawPhone.replace(/[^\d+]/g, '');
    if (!searchPhone.startsWith('+') && searchPhone.startsWith('7')) searchPhone = '+' + searchPhone;

    const errorEl = document.getElementById('new-chat-error');
    errorEl.textContent = "Синхронизация...";

    const usersRef = ref(db, 'users');
    
    try {
        // Сначала пробуем точный поиск (быстрый)
        const q = query(usersRef, orderByChild('phoneNumber'), equalTo(searchPhone));
        const snap = await get(q);

        if (snap.exists()) {
            const userData = Object.values(snap.val())[0];
            handleFoundUser(userData);
        } else {
            // Если не нашло, делаем "мягкий" поиск по цифрам (запасной вариант)
            errorEl.textContent = "Глубокий поиск...";
            const allUsersSnap = await get(usersRef);
            let found = false;

            const digitsOnlySearch = searchPhone.replace(/\D/g, '');

            allUsersSnap.forEach(child => {
                const u = child.val();
                const uDigits = u.phoneNumber ? u.phoneNumber.replace(/\D/g, '') : '';
                if (uDigits && uDigits === digitsOnlySearch) {
                    handleFoundUser(u);
                    found = true;
                    return true; 
                }
            });

            if (!found) errorEl.textContent = "Пользователь не найден. Проверьте номер.";
        }
    } catch (e) {
        errorEl.textContent = "Ошибка базы данных";
    }
};

function handleFoundUser(userData) {
    if (userData.uid === currentUser.uid) {
        document.getElementById('new-chat-error').textContent = "Это вы";
    } else {
        newChatModal.style.display = 'none';
        openChat(userData);
    }
}

function openChat(user) {
    currentChatUser = user;
    document.getElementById('no-chat-selected').style.display = 'none';
    document.getElementById('active-chat').style.display = 'flex';
    document.getElementById('current-chat-name').textContent = user.displayName || user.phoneNumber;
    document.getElementById('app-viewport').classList.add('chat-open');
    loadMessages();
}

document.getElementById('back-to-sidebar-btn').onclick = () => {
    document.getElementById('app-viewport').classList.remove('chat-open');
};

function loadMessages() {
    if (unsubscribeMessages) unsubscribeMessages();
    const chatId = currentUser.uid < currentChatUser.uid ? 
                   `${currentUser.uid}_${currentChatUser.uid}` : 
                   `${currentChatUser.uid}_${currentUser.uid}`;
    
    const msgRef = ref(db, `chats/${chatId}/messages`);
    unsubscribeMessages = onValue(msgRef, (snapshot) => {
        const container = document.getElementById('messages-container');
        container.innerHTML = '';
        snapshot.forEach(child => {
            renderMessage(child.val(), container);
        });
        container.scrollTop = container.scrollHeight;
    });
}

function renderMessage(msg, container) {
    const div = document.createElement('div');
    const isMine = msg.senderId === currentUser.uid;
    div.style.alignSelf = isMine ? 'flex-end' : 'flex-start';
    div.style.background = isMine ? '#effdde' : '#fff';
    div.style.padding = '10px';
    div.style.borderRadius = '12px';
    div.style.maxWidth = '85%';
    div.style.margin = '4px 0';
    div.style.boxShadow = '0 1px 1px rgba(0,0,0,0.1)';

    if (msg.imageUrl) div.innerHTML += `<img src="${msg.imageUrl}" style="max-width:100%; border-radius:8px; display:block; margin-bottom:5px;">`;
    if (msg.text) div.innerHTML += `<span style="word-break: break-word; font-size: 15px;">${msg.text}</span>`;
    
    container.appendChild(div);
}

document.getElementById('send-btn').onclick = () => {
    const text = document.getElementById('message-input').value.trim();
    if (text) sendMessage(text);
};

function sendMessage(text = '', img = null) {
    const chatId = currentUser.uid < currentChatUser.uid ? 
                   `${currentUser.uid}_${currentChatUser.uid}` : 
                   `${currentChatUser.uid}_${currentUser.uid}`;
                   
    push(ref(db, `chats/${chatId}/messages`), {
        senderId: currentUser.uid,
        text: text,
        imageUrl: img,
        timestamp: serverTimestamp()
    });
    document.getElementById('message-input').value = '';
}

function loadMyChats() {
    const list = document.getElementById('chat-list');
    onValue(ref(db, 'users'), (snapshot) => {
        list.innerHTML = '';
        let found = false;
        snapshot.forEach(child => {
            const user = child.val();
            // Убираем себя и тестового юзера
            if (user.uid !== currentUser.uid && user.displayName !== "New Koto User") {
                const item = document.createElement('div');
                item.className = 'chat-item';
                item.innerHTML = `<strong>${user.displayName || 'Контакт'}</strong><br><small>${user.phoneNumber}</small>`;
                item.onclick = () => openChat(user);
                list.appendChild(item);
                found = true;
            }
        });
        if (!found) list.innerHTML = '<div style="padding:20px; text-align:center; color:#888;">Нет чатов</div>';
    });
}

// КАРТИНКИ
document.getElementById('attach-btn').onclick = () => document.getElementById('image-input').click();
document.getElementById('image-input').onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            document.getElementById('preview-image').src = ev.target.result;
            document.getElementById('image-preview-modal').style.display = 'flex';
        };
        reader.readAsDataURL(file);
    }
};

document.getElementById('send-image-btn').onclick = async () => {
    const file = document.getElementById('image-input').files[0];
    const btn = document.getElementById('send-image-btn');
    btn.disabled = true; btn.textContent = '...';
    const formData = new FormData();
    formData.append('image', file);
    try {
        const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: formData });
        const data = await res.json();
        if (data.success) {
            sendMessage('', data.data.url);
            document.getElementById('image-preview-modal').style.display = 'none';
        }
    } catch (e) { alert("Ошибка ImgBB"); }
    btn.disabled = false; btn.textContent = 'Отправить';
};
