import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { 
    getDatabase, 
    ref, 
    onValue, 
    push, 
    set, 
    serverTimestamp, 
    get 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";

// Конфигурация Firebase
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

// Глобальные переменные состояния
let currentUser = null;
let currentChatUser = null;
let currentMessagesRef = null;
let unsubscribeMessages = null;
let selectedImageFile = null;

// DOM Элементы
const chatList = document.getElementById('chat-list');
const myDisplayName = document.getElementById('my-display-name');
const myPhoneNumber = document.getElementById('my-phone-number');
const logoutBtn = document.getElementById('logout-btn');

const chatArea = document.getElementById('chat-area');
const noChatSelected = document.getElementById('no-chat-selected');
const activeChat = document.getElementById('active-chat');
const backToSidebarBtn = document.getElementById('back-to-sidebar-btn');

const currentChatName = document.getElementById('current-chat-name');
const currentChatStatus = document.getElementById('current-chat-status');
const messagesContainer = document.getElementById('messages-container');

const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const attachBtn = document.getElementById('attach-btn');
const imageInput = document.getElementById('image-input');

const imagePreviewModal = document.getElementById('image-preview-modal');
const closePreviewBtn = document.getElementById('close-preview-btn');
const previewImage = document.getElementById('preview-image');
const sendImageBtn = document.getElementById('send-image-btn');
const searchInput = document.getElementById('search-input');

// Проверка авторизации
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        loadMyProfile();
        loadUsers();
    } else {
        window.location.href = "../login/login.html";
    }
});

// Выход из аккаунта
logoutBtn.addEventListener('click', () => {
    signOut(auth).then(() => {
        window.location.href = "../login/login.html";
    }).catch((error) => {
        console.error("Ошибка при выходе:", error);
    });
});

// Загрузка своего профиля
function loadMyProfile() {
    const myRef = ref(db, 'users/' + currentUser.uid);
    onValue(myRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            myDisplayName.textContent = data.displayName || "Без имени";
            myPhoneNumber.textContent = data.phoneNumber || currentUser.phoneNumber;
        }
    });
}

// Загрузка списка пользователей
function loadUsers() {
    const usersRef = ref(db, 'users');
    onValue(usersRef, (snapshot) => {
        chatList.innerHTML = '';
        const users = [];
        snapshot.forEach((childSnapshot) => {
            const user = childSnapshot.val();
            if (user.uid !== currentUser.uid) {
                users.push(user);
            }
        });

        if (users.length === 0) {
            chatList.innerHTML = '<div class="info-message">Нет доступных контактов</div>';
            return;
        }

        renderUserList(users);
    });
}

// Отрисовка списка пользователей
function renderUserList(users) {
    chatList.innerHTML = '';
    const filterText = searchInput.value.toLowerCase();
    
    users.forEach(user => {
        const name = user.displayName || user.phoneNumber || "Пользователь";
        if (filterText && !name.toLowerCase().includes(filterText) && !user.phoneNumber.includes(filterText)) {
            return;
        }

        const div = document.createElement('div');
        div.className = 'chat-item';
        div.onclick = () => openChat(user, div);

        div.innerHTML = `
            <div class="avatar-placeholder">
                <span class="material-icons">person</span>
            </div>
            <div class="chat-item-info">
                <div class="chat-item-name">${name}</div>
                <div class="chat-item-last-msg">${user.phoneNumber}</div>
            </div>
        `;
        chatList.appendChild(div);
    });
}

// Поиск по контактам
searchInput.addEventListener('input', () => {
    // Перезагружаем список из кеша Firebase
    const usersRef = ref(db, 'users');
    get(usersRef).then((snapshot) => {
        const users = [];
        snapshot.forEach((child) => {
            const u = child.val();
            if (u.uid !== currentUser.uid) users.push(u);
        });
        renderUserList(users);
    });
});

// Генерация уникального ID для чата (сортируем UID, чтобы ID был одинаковым для обоих)
function getChatId(uid1, uid2) {
    return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
}

// Открытие чата с пользователем
function openChat(user, element) {
    currentChatUser = user;
    
    // Подсветка активного чата в списке
    document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active'));
    if (element) element.classList.add('active');

    // Обновляем шапку чата
    currentChatName.textContent = user.displayName || user.phoneNumber;
    currentChatStatus.textContent = user.status === 'online' ? 'В сети' : 'Был(а) недавно';

    // Показываем область чата
    noChatSelected.style.display = 'none';
    activeChat.style.display = 'flex';
    
    // Для мобильных устройств: открываем чат поверх списка
    chatArea.classList.add('active-mobile');

    // Загрузка сообщений
    loadMessages();
}

