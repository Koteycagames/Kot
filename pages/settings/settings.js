import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

let currentUser = null;

// DOM Элементы
const backBtn = document.getElementById('back-btn');
const logoutBtn = document.getElementById('logout-btn');
const saveBtn = document.getElementById('save-btn');
const nameInput = document.getElementById('display-name');
const phoneDisplay = document.getElementById('user-phone');
const loadingOverlay = document.getElementById('loading-overlay');

// Проверка входа и загрузка текущих данных
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        phoneDisplay.textContent = user.phoneNumber;

        // Достаем имя из базы данных
        const userRef = ref(db, 'users/' + user.uid);
        try {
            const snapshot = await get(userRef);
            if (snapshot.exists()) {
                const userData = snapshot.val();
                nameInput.value = userData.displayName || "";
            }
        } catch (e) {
            console.error("Ошибка загрузки профиля:", e);
        }
    } else {
        window.location.href = "../login/login.html";
    }
});

// Кнопка Назад
backBtn.onclick = () => {
    window.location.href = "../main/main.html";
};

// Кнопка Выхода
logoutBtn.onclick = () => {
    signOut(auth);
};

// Сохранение нового имени
saveBtn.onclick = async () => {
    const newName = nameInput.value.trim();
    
    if (!newName) {
        alert("Имя не может быть пустым!");
        return;
    }

    loadingOverlay.style.display = 'flex'; // Показываем крутилку

    try {
        // Обновляем имя во встроенном профиле Firebase Auth
        await updateProfile(currentUser, { displayName: newName });

        // Обновляем имя в нашей базе Realtime Database (чтобы видели другие)
        const userRef = ref(db, 'users/' + currentUser.uid);
        await update(userRef, {
            displayName: newName
        });

        loadingOverlay.style.display = 'none'; // Прячем крутилку
        
        // Маленькая визуальная обратная связь
        const originalText = saveBtn.innerHTML;
        saveBtn.innerHTML = '<span class="material-icons">check</span> Сохранено!';
        saveBtn.style.background = '#4caf50'; // Делаем зеленым
        
        setTimeout(() => {
            saveBtn.innerHTML = originalText;
            saveBtn.style.background = ''; // Возвращаем родной цвет
        }, 2000);

    } catch (error) {
        loadingOverlay.style.display = 'none';
        console.error("Ошибка сохранения:", error);
        alert("Ошибка: " + error.message);
    }
};
