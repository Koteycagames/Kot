import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { getDatabase, ref, get, update } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";

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
let newAvatarFile = null;

const nameInput = document.getElementById('name-input');
const usernameInput = document.getElementById('username-input');
const bioInput = document.getElementById('bio-input');
const avatarPreview = document.getElementById('avatar-preview');
const saveBtn = document.getElementById('save-btn');
const errorMsg = document.getElementById('error-msg');

// Проверка авторизации и загрузка текущих данных
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        try {
            const snapshot = await get(ref(db, 'users/' + user.uid));
            if (snapshot.exists()) {
                const data = snapshot.val();
                nameInput.value = data.displayName || '';
                usernameInput.value = data.username || '';
                bioInput.value = data.bio || '';
                avatarPreview.src = data.photoURL || 'https://via.placeholder.com/150/cccccc/ffffff?text=?';
            }
        } catch (error) {
            console.error("Ошибка загрузки профиля:", error);
            errorMsg.textContent = "Не удалось загрузить данные.";
        }
    } else {
        window.location.href = "../login/login.html";
    }
});

// Кнопка НАЗАД
document.getElementById('back-btn').onclick = () => {
    window.location.href = "../main/main.html";
};

// Выбор новой аватарки
document.getElementById('avatar-wrapper').onclick = () => {
    document.getElementById('avatar-input').click();
};

document.getElementById('avatar-input').onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
        newAvatarFile = file;
        const reader = new FileReader();
        reader.onload = (event) => {
            avatarPreview.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
};

// СОХРАНЕНИЕ ВСЕХ ПОЛЕЙ
saveBtn.onclick = async () => {
    errorMsg.textContent = '';
    errorMsg.style.color = '#e53935';
    
    saveBtn.disabled = true;
    saveBtn.textContent = 'Сохранение...';

    try {
        let photoURL = avatarPreview.src;

        // Если выбрали новую фотку, грузим её на ImgBB
        if (newAvatarFile) {
            const fd = new FormData();
            fd.append('image', newAvatarFile);
            
            const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
                method: 'POST',
                body: fd
            });
            const data = await response.json();
            
            if (data.success) {
                photoURL = data.data.url;
            } else {
                throw new Error("Ошибка загрузки фото");
            }
        }

        // Чистим юзернейм (добавляем @ если его нет, но текст есть)
        let cleanUsername = usernameInput.value.trim();
        if (cleanUsername && !cleanUsername.startsWith('@')) {
            cleanUsername = '@' + cleanUsername;
        }

        // ЖЕЛЕЗОБЕТОННОЕ ОБНОВЛЕНИЕ БАЗЫ ДАННЫХ
        // Создаем или обновляем абсолютно все нужные поля
        const updates = {
            displayName: nameInput.value.trim(),
            username: cleanUsername,
            bio: bioInput.value.trim(),
            photoURL: photoURL.startsWith('data:') ? null : photoURL // защита от багов base64
        };

        await update(ref(db, 'users/' + currentUser.uid), updates);

        // Успех!
        errorMsg.style.color = '#4caf50';
        errorMsg.textContent = 'Настройки успешно сохранены!';
        newAvatarFile = null;
        
        setTimeout(() => {
            window.location.href = "../main/main.html";
        }, 1000);

    } catch (error) {
        console.error(error);
        errorMsg.style.color = '#e53935';
        errorMsg.textContent = 'Ошибка при сохранении: ' + error.message;
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Сохранить изменения';
    }
};