// Возврат к списку чатов (для мобилок)
backToSidebarBtn.addEventListener('click', () => {
    chatArea.classList.remove('active-mobile');
});

// Загрузка сообщений
function loadMessages() {
    if (unsubscribeMessages) {
        unsubscribeMessages(); // Отписываемся от предыдущего чата
    }

    const chatId = getChatId(currentUser.uid, currentChatUser.uid);
    const messagesRef = ref(db, `chats/${chatId}/messages`);
    
    unsubscribeMessages = onValue(messagesRef, (snapshot) => {
        messagesContainer.innerHTML = '';
        snapshot.forEach((childSnapshot) => {
            const msg = childSnapshot.val();
            renderMessage(msg);
        });
        // Скроллим вниз
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });
}

// Отрисовка одного сообщения
function renderMessage(msg) {
    const isSent = msg.senderId === currentUser.uid;
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${isSent ? 'sent' : 'received'}`;

    let contentHtml = '';
    if (msg.imageUrl) {
        contentHtml += `<img src="${msg.imageUrl}" class="message-image" alt="Изображение">`;
    }
    if (msg.text) {
        contentHtml += `<div class="message-text">${msg.text}</div>`;
    }

    const timeString = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
    contentHtml += `<span class="message-time">${timeString}</span>`;

    wrapper.innerHTML = `<div class="message-bubble">${contentHtml}</div>`;
    messagesContainer.appendChild(wrapper);
}

// Отправка текстового сообщения
function sendMessage(text, imageUrl = null) {
    if (!text && !imageUrl) return;
    if (!currentChatUser) return;

    const chatId = getChatId(currentUser.uid, currentChatUser.uid);
    const messagesRef = ref(db, `chats/${chatId}/messages`);
    const newMessageRef = push(messagesRef);

    set(newMessageRef, {
        senderId: currentUser.uid,
        text: text,
        imageUrl: imageUrl,
        timestamp: serverTimestamp()
    });

    messageInput.value = '';
    messageInput.style.height = 'auto'; // Сброс высоты textarea
}

// Обработка кнопки отправки
sendBtn.addEventListener('click', () => {
    const text = messageInput.value.trim();
    sendMessage(text);
});

// Отправка по Enter (но Shift+Enter - перенос строки)
messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const text = messageInput.value.trim();
        sendMessage(text);
    }
});

// Авторазмер textarea
messageInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});

// Работа с картинками: открытие выбора файла
attachBtn.addEventListener('click', () => {
    imageInput.click();
});

// Выбор файла и открытие модального окна предпросмотра
imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        selectedImageFile = file;
        const reader = new FileReader();
        reader.onload = function(e) {
            previewImage.src = e.target.result;
            imagePreviewModal.style.display = 'flex';
        };
        reader.readAsDataURL(file);
    }
    // Сбрасываем input, чтобы можно было выбрать тот же файл еще раз
    imageInput.value = ''; 
});

// Закрытие превью
closePreviewBtn.addEventListener('click', () => {
    imagePreviewModal.style.display = 'none';
    selectedImageFile = null;
    previewImage.src = '';
});

// Отправка картинки через ImgBB API
sendImageBtn.addEventListener('click', () => {
    if (!selectedImageFile) return;

    sendImageBtn.disabled = true;
    sendImageBtn.textContent = 'Загрузка...';

    const formData = new FormData();
    formData.append("image", selectedImageFile);

    fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(result => {
        if (result.success) {
            const imageUrl = result.data.url;
            sendMessage('', imageUrl);
            imagePreviewModal.style.display = 'none';
        } else {
            alert("Ошибка загрузки изображения");
        }
    })
    .catch(error => {
        console.error("Ошибка ImgBB:", error);
        alert("Ошибка сети при загрузке изображения");
    })
    .finally(() => {
        sendImageBtn.disabled = false;
        sendImageBtn.textContent = 'Отправить картинку';
        selectedImageFile = null;
        previewImage.src = '';
    });
});

// Авторизация
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        loadUserMenu(user);
        listenToMyChats(user.uid);
    } else {
        window.location.href = '../login/login.html';
    }
});

// Загрузка меню
function loadUserMenu(user) {
    const userRef = ref(db, 'users/' + user.uid);
    get(userRef).then((snap) => {
        if(snap.exists()) {
            const data = snap.val();
            document.getElementById('user-name').textContent = data.displayName || "Без имени";
            document.getElementById('user-phone').textContent = user.phoneNumber;
            document.getElementById('user-avatar').textContent = (data.displayName || "K").charAt(0).toUpperCase();
        }
    });
}

// 1. Поиск по номеру и создание чата
newChatFab.addEventListener('click', () => newChatModal.classList.add('active'));
cancelNewChatBtn.addEventListener('click', () => {
    newChatModal.classList.remove('active');
    newContactPhoneInput.value = '';
});

confirmNewChatBtn.addEventListener('click', async () => {
    const targetPhone = newContactPhoneInput.value.trim();
    if(!targetPhone) return;
    if(targetPhone === currentUser.phoneNumber) {
        alert("Нельзя создать чат с самим собой.");
        return;
    }

    try {
        // Ищем пользователя по номеру в БД
        const usersRef = ref(db, 'users');
        const phoneQuery = query(usersRef, orderByChild('phoneNumber'), equalTo(targetPhone));
        const snapshot = await get(phoneQuery);

        if (snapshot.exists()) {
            // Пользователь найден
            const targetUserData = snapshot.val();
            const targetUid = Object.keys(targetUserData)[0];
            const targetUserInfo = targetUserData[targetUid];

            // Генерируем уникальный ID чата (сортируем UID по алфавиту)
            const chatId = [currentUser.uid, targetUid].sort().join('_');

            // Записываем данные чата в список контактов ОБОИХ пользователей
            const updates = {};
            updates[`userChats/${currentUser.uid}/${chatId}`] = {
                withUid: targetUid,
                withName: targetUserInfo.displayName || "Пользователь",
                withPhone: targetUserInfo.phoneNumber,
                lastMessage: "Чат создан",
                timestamp: Date.now()
            };
            
            // Чтобы получить свое имя для собеседника
            const mySnap = await get(ref(db, `users/${currentUser.uid}`));
            const myName = mySnap.exists() ? mySnap.val().displayName : "Пользователь";

            updates[`userChats/${targetUid}/${chatId}`] = {
                withUid: currentUser.uid,
                withName: myName,
                withPhone: currentUser.phoneNumber,
                lastMessage: "Чат создан",
                timestamp: Date.now()
            };

            await update(ref(db), updates);
            
            newChatModal.classList.remove('active');
            newContactPhoneInput.value = '';
            
            // Автоматически открываем этот чат
            openChat(chatId, targetUid, targetUserInfo.displayName || targetUserInfo.phoneNumber);

        } else {
            alert("Пользователь с таким номером не зарегистрирован в KotoGram.");
        }
    } catch(err) {
        console.error(err);
        alert("Ошибка поиска пользователя.");
    }
});

// 2. Прослушка списка чатов текущего пользователя (Слева)
function listenToMyChats(uid) {
    const myChatsRef = ref(db, `userChats/${uid}`);
    
    onValue(myChatsRef, (snapshot) => {
        // Очищаем список, но возвращаем элемент "Нет чатов" на место
        chatListEl.innerHTML = ''; 
        chatListEl.appendChild(emptyChatListEl);

        if (snapshot.exists()) {
            emptyChatListEl.style.display = 'none';
            const chats = snapshot.val();
            
            // Сортируем чаты по времени (новые сверху)
            const sortedChats = Object.entries(chats).sort((a, b) => b[1].timestamp - a[1].timestamp);

            sortedChats.forEach(([chatId, data]) => {
                const chatItem = document.createElement('div');
                chatItem.classList.add('chat-list-item');
                if(chatId === currentChatId) chatItem.classList.add('active');
                
                chatItem.innerHTML = `
                    <div class="chat-list-avatar">${data.withName.charAt(0).toUpperCase()}</div>
                    <div class="chat-list-info">
                        <div class="chat-list-name">${data.withName}</div>
                        <div class="chat-list-lastmsg">${data.lastMessage}</div>
                    </div>
                `;

                // При клике открываем чат справа
                chatItem.addEventListener('click', () => {
                    document.querySelectorAll('.chat-list-item').forEach(el => el.classList.remove('active'));
                    chatItem.classList.add('active');
                    openChat(chatId, data.withUid, data.withName, data.withPhone);
                });

                chatListEl.appendChild(chatItem);
            });
        } else {
            emptyChatListEl.style.display = 'block';
        }
    });
}

// 3. Открытие конкретного чата (Справа)
function openChat(chatId, otherUid, otherName, otherPhone = "") {
    currentChatId = chatId;
    
    noChatSelectedEl.style.display = 'none';
    activeChatContainer.style.display = 'flex';
    
    document.getElementById('current-chat-name').textContent = otherName;
    document.getElementById('current-chat-phone').textContent = otherPhone;
    document.getElementById('current-chat-avatar').textContent = otherName.charAt(0).toUpperCase();
    
    chatMessagesEl.innerHTML = ''; // Очищаем старые сообщения

    // Отписываемся от предыдущего чата, если он был
    if (activeChatListener) {
        activeChatListener(); 
    }

    // Слушаем сообщения именно этого чата
    const messagesRef = ref(db, `chats/${chatId}/messages`);
    activeChatListener = onChildAdded(messagesRef, (snapshot) => {
        renderMessage(snapshot.val());
    });
}

// 4. Отрисовка сообщения
function renderMessage(data) {
    const isMy = data.uid === currentUser.uid;
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${isMy ? 'my-message' : 'other-message'}`;
    
    let html = '';
    if (data.imageUrl) html += `<img src="${data.imageUrl}" class="message-image">`;
    if (data.text) html += `<div>${data.text}</div>`;
    
    const timeString = new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    html += `<div class="message-time">${timeString}</div>`;
    
    msgDiv.innerHTML = html;
    chatMessagesEl.appendChild(msgDiv);
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

// 5. Отправка сообщения
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const imageInput = document.getElementById('image-input');
const attachBtn = document.getElementById('attach-btn');

sendBtn.addEventListener('click', () => {
    const text = messageInput.value.trim();
    if(!text || !currentChatId) return;
    sendMessage(text, null);
    messageInput.value = '';
});

messageInput.addEventListener('keypress', (e) => {
    if(e.key === 'Enter') sendBtn.click();
});

// Отправка картинки (ImgBB)
attachBtn.addEventListener('click', () => imageInput.click());
imageInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if(!file || !currentChatId) return;
    
    attachBtn.style.opacity = '0.5';
    try {
        const formData = new FormData();
        formData.append('image', file);
        const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: formData });
        const data = await res.json();
        if(data.success) {
            sendMessage(messageInput.value.trim(), data.data.url);
            messageInput.value = '';
        }
    } catch(err) {
        alert("Ошибка загрузки");
    } finally {
        attachBtn.style.opacity = '1';
        imageInput.value = '';
    }
});

