import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { getDatabase, ref, onValue, push, set, serverTimestamp, get, remove, query, orderByChild, equalTo } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";

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
let activeIncomingCallId = null; // ФИКС: Запоминаем текущий звонок

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('my-display-name').textContent = user.displayName || "Мой профиль";
        document.getElementById('my-phone-number').textContent = user.phoneNumber;
        loadMyActiveChats();
        listenForIncomingCalls(); 
    } else {
        window.location.href = "../login/login.html";
    }
});

document.getElementById('logout-btn').onclick = () => signOut(auth);

// --- СИСТЕМА ЗВОНКОВ ---

document.getElementById('call-btn').onclick = async () => {
    if (!currentChatUser) return;
    
    const roomRef = push(ref(db, 'calls'));
    const roomId = roomRef.key;

    await set(roomRef, {
        caller: currentUser.uid,
        receiver: currentChatUser.uid,
        status: 'calling',
        timestamp: serverTimestamp()
    });

    window.location.href = `../call/call.html?room=${roomId}&mode=caller`;
};

// ИСПРАВЛЕННЫЙ СЛУХАЧ ЗВОНКОВ
function listenForIncomingCalls() {
    // Слушаем только те звонки, где получатель - МЫ
    const callsRef = query(ref(db, 'calls'), orderByChild('receiver'), equalTo(currentUser.uid));
    
    onValue(callsRef, async (snapshot) => {
        let incomingCallData = null;
        let activeRoomId = null;

        snapshot.forEach(child => {
            const data = child.val();
            if (data.status === 'calling') {
                incomingCallData = data;
                activeRoomId = child.key;
            }
        });

        const modal = document.getElementById('incoming-call-modal');
        
        if (incomingCallData && activeRoomId) {
            // ГЛАВНЫЙ ФИКС: Если мы УЖЕ звоним по этому ID, не сбрасываем окно!
            if (activeIncomingCallId === activeRoomId) return;
            
            activeIncomingCallId = activeRoomId; // Записываем, что звонок начался
            
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
            // Если звонок сбросили на той стороне
            modal.style.display = 'none';
            activeIncomingCallId = null;
        }
    });
}
// --- КОНЕЦ СИСТЕМЫ ЗВОНКОВ ---

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
        if (!snapshot.exists()) {
            errorEl.textContent = "В KotoGram еще нет пользователей!";
            return;
        }

        let foundUser = null;
        snapshot.forEach(child => {
            const userData = child.val();
            const dbDigits = userData.phoneNumber ? userData.phoneNumber.replace(/\D/g, '') : '';
            if (dbDigits === searchDigits) {
                foundUser = userData;
            }
        });

        if (foundUser) {
            if (foundUser.uid === currentUser.uid) {
                errorEl.textContent = "Нельзя создать чат с самим собой!";
                return;
            }
            newChatModal.style.display = 'none';
            openChat(foundUser);
        } else {
            errorEl.textContent = "Пользователь не найден. Проверьте номер.";
        }
    } catch (e) {
        errorEl.textContent = "Ошибка базы данных.";
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
    
    unsubscribeMessages = onValue(ref(db, `chats/${chatId}/messages`), (snap) => {
        const container = document.getElementById('messages-container');
        container.innerHTML = '';
        snap.forEach(c => {
            const m = c.val();
            const d = document.createElement('div');
            const isMine = m.senderId === currentUser.uid;
            d.style.alignSelf = isMine ? 'flex-end' : 'flex-start';
            d.style.background = isMine ? '#effdde' : '#fff';
            d.style.padding = '10px'; d.style.borderRadius = '12px'; d.style.margin = '4px 0';
            d.style.maxWidth = '85%'; d.style.boxShadow = '0 1px 1px rgba(0,0,0,0.1)';

            if (m.imageUrl) d.innerHTML += `<img src="${m.imageUrl}" style="max-width:100%; border-radius:8px; display:block; margin-bottom:5px;">`;
            if (m.text) d.innerHTML += `<span style="word-break: break-word;">${m.text}</span>`;
            container.appendChild(d);
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
        timestamp: serverTimestamp()
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

// ИЗОБРАЖЕНИЯ
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
            
