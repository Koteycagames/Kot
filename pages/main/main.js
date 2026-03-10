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

// ПРОВЕРКА ВХОДА
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

// ВЫХОД
document.getElementById('logout-btn').onclick = () => signOut(auth);

// МОДАЛКА НОВОГО ЧАТА
const newChatModal = document.getElementById('new-chat-modal');
document.getElementById('new-chat-btn').onclick = () => {
    newChatModal.style.display = 'flex';
    document.getElementById('new-chat-error').textContent = '';
};
document.getElementById('close-new-chat-btn').onclick = () => newChatModal.style.display = 'none';

// ПОИСК ПО НОМЕРУ (Исправлено)
document.getElementById('start-new-chat-btn').onclick = async () => {
    const phone = document.getElementById('new-chat-phone').value.trim();
    if (!phone) return;

    const errorEl = document.getElementById('new-chat-error');
    errorEl.textContent = "Поиск...";

    const usersRef = ref(db, 'users');
    const userQuery = query(usersRef, orderByChild('phoneNumber'), equalTo(phone));
    
    try {
        const snapshot = await get(userQuery);
        if (snapshot.exists()) {
            const usersData = snapshot.val();
            const userData = Object.values(usersData)[0];
            
            if (userData.uid === currentUser.uid) {
                errorEl.textContent = "Нельзя создать чат с самим собой";
                return;
            }

            newChatModal.style.display = 'none';
            openChat(userData);
        } else {
            errorEl.textContent = "Пользователь не найден";
        }
    } catch (e) {
        errorEl.textContent = "Ошибка: проверьте интернет";
    }
};

// ОТКРЫТИЕ ЧАТА
function openChat(user) {
    currentChatUser = user;
    document.getElementById('no-chat-selected').style.display = 'none';
    document.getElementById('active-chat').style.display = 'flex';
    document.getElementById('current-chat-name').textContent = user.displayName || user.phoneNumber;
    
    // Переключение интерфейса на планшете/мобилке
    document.getElementById('app-viewport').classList.add('chat-open');
    loadMessages();
}

// КНОПКА НАЗАД (Стрелочка - ИСПРАВЛЕНО)
document.getElementById('back-to-sidebar-btn').onclick = (e) => {
    e.preventDefault();
    document.getElementById('app-viewport').classList.remove('chat-open');
};

// ЗАГРУЗКА СООБЩЕНИЙ
function loadMessages() {
    if (unsubscribeMessages) unsubscribeMessages();
    const chatId = currentUser.uid < currentChatUser.uid ? 
                   `${currentUser.uid}_${currentChatUser.uid}` : 
                   `${currentChatUser.uid}_${currentUser.uid}`;
    
    const msgRef = ref(db, `chats/${chatId}/messages`);
    unsubscribeMessages = onValue(msgRef, (snapshot) => {
        messagesContainer.innerHTML = '';
        snapshot.forEach(child => {
            const msg = child.val();
            renderMessage(msg);
        });
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });
}

function renderMessage(msg) {
    const div = document.createElement('div');
    const isMine = msg.senderId === currentUser.uid;
    div.style.alignSelf = isMine ? 'flex-end' : 'flex-start';
    div.style.background = isMine ? '#effdde' : '#fff';
    div.style.padding = '10px';
    div.style.borderRadius = '12px';
    div.style.maxWidth = '85%';
    div.style.boxShadow = '0 1px 1px rgba(0,0,0,0.1)';
    div.style.margin = '4px 0';

    if (msg.imageUrl) div.innerHTML += `<img src="${msg.imageUrl}" style="max-width:100%; border-radius:8px; margin-bottom:5px; display:block;">`;
    if (msg.text) div.innerHTML += `<span style="word-break: break-word;">${msg.text}</span>`;
    
    messagesContainer.appendChild(div);
}

// ОТПРАВКА
function sendMessage(text = '', img = null) {
    if (!text && !img) return;
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

document.getElementById('send-btn').onclick = () => sendMessage(document.getElementById('message-input').value);

// СПИСОК ЧАТОВ (Фильтрация себя - ИСПРАВЛЕНО)
function loadMyChats() {
    const usersRef = ref(db, 'users');
    onValue(usersRef, (snapshot) => {
        const list = document.getElementById('chat-list');
        list.innerHTML = '';
        let count = 0;
        
        snapshot.forEach(child => {
            const user = child.val();
            // Проверка: не выводим себя
            if (user.uid !== currentUser.uid) {
                const item = document.createElement('div');
                item.className = 'chat-item';
                item.innerHTML = `<strong>${user.displayName || 'Без имени'}</strong><br><small>${user.phoneNumber}</small>`;
                item.onclick = () => openChat(user);
                list.appendChild(item);
                count++;
            }
        });
        
        if (count === 0) {
            list.innerHTML = '<div class="info-message">У вас пока нет чатов</div>';
        }
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

document.getElementById('close-preview-btn').onclick = () => document.getElementById('image-preview-modal').style.display = 'none';

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
    } catch (e) { alert("Ошибка загрузки"); }
    btn.disabled = false; btn.textContent = 'Отправить фото';
};
    