// Запись сообщения в базу и обновление последних сообщений у пользователей
function sendMessage(text, imageUrl) {
    const msgRef = push(ref(db, `chats/${currentChatId}/messages`));
    const msgData = {
        uid: currentUser.uid,
        text: text,
        imageUrl: imageUrl,
        timestamp: Date.now()
    };
    
    set(msgRef, msgData);

    // Обновляем "последнее сообщение" в списке чатов (слева) для ОБОИХ пользователей
    const targetUid = currentChatId.split('_').find(id => id !== currentUser.uid);
    const lastMsgText = imageUrl ? "📸 Фотография" : text;
    
    const updates = {};
    updates[`userChats/${currentUser.uid}/${currentChatId}/lastMessage`] = lastMsgText;
    updates[`userChats/${currentUser.uid}/${currentChatId}/timestamp`] = Date.now();
    
    updates[`userChats/${targetUid}/${currentChatId}/lastMessage`] = lastMsgText;
    updates[`userChats/${targetUid}/${currentChatId}/timestamp`] = Date.now();
    
    update(ref(db), updates);
}

// Управление меню
document.getElementById('menu-btn').addEventListener('click', () => {
    document.getElementById('side-menu').classList.add('open');
    document.getElementById('menu-overlay').classList.add('visible');
});
document.getElementById('menu-overlay').addEventListener('click', () => {
    document.getElementById('side-menu').classList.remove('open');
    document.getElementById('menu-overlay').classList.remove('visible');
});
document.getElementById('nav-logout').addEventListener('click', () => signOut(auth));

