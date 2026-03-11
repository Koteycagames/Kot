import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { getDatabase, ref, get, set } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";

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
let confirmationResult = null;

// --- ПРОВЕРКА БАНА ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const userRef = ref(db, 'users/' + user.uid);
            const userSnap = await get(userRef);
            
            if (userSnap.exists() && userSnap.val().banned === true) {
                alert("🚫 Ваш аккаунт заблокирован администрацией.");
                await signOut(auth);
                window.location.reload();
                return;
            }

            if (!userSnap.exists()) {
                await set(userRef, {
                    uid: user.uid,
                    phoneNumber: user.phoneNumber,
                    displayName: "Новый пользователь",
                    banned: false
                });
            }
            window.location.href = "../main/main.html";
        } catch (error) {
            console.error(error);
        }
    }
});

// --- ОТПРАВКА СМС ---
document.getElementById('send-code-btn').onclick = async () => {
    const phoneNumber = document.getElementById('phone-number').value.trim();
    const errorEl = document.getElementById('login-error');
    if (errorEl) errorEl.textContent = '';

    if (!phoneNumber) {
        if (errorEl) errorEl.textContent = "Введите номер телефона!";
        return;
    }

    const btn = document.getElementById('send-code-btn');
    btn.disabled = true;
    btn.textContent = "Отправка...";

    try {
        // Очищаем старую капчу
        if (window.recaptchaVerifier) {
            window.recaptchaVerifier.clear();
            window.recaptchaVerifier = null;
        }
        const oldDiv = document.getElementById('recaptcha-container');
        if (oldDiv) oldDiv.remove();

        // Создаем новый блок
        const recaptchaDiv = document.createElement('div');
        recaptchaDiv.id = 'recaptcha-container';
        document.body.appendChild(recaptchaDiv);

        // 🔥 ВОТ ОН, ИСПРАВЛЕННЫЙ ПОРЯДОК ПАРАМЕТРОВ! 🔥
        // Сначала контейнер, потом настройки, и только в конце auth
        window.recaptchaVerifier = new RecaptchaVerifier('recaptcha-container', {
            'size': 'invisible'
        }, auth);

        // Отправляем СМС
        confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, window.recaptchaVerifier);
        
        // Успех
        document.getElementById('step-1').style.display = 'none';
        document.getElementById('step-2').style.display = 'block';

    } catch (error) {
        console.error(error);
        if (errorEl) errorEl.textContent = "Ошибка: " + error.message;
        btn.disabled = false;
        btn.textContent = "Получить код";
    }
};

// --- ПРОВЕРКА КОДА ---
document.getElementById('verify-code-btn').onclick = () => {
    const code = document.getElementById('verification-code').value.trim();
    const errorEl = document.getElementById('login-error');
    if (errorEl) errorEl.textContent = '';

    if (!code) {
        if (errorEl) errorEl.textContent = "Введите код!";
        return;
    }

    confirmationResult.confirm(code).catch((error) => {
        console.error(error);
        if (errorEl) errorEl.textContent = "Неверный код из СМС!";
    });
};
