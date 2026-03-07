import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getDatabase, ref, push, set, onChildAdded, get } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBKp-HUZXSGSfBfEhl-HIjaC3Yflpqxg7s",
  authDomain: "kotogram-9b0b9.firebaseapp.com",
  databaseURL: "https://kotogram-9b0b9-default-rtdb.firebaseio.com",
  projectId: "kotogram-9b0b9",
  storageBucket: "kotogram-9b0b9.firebasestorage.app",
  messagingSenderId: "755607509917",
  appId: "1:755607509917:web:29b1b85eea516bde702d74"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

const IMGBB_API_KEY = "706ffb03d5653cdf91990abac2ce7a29";

// Элементы
const backBtn = document.getElementById('back-btn');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const chatMessages = document.getElementById('chat-messages');
const attachBtn = document.getElementById('attach-btn');
const imageInput = document.getElementById('image-input');

let currentUser = null;
let currentUserName = "Пользователь";

// Ссылка на общую комнату чата в базе
const messagesRef = ref(db, 'chats/global_room/messages');

// Возврат на главную
backBtn.addEventListener('click', () => {
    window.location.href = '../main/main.html';
});

// Проверка пользователя при входе
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        // Получаем имя текущего пользователя из БД
        const userRef = ref(db, 'users/' + user.uid);
        get(userRef).then((snapshot) => {
            if (snapshot.exists()) {
                currentUserName = snapshot.val().displayName || "Без имени";
            }
        });
        
        // Запускаем прослушку сообщений только после авторизации
        listenForMessages();
    } else {
        window.location.href = '../login/login.html';
    }
});

// Отправка текстового сообщения
sendBtn.addEventListener('click', () => {
    const text = messageInput.value.trim();
    if (text === "") return;

    sendMessageToDB(text, null);
    messageInput.value = ""; // Очищаем поле
});

// Отправка по нажатию Enter на клавиатуре
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendBtn.click();
    }
});

// Нажатие на скрепку открывает выбор файла
attachBtn.addEventListener('click', () => {
    imageInput.click();
});

// Загрузка файла в ImgBB при выборе
imageInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Блокируем интерфейс, пока грузится картинка
    attachBtn.classList.add('uploading');
    
    try {
        const formData = new FormData();
        formData.append('image', file);

        const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        
        if (data.success) {
            const imageUrl = data.data.url;
            // Отправляем сообщение с картинкой (и текстом, если он был введен)
            const text = messageInput.value.trim();
            sendMessageToDB(text, imageUrl);
            messageInput.value = ""; // Очищаем поле
        } else {
            alert("Ошибка загрузки изображения.");
        }
    } catch (error) {
        console.error("Ошибка ImgBB:", error);
        alert("Не удалось загрузить картинку.");
    } finally {
        attachBtn.classList.remove('uploading');
        imageInput.value = ""; // Сбрасываем инпут
    }
});

// Функция записи сообщения в Firebase Realtime DB
function sendMessageToDB(text, imageUrl) {
    const newMessageRef = push(messagesRef);
    set(newMessageRef, {
        uid: currentUser.uid,
        senderName: currentUserName,
        text: text,
        imageUrl: imageUrl,
        timestamp: Date.now()
    });
}

// Прослушка новых сообщений из базы
function listenForMessages() {
    onChildAdded(messagesRef, (snapshot) => {
        const data = snapshot.val();
        displayMessage(data);
    });
}

// Отрисовка сообщения на экране
function displayMessage(data) {
    const isMyMessage = data.uid === currentUser.uid;
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');
    messageDiv.classList.add(isMyMessage ? 'my-message' : 'other-message');

    let contentHTML = '';

    // Имя отправителя (показываем только для чужих сообщений)
    if (!isMyMessage) {
        contentHTML += `<div class="message-sender">${data.senderName}</div>`;
    }

    // Если есть картинка
    if (data.imageUrl) {
        contentHTML += `<img src="${data.imageUrl}" class="message-image" alt="Прикрепленное изображение">`;
    }

    // Если есть текст
    if (data.text) {
        contentHTML += `<div>${data.text}</div>`;
    }

    // Время отправки
    const date = new Date(data.timestamp);
    const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    contentHTML += `<div class="message-time">${timeString}</div>`;

    messageDiv.innerHTML = contentHTML;
    chatMessages.appendChild(messageDiv);

    // Прокручиваем чат в самый низ к новому сообщению
    chatMessages.scrollTop = chatMessages.scrollHeight;
                                               }