// Авторизация
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        loadUserMenu(user);
        listenToMyChats(user.uid);
    } else {
        window.location.href = '../login/login.html';
    }
});

// Загрузка меню
function loadUserMenu(user) {
    const userRef = ref(db, 'users/' + user.uid);
    get(userRef).then((snap) => {
        if(snap.exists()) {
            const data = snap.val();
            document.getElementById('user-name').textContent = data.displayName || "Без имени";
            document.getElementById('user-phone').textContent = user.phoneNumber;
            document.getElementById('user-avatar').textContent = (data.displayName || "K").charAt(0).toUpperCase();
        }
    });
}

// 1. Поиск по номеру и создание чата
newChatFab.addEventListener('click', () => newChatModal.classList.add('active'));
cancelNewChatBtn.addEventListener('click', () => {
    newChatModal.classList.remove('active');
    newContactPhoneInput.value = '';
});

confirmNewChatBtn.addEventListener('click', async () => {
    const targetPhone = newContactPhoneInput.value.trim();
    if(!targetPhone) return;
    if(targetPhone === currentUser.phoneNumber) {
        alert("Нельзя создать чат с самим собой.");
        return;
    }

    try {
        // Ищем пользователя по номеру в БД
        const usersRef = ref(db, 'users');
        const phoneQuery = query(usersRef, orderByChild('phoneNumber'), equalTo(targetPhone));
        const snapshot = await get(phoneQuery);

        if (snapshot.exists()) {
            // Пользователь найден
            const targetUserData = snapshot.val();
            const targetUid = Object.keys(targetUserData)[0];
            const targetUserInfo = targetUserData[targetUid];

            // Генерируем уникальный ID чата (сортируем UID по алфавиту)
            const chatId = [currentUser.uid, targetUid].sort().join('_');

            // Записываем данные чата в список контактов ОБОИХ пользователей
            const updates = {};
            updates[`userChats/${currentUser.uid}/${chatId}`] = {
                withUid: targetUid,
                withName: targetUserInfo.displayName || "Пользователь",
                withPhone: targetUserInfo.phoneNumber,
                lastMessage: "Чат создан",
                timestamp: Date.now()
            };
            
            // Чтобы получить свое имя для собеседника
            const mySnap = await get(ref(db, `users/${currentUser.uid}`));
            const myName = mySnap.exists() ? mySnap.val().displayName : "Пользователь";

            updates[`userChats/${targetUid}/${chatId}`] = {
                withUid: currentUser.uid,
                withName: myName,
                withPhone: currentUser.phoneNumber,
                lastMessage: "Чат создан",
                timestamp: Date.now()
            };

            await update(ref(db), updates);
            
            newChatModal.classList.remove('active');
            newContactPhoneInput.value = '';
            
            // Автоматически открываем этот чат
            openChat(chatId, targetUid, targetUserInfo.displayName || targetUserInfo.phoneNumber);

        } else {
            alert("Пользователь с таким номером не зарегистрирован в KotoGram.");
        }
    } catch(err) {
        console.error(err);
        alert("Ошибка поиска пользователя.");
    }
});

