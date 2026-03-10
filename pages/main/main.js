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

// МОДАЛКА
const newChatModal = document.getElementById('new-chat-modal');
document.getElementById('new-chat-btn').onclick = () => {
    newChatModal.style.display = 'flex';
    document.getElementById('new-chat-error').textContent = '';
};
document.getElementById('close-new-chat-btn').onclick = () => newChatModal.style.display = 'none';

// УМНЫЙ ПОИСК С АЛЕРТАМИ ОШИБОК
document.getElementById('start-new-chat-btn').onclick = async () => {
    let rawPhone = document.getElementById('new-chat-phone').value.trim();
    if (!rawPhone) {
        alert("Введите номер телефона!");
        return;
    }

    // Чистим номер для сравнения (только цифры)
    let searchDigits = rawPhone.replace(/\D/g, ''); 
    const errorEl = document.getElementById('new-chat-error');
    errorEl.textContent = "Ищем " + searchDigits + "...";

    const usersRef = ref(db, 'users');
    
    try {
        // Пытаемся получить всех пользователей для ручного перебора (самый надежный способ, если Rules тупят)
        const snapshot = await get(usersRef);
        
        if (!snapshot.exists()) {
            alert("Ошибка: База пользователей пуста. Никто еще не зарегистрирован.");
            return;
        }

        let foundUser = null;
        snapshot.forEach(child => {
            const userData = child.val();
            const dbPhoneDigits = userData.phoneNumber ? userData.phoneNumber.replace(/\D/g, '') : '';
            
            if (dbPhoneDigits === searchDigits) {
                foundUser = userData;
            }
        });

        if (foundUser) {
            if (foundUser.uid === currentUser.uid) {
                alert("Это ваш собственный номер телефона!");
                errorEl.textContent = "";
            } else {
                newChatModal.style.display = 'none';
                openChat(foundUser);
            }
        } else {
            alert("Пользователь с номером " + rawPhone + " не найден в KotoGram. Проверьте правильность или пригласите друга.");
            errorEl.textContent = "Не найден";
        }

    } catch (error) {
        console.error("Firebase Error:", error);
        alert("Критическая ошибка базы: " + error.message + "\nПроверьте Rules в консоли Firebase!");
    }
};

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
            const msg = child.val();
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
            if (msg.text) div.innerHTML += `<span style="word-break: break-word;">${msg.text}</span>`;
            container.appendChild(div);
        });
        container.scrollTop = container.scrollHeight;
    });
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
        let count = 0;
        snapshot.forEach(child => {
            const user = child.val();
            if (user.uid !== currentUser.uid && user.displayName !== "New Koto User") {
                const item = document.createElement('div');
                item.className = 'chat-item';
                item.innerHTML = `<strong>${user.displayName || 'Контакт'}</strong><br><small>${user.phoneNumber}</small>`;
                item.onclick = () => openChat(user);
                list.appendChild(item);
                count++;
            }
        });
        if (count === 0) list.innerHTML = '<div style="padding:20px; text-align:center; color:#888;">Нет активных чатов</div>';
    });
}

// ИЗОБРАЖЕНИЯ
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
