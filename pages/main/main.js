import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { getDatabase, ref, onValue, push, set, serverTimestamp, get, remove, query, orderByChild, equalTo, update } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";

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
let activeIncomingCallId = null;
let isMessageSending = false;

// --- СОЗДАЕМ КОНТЕКСТНОЕ МЕНЮ НА ЛЕТУ ---
const contextMenu = document.createElement('div');
contextMenu.style.cssText = `
    position: fixed; display: none; background: white; border-radius: 8px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.2); z-index: 3000; overflow: hidden;
    flex-direction: column; min-width: 160px; border: 1px solid #eee;
`;
document.body.appendChild(contextMenu);

// Закрываем меню при клике в любое другое место
document.addEventListener('click', () => {
    contextMenu.style.display = 'none';
});

// Функция показа меню
function showContextMenu(x, y, msgKey, msg, isMine, chatId) {
    contextMenu.innerHTML = ''; // Очищаем старые кнопки
    
    // Если сообщение уже удалено, меню не показываем
    if (msg.isDeleted) return;

    // Кнопка "Изменить" (Только для своих текстовых сообщений)
    if (isMine && !msg.imageUrl) {
        const editBtn = document.createElement('div');
        editBtn.innerHTML = '<span class="material-icons" style="font-size: 18px; margin-right: 8px;">edit</span> Изменить';
        editBtn.style.cssText = 'padding: 12px 15px; display: flex; align-items: center; cursor: pointer; color: #333; font-size: 15px; border-bottom: 1px solid #eee;';
        editBtn.onmouseover = () => editBtn.style.background = '#f5f5f5';
        editBtn.onmouseout = () => editBtn.style.background = 'white';
        editBtn.onclick = () => {
            const newText = prompt("Редактировать сообщение:", msg.text);
            if (newText !== null && newText.trim() !== "" && newText !== msg.text) {
                update(ref(db, `chats/${chatId}/messages/${msgKey}`), {
                    text: newText.trim(),
                    isEdited: true,
                    editTime: serverTimestamp()
                });
                
                // Обновляем превью в списке чатов
                const myUid = currentUser.uid;
                const otherUid = currentChatUser.uid;
                update(ref(db, `userChats/${myUid}/${otherUid}`), { lastMessage: newText.trim() });
                update(ref(db, `userChats/${otherUid}/${myUid}`), { lastMessage: newText.trim() });
            }
        };
        contextMenu.appendChild(editBtn);
    }

    // Кнопка "Удалить" (Доступна для всех сообщений)
    const delBtn = document.createElement('div');
    delBtn.innerHTML = '<span class="material-icons" style="font-size: 18px; margin-right: 8px;">delete</span> Удалить';
    delBtn.style.cssText = 'padding: 12px 15px; display: flex; align-items: center; cursor: pointer; color: #e53935; font-size: 15px;';
    delBtn.onmouseover = () => delBtn.style.background = '#ffebee';
    delBtn.onmouseout = () => delBtn.style.background = 'white';
    delBtn.onclick = () => {
        const userName = currentUser.displayName || currentUser.phoneNumber;
        const tombstoneText = msg.imageUrl 
            ? `Фотография удалена пользователем ${userName}` 
            : `Сообщение удалил ${userName}`;

        update(ref(db, `chats/${chatId}/messages/${msgKey}`), {
            isDeleted: true,
            text: tombstoneText,
            imageUrl: null // Удаляем саму картинку
        });
    };
    contextMenu.appendChild(delBtn);

    // Корректируем позицию, чтобы не вылезало за экран
    contextMenu.style.display = 'flex';
    let posX = x;
    let posY = y;
    if (posX + 160 > window.innerWidth) posX = window.innerWidth - 170;
    if (posY + contextMenu.offsetHeight > window.innerHeight) posY = window.innerHeight - contextMenu.offsetHeight - 10;
    
    contextMenu.style.left = posX + 'px';
    contextMenu.style.top = posY + 'px';
}

// ПРОВЕРКА АВТОРИЗАЦИИ
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('drawer-display-name').textContent = user.displayName || "Мой профиль";
        document.getElementById('drawer-phone-number').textContent = user.phoneNumber;
        loadMyActiveChats();
        listenForIncomingCalls(); 
    } else {
        window.location.href = "../login/login.html";
    }
});