// 2. Прослушка списка чатов текущего пользователя (Слева)
function listenToMyChats(uid) {
    const myChatsRef = ref(db, `userChats/${uid}`);
    
    onValue(myChatsRef, (snapshot) => {
        chatListEl.innerHTML = ''; // Очищаем список
        
        if (snapshot.exists()) {
            emptyChatListEl.style.display = 'none';
            const chats = snapshot.val();
            
            // Сортируем чаты по времени (новые сверху)
            const sortedChats = Object.entries(chats).sort((a, b) => b[1].timestamp - a[1].timestamp);

            sortedChats.forEach(([chatId, data]) => {
                const chatItem = document.createElement('div');
                chatItem.classList.add('chat-list-item');
                if(chatId === currentChatId) chatItem.classList.add('active');
                
                chatItem.innerHTML = `
                    <div class="chat-list-avatar">${data.withName.charAt(0).toUpperCase()}</div>
                    <div class="chat-list-info">
                        <div class="chat-list-name">${data.withName}</div>
                        <div class="chat-list-lastmsg">${data.lastMessage}</div>
                    </div>
                `;

                // При клике открываем чат справа
                chatItem.addEventListener('click', () => {
                    document.querySelectorAll('.chat-list-item').forEach(el => el.classList.remove('active'));
                    chatItem.classList.add('active');
                    openChat(chatId, data.withUid, data.withName, data.withPhone);
                });

                chatListEl.appendChild(chatItem);
            });
        } else {
            emptyChatListEl.style.display = 'block';
        }
    });
}

