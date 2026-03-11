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

            // Меняем статус на "прочитано", только если сообщение чужое и еще не прочитано
            if (!isMine && msg.status !== 'read') {
                update(ref(db, `chats/${chatId}/messages/${msgKey}`), { status: 'read' });
            }

            const div = document.createElement('div');
            div.style.alignSelf = isMine ? 'flex-end' : 'flex-start';
            div.style.background = isMine ? '#effdde' : '#fff';
            div.style.padding = '8px 12px 20px 12px'; // Место под время и галочки
            div.style.borderRadius = '12px'; 
            div.style.margin = '4px 0';
            div.style.maxWidth = '85%'; 
            div.style.boxShadow = '0 1px 1px rgba(0,0,0,0.1)';
            div.style.position = 'relative';

            // Умная обработка времени
            let timeString = '';
            const timeToUse = msg.timestamp || Date.now();
            const date = new Date(timeToUse);
            if (!isNaN(date)) {
                timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }

            // Галочки
            let ticksHtml = '';
            if (isMine) {
                if (msg.status === 'read') {
                    ticksHtml = `<span class="material-icons" style="font-size: 14px; color: #4caf50;">done_all</span>`; // Две зеленые
                } else {
                    ticksHtml = `<span class="material-icons" style="font-size: 14px; color: #888;">done</span>`; // Одна серая
                }
            }

            if (msg.imageUrl) div.innerHTML += `<img src="${msg.imageUrl}" style="max-width:100%; border-radius:8px; display:block; margin-bottom:5px;">`;
            if (msg.text) div.innerHTML += `<span style="word-break: break-word; line-height: 1.4;">${msg.text}</span>`;
            
            // Блок времени и галочек
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

document.getElementById('send-btn').onclick = () => {
    const text = document.getElementById('message-input').value.trim();
    if (text) sendMessage(text);
};

function sendMessage(text = '', img = null) {
    if (!currentChatUser) return;
    const myUid = currentUser.uid;
    const otherUid = currentChatUser.uid;
    const chatId = myUid < otherUid ? `${myUid}_${otherUid}` : `${otherUid}_${myUid}`;

    push(ref(db, `chats/${chatId}/messages`), {
        senderId: myUid,
        text: text,
        imageUrl: img,
        timestamp: serverTimestamp(),
        status: 'sent'
    });

    set(ref(db, `userChats/${myUid}/${otherUid}`), true);
    set(ref(db, `userChats/${otherUid}/${myUid}`), true);

    document.getElementById('message-input').value = '';
}

function loadMyActiveChats() {
    const myChatsRef = ref(db, 'userChats/' + currentUser.uid);
    onValue(myChatsRef, async (snapshot) => {
        const list = document.getElementById('chat-list');
        list.innerHTML = '';
        
        if (!snapshot.exists()) {
            list.innerHTML = '<div style="padding:20px; text-align:center; color:#888;">Нажмите на карандаш, чтобы начать общение</div>';
            return;
        }

        const chatPromises = [];
        snapshot.forEach(child => chatPromises.push(get(ref(db, 'users/' + child.key))));
        const usersSnapshots = await Promise.all(chatPromises);
        
        usersSnapshots.forEach(userSnap => {
            if (userSnap.exists()) {
                const u = userSnap.val();
                const item = document.createElement('div');
                item.className = 'chat-item';
                item.innerHTML = `<strong>${u.displayName || 'Контакт'}</strong><br><small>${u.phoneNumber}</small>`;
                item.onclick = () => openChat(u);
                list.appendChild(item);
            }
        });
    });
}

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
                                             