// --- ВЫДВИЖНОЕ МЕНЮ ---
const drawer = document.getElementById('drawer');
const drawerOverlay = document.getElementById('drawer-overlay');

document.getElementById('burger-menu-btn').onclick = () => {
    drawer.classList.add('open');
    drawerOverlay.classList.add('open');
};
drawerOverlay.onclick = () => {
    drawer.classList.remove('open');
    drawerOverlay.classList.remove('open');
};
document.getElementById('btn-settings').onclick = () => window.location.href = "../settings/settings.html";
document.getElementById('drawer-logout-btn').onclick = () => signOut(auth);

// --- СИСТЕМА ЗВОНКОВ ---
document.getElementById('call-btn').onclick = async () => {
    if (!currentChatUser) return;
    const roomRef = push(ref(db, 'calls'));
    const roomId = roomRef.key;
    await set(roomRef, {
        caller: currentUser.uid, receiver: currentChatUser.uid,
        status: 'calling', timestamp: serverTimestamp()
    });
    window.location.href = `../call/call.html?room=${roomId}&mode=caller`;
};

function listenForIncomingCalls() {
    const callsRef = query(ref(db, 'calls'), orderByChild('receiver'), equalTo(currentUser.uid));
    onValue(callsRef, async (snapshot) => {
        let incomingCallData = null;
        let activeRoomId = null;
        snapshot.forEach(child => {
            const data = child.val();
            if (data.status === 'calling') {
                incomingCallData = data; activeRoomId = child.key;
            }
        });

        const modal = document.getElementById('incoming-call-modal');
        if (incomingCallData && activeRoomId) {
            if (activeIncomingCallId === activeRoomId) return;
            activeIncomingCallId = activeRoomId;
            const callerSnap = await get(ref(db, 'users/' + incomingCallData.caller));
            const callerName = callerSnap.exists() ? (callerSnap.val().displayName || callerSnap.val().phoneNumber) : "Неизвестный";
            document.getElementById('caller-name').textContent = callerName;
            modal.style.display = 'flex';

            document.getElementById('accept-call-btn').onclick = () => {
                activeIncomingCallId = null;
                window.location.href = `../call/call.html?room=${activeRoomId}&mode=receiver`;
            };
            document.getElementById('decline-call-btn').onclick = async () => {
                await remove(ref(db, `calls/${activeRoomId}`));
                modal.style.display = 'none';
                activeIncomingCallId = null;
            };
        } else {
            modal.style.display = 'none';
            activeIncomingCallId = null;
        }
    });
}

// --- ПОИСК И НОВЫЙ ЧАТ ---
const newChatModal = document.getElementById('new-chat-modal');
document.getElementById('new-chat-btn').onclick = () => {
    newChatModal.style.display = 'flex';
    document.getElementById('new-chat-error').textContent = '';
    document.getElementById('new-chat-phone').value = '';
};
document.getElementById('close-new-chat-btn').onclick = () => newChatModal.style.display = 'none';

document.getElementById('start-new-chat-btn').onclick = async () => {
    let rawPhone = document.getElementById('new-chat-phone').value.trim();
    if (!rawPhone) return;
    let searchDigits = rawPhone.replace(/\D/g, ''); 
    const errorEl = document.getElementById('new-chat-error');
    errorEl.textContent = "Ищем пользователя...";

    try {
        const snapshot = await get(ref(db, 'users'));
        if (!snapshot.exists()) return errorEl.textContent = "В KotoGram еще нет пользователей!";
        let foundUser = null;
        snapshot.forEach(child => {
            const userData = child.val();
            const dbDigits = userData.phoneNumber ? userData.phoneNumber.replace(/\D/g, '') : '';
            if (dbDigits === searchDigits) foundUser = userData;
        });

        if (foundUser) {
            if (foundUser.uid === currentUser.uid) return errorEl.textContent = "Нельзя создать чат с самим собой!";
            newChatModal.style.display = 'none';
            openChat(foundUser); 
        } else {
            errorEl.textContent = "Пользователь не найден. Проверьте номер.";
        }
    } catch (e) { errorEl.textContent = "Ошибка базы данных."; }
};