// 3. Открытие конкретного чата (Справа)
function openChat(chatId, otherUid, otherName, otherPhone = "") {
    currentChatId = chatId;
    
    noChatSelectedEl.style.display = 'none';
    activeChatContainer.style.display = 'flex';
    
    document.getElementById('current-chat-name').textContent = otherName;
    document.getElementById('current-chat-phone').textContent = otherPhone;
    document.getElementById('current-chat-avatar').textContent = otherName.charAt(0).toUpperCase();
    
    chatMessagesEl.innerHTML = ''; // Очищаем старые сообщения

    // Отписываемся от предыдущего чата, если он был
    if (activeChatListener) {
        // В Firebase 10+ onChildAdded возвращает функцию отписки
        activeChatListener(); 
    }

    // Слушаем сообщения именно этого чата
    const messagesRef = ref(db, `chats/${chatId}/messages`);
    activeChatListener = onChildAdded(messagesRef, (snapshot) => {
        renderMessage(snapshot.val());
    });
}

// 4. Отрисовка сообщения
function renderMessage(data) {
    const isMy = data.uid === currentUser.uid;
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${isMy ? 'my-message' : 'other-message'}`;
    
    let html = '';
    if (data.imageUrl) html += `<img src="${data.imageUrl}" class="message-image">`;
    if (data.text) html += `<div>${data.text}</div>`;
    
    const timeString = new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    html += `<div class="message-time">${timeString}</div>`;
    
    msgDiv.innerHTML = html;
    chatMessagesEl.appendChild(msgDiv);
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

// 5. Отправка сообщения
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const imageInput = document.getElementById('image-input');
const attachBtn = document.getElementById('attach-btn');

sendBtn.addEventListener('click', () => {
    const text = messageInput.value.trim();
    if(!text || !currentChatId) return;
    sendMessage(text, null);
    messageInput.value = '';
});

messageInput.addEventListener('keypress', (e) => {
    if(e.key === 'Enter') sendBtn.click();
});

// Отправка картинки (ImgBB)
attachBtn.addEventListener('click', () => imageInput.click());
imageInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if(!file || !currentChatId) return;
    
    attachBtn.style.opacity = '0.5';
    try {
        const formData = new FormData();
        formData.append('image', file);
        const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: formData });
        const data = await res.json();
        if(data.success) {
            sendMessage(messageInput.value.trim(), data.data.url);
            messageInput.value = '';
        }
    } catch(err) {
        alert("Ошибка загрузки");
    } finally {
        attachBtn.style.opacity = '1';
        imageInput.value = '';
    }
});

// Запись сообщения в базу и обновление последних сообщений у пользователей
function sendMessage(text, imageUrl) {
    const msgRef = push(ref(db, `chats/${currentChatId}/messages`));
    const msgData = {
        uid: currentUser.uid,
        text: text,
        imageUrl: imageUrl,
        timestamp: Date.now()
    };
    
    set(msgRef, msgData);

    // Обновляем "последнее сообщение" в списке чатов (слева) для ОБОИХ пользователей
    const targetUid = currentChatId.split('_').find(id => id !== currentUser.uid);
    const lastMsgText = imageUrl ? "📸 Фотография" : text;
    
    const updates = {};
    updates[`userChats/${currentUser.uid}/${currentChatId}/lastMessage`] = lastMsgText;
    updates[`userChats/${currentUser.uid}/${currentChatId}/timestamp`] = Date.now();
    
    updates[`userChats/${targetUid}/${currentChatId}/lastMessage`] = lastMsgText;
    updates[`userChats/${targetUid}/${currentChatId}/timestamp`] = Date.now();
    
    update(ref(db), updates);
}

// Управление меню
document.getElementById('menu-btn').addEventListener('click', () => {
    document.getElementById('side-menu').classList.add('open');
    document.getElementById('menu-overlay').classList.add('visible');
});
document.getElementById('menu-overlay').addEventListener('click', () => {
    document.getElementById('side-menu').classList.remove('open');
    document.getElementById('menu-overlay').classList.remove('visible');
});
document.getElementById('nav-logout').addEventListener('click', () => signOut(auth));
