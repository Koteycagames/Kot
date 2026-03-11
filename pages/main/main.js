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
let isMessageSending = false; // Блокировка от двойного клика!

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

            if (!isMine && msg.status !== 'read') {
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

            let timeString = '';
            const timeToUse = msg.timestamp || Date.now();
            const date = new Date(timeToUse);
            if (!isNaN(date)) {
                timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
                <div style="position: absolute; bottom: 4px; right: 10px; display: flex; align-items: center; gap: 3px; font-size: 11px; color: #8a8a8a;">
                    <span>${timeString}</span>
                    ${ticksHtml}
                </div>
            `;
            
            container.appendChild(div);
        });
        container.scrollTop = container.scrollHeight;
    });
}

// --- ОТПРАВКА СООБЩЕНИЯ С ЗАЩИТОЙ ОТ ДЮПОВ ---
document.getElementById('send-btn').onclick = () => {
    if (isMessageSending) return; // Если уже отправляем - игнорируем клик
    
    const input = document.getElementById('message-input');
    const text = input.value.trim();
    
    if (text) {
        isMessageSending = true; // Ставим замок
        input.value = ''; // Моментально очищаем инпут для визуала
        sendMessage(text);
        
        // Снимаем замок через 500мс (защита от двойного тапа)
        setTimeout(() => { isMessageSending = false; }, 500);
    }
};

// БОНУС: Отправка по нажатию Enter (Shift+Enter делает перенос строки)
document.getElementById('message-input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault(); // Останавливаем стандартный перенос строки
        document.getElementById('send-btn').click(); // Имитируем клик по кнопке
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


// --- ПРОДВИНУТАЯ ЗАГРУЗКА СПИСКА ЧАТОВ ---
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
        