// --- ЛОГИКА ЧАТА ---
function openChat(user) {
    currentChatUser = user;
    document.getElementById('no-chat-selected').style.display = 'none';
    document.getElementById('active-chat').style.display = 'flex';
    document.getElementById('current-chat-name').textContent = user.displayName || user.phoneNumber;
    document.getElementById('app-viewport').classList.add('chat-open');
    loadMessages();
}

document.getElementById('back-to-sidebar-btn').onclick = () => document.getElementById('app-viewport').classList.remove('chat-open');

function loadMessages() {
    if (unsubscribeMessages) unsubscribeMessages();
    const chatId = currentUser.uid < currentChatUser.uid ? 
                   `${currentUser.uid}_${currentChatUser.uid}` : 
                   `${currentChatUser.uid}_${currentUser.uid}`;
    
    unsubscribeMessages = onValue(ref(db, `chats/${chatId}/messages`), (snap) => {
        const container = document.getElementById('messages-container');
        container.innerHTML = '';
        
        snap.forEach(child => {
            const msg = child.val();
            const msgKey = child.key;
            const isMine = msg.senderId === currentUser.uid;

            if (!isMine && msg.status !== 'read' && !msg.isDeleted) {
                update(ref(db, `chats/${chatId}/messages/${msgKey}`), { status: 'read' });
            }

            const div = document.createElement('div');
            div.style.alignSelf = isMine ? 'flex-end' : 'flex-start';
            div.style.background = isMine ? '#effdde' : '#fff';
            div.style.padding = '8px 12px 20px 12px'; 
            div.style.borderRadius = '12px'; 
            div.style.margin = '4px 0';
            div.style.maxWidth = '85%'; 
            div.style.minWidth = '85px';
            div.style.boxShadow = '0 1px 1px rgba(0,0,0,0.1)';
            div.style.position = 'relative';

            // --- ОБРАБОТЧИКИ ДЛЯ КОНТЕКСТНОГО МЕНЮ ---
            let pressTimer;
            // Для ПК (Правая кнопка мыши)
            div.oncontextmenu = (e) => {
                e.preventDefault(); // Убираем стандартное меню браузера
                showContextMenu(e.clientX, e.clientY, msgKey, msg, isMine, chatId);
            };
            // Для Телефонов (Долгое нажатие)
            div.ontouchstart = (e) => {
                pressTimer = setTimeout(() => {
                    showContextMenu(e.touches[0].clientX, e.touches[0].clientY, msgKey, msg, isMine, chatId);
                }, 500); // 0.5 секунды для вызова меню
            };
            div.ontouchend = () => clearTimeout(pressTimer);
            div.ontouchmove = () => clearTimeout(pressTimer);
            // ----------------------------------------

            // Если сообщение УДАЛЕНО
            if (msg.isDeleted) {
                div.style.background = isMine ? '#f1f8e9' : '#f5f5f5';
                div.innerHTML = `<span style="color: #888; font-style: italic; font-size: 14px;">${msg.text}</span>`;
                container.appendChild(div);
                return; // Дальше не рендерим картинки и галочки
            }

            let timeString = '';
            const timeToUse = msg.timestamp || Date.now();
            const date = new Date(timeToUse);
            if (!isNaN(date)) {
                timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }

            // Рендер надписи "Изменено"
            let editedHtml = '';
            if (msg.isEdited && msg.editTime) {
                const editDate = new Date(msg.editTime);
                if (!isNaN(editDate)) {
                    editedHtml = `<span style="font-style: italic; margin-right: 5px;">изменено в ${editDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>`;
                }
            }

            let ticksHtml = '';
            if (isMine) {
                if (msg.status === 'read') {
                    ticksHtml = `<span class="material-icons" style="font-size: 14px; color: #4caf50;">done_all</span>`; 
                } else {
                    ticksHtml = `<span class="material-icons" style="font-size: 14px; color: #888;">done</span>`; 
                }
            }

            if (msg.imageUrl) div.innerHTML += `<img src="${msg.imageUrl}" style="max-width:100%; border-radius:8px; display:block; margin-bottom:5px;">`;
            if (msg.text) div.innerHTML += `<span style="word-break: break-word; line-height: 1.4;">${msg.text}</span>`;
            
            div.innerHTML += `
                <div style="position: absolute; bottom: 4px; right: 10px; display: flex; align-items: center; gap: 3px; font-size: 11px; color: #8a8a8a; white-space: nowrap;">
                    ${editedHtml}
                    <span>${timeString}</span>
                    ${ticksHtml}
                </div>
            `;
            
            container.appendChild(div);
        });
        container.scrollTop = container.scrollHeight;
    });
}

// --- ОТПРАВКА СООБЩЕНИЯ ---
document.getElementById('send-btn').onclick = () => {
    if (isMessageSending) return; 
    const input = document.getElementById('message-input');
    const text = input.value.trim();
    if (text) {
        isMessageSending = true; 
        input.value = ''; 
        sendMessage(text);
        setTimeout(() => { isMessageSending = false; }, 500);
    }
};

document.getElementById('message-input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault(); 
        document.getElementById('send-btn').click(); 
    }
});

function sendMessage(text = '', img = null) {
    if (!currentChatUser) return;
    const myUid = currentUser.uid;
    const otherUid = currentChatUser.uid;
    const chatId = myUid < otherUid ? `${myUid}_${otherUid}` : `${otherUid}_${myUid}`;
    
    const time = serverTimestamp();
    let snippet = text;
    if (!snippet && img) snippet = '📷 Фото';

    push(ref(db, `chats/${chatId}/messages`), {
        senderId: myUid,
        text: text,
        imageUrl: img,
        timestamp: time,
        status: 'sent'
    });

    update(ref(db, `userChats/${myUid}/${otherUid}`), {
        timestamp: time,
        lastMessage: snippet
    });
    update(ref(db, `userChats/${otherUid}/${myUid}`), {
        timestamp: time,
        lastMessage: snippet
    });
}

// --- ЗАГРУЗКА СПИСКА ЧАТОВ ---
function loadMyActiveChats() {
    const myChatsRef = ref(db, 'userChats/' + currentUser.uid);
    onValue(myChatsRef, async (snapshot) => {
        const list = document.getElementById('chat-list');
        
        if (!snapshot.exists()) {
            list.innerHTML = '<div style="padding:20px; text-align:center; color:#888;">Нет чатов.<br>Нажмите на карандаш, чтобы начать общение</div>';
            return;
        }

        const chats = [];
        snapshot.forEach(child => {
            const val = child.val();
            const isObj = typeof val === 'object' && val !== null;
            chats.push({
                uid: child.key,
                timestamp: isObj ? (val.timestamp || 0) : 0,
                lastMessage: isObj ? (val.lastMessage || 'Сообщение') : 'Чат создан'
            });
        });

        chats.sort((a, b) => b.timestamp - a.timestamp);

        const chatPromises = chats.map(c => get(ref(db, 'users/' + c.uid)));
        const usersSnapshots = await Promise.all(chatPromises);
        
        list.innerHTML = '';
        
        chats.forEach((chatMeta, index) => {
            const userSnap = usersSnapshots[index];
            if (userSnap.exists()) {
                const u = userSnap.val();
                const item = document.createElement('div');
                item.className = 'chat-item';
                
                let timeStr = '';
                if (chatMeta.timestamp) {
                    const d = new Date(chatMeta.timestamp);
                    timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                }

                item.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
                        <strong style="font-size: 16px; color: #000; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 70%;">${u.displayName || u.phoneNumber}</strong>
                        <span style="font-size: 12px; color: #888;">${timeStr}</span>
                    </div>
                    <div style="font-size: 14px; color: #888; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${chatMeta.lastMessage}
                    </div>
                `;
                item.onclick = () => openChat(u);
                list.appendChild(item);
            }
        });
    });
}

// --- ИЗОБРАЖЕНИЯ ---
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
    try {
        const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: fd });
        const d = await res.json();
        if (d.success) {
            sendMessage('', d.data.url);
            document.getElementById('image-preview-modal').style.display = 'none';
        }
    } catch (e) { alert("Ошибка ImgBB"); }
    b.disabled = false; b.textContent = 'Отправить';
};
                        
