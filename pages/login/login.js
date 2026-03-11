// --- СИГНАЛИЗАЦИЯ ДЛЯ ПЛАНШЕТА (ПОКАЖЕТ ОШИБКУ НА ЭКРАНЕ) ---
window.onerror = function(msg, url, line) {
    alert("🚨 КРИТИЧЕСКАЯ ОШИБКА JS:\n" + msg + "\nСтрока: " + line);
    return false;
};

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

// ПРОВЕРКА БАНА ПРИ ВХОДЕ
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
            alert("Ошибка базы данных: " + error.message);
        }
    }
});

// ПРОВЕРЯЕМ, СУЩЕСТВУЮТ ЛИ КНОПКИ (чтобы скрипт не падал в тишину)
const sendBtn = document.getElementById('send-code-btn');
const verifyBtn = document.getElementById('verify-code-btn');
const phoneInput = document.getElementById('phone-number');
const errorEl = document.getElementById('login-error');

if (!sendBtn) alert("🚨 Ошибка: В HTML нет кнопки с ID 'send-code-btn'!");
if (!phoneInput) alert("🚨 Ошибка: В HTML нет поля с ID 'phone-number'!");

// БЕЗОПАСНАЯ КАПЧА
try {
    const recaptchaDiv = document.createElement('div');
    recaptchaDiv.id = 'recaptcha-container';
    document.body.appendChild(recaptchaDiv);

    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        'size': 'invisible'
    });
} catch (e) {
    alert("🚨 ОШИБКА КАПЧИ ПРИ ЗАГРУЗКЕ:\n" + e.message);
}

// ОТПРАВКА СМС
if (sendBtn) {
    sendBtn.onclick = async () => {
        try {
            const phoneNumber = phoneInput.value.trim();
            if (errorEl) errorEl.textContent = '';

            if (!phoneNumber) {
                if (errorEl) errorEl.textContent = "Введите номер телефона!";
                else alert("Введите номер телефона!");
                return;
            }

            sendBtn.disabled = true;
            sendBtn.textContent = "Отправка...";

            confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, window.recaptchaVerifier);
            
            const step1 = document.getElementById('step-1');
            const step2 = document.getElementById('step-2');
            if (step1) step1.style.display = 'none';
            if (step2) step2.style.display = 'block';

        } catch (error) {
            alert("🚨 ОШИБКА FIREBASE ПРИ ОТПРАВКЕ:\n" + error.message);
            sendBtn.disabled = false;
            sendBtn.textContent = "Получить код";
        }
    };
}

// ПРОВЕРКА КОДА
if (verifyBtn) {
    verifyBtn.onclick = () => {
        const codeInput = document.getElementById('verification-code');
        if (!codeInput) { alert("🚨 Ошибка: Нет поля 'verification-code'"); return; }
        
        const code = codeInput.value.trim();
        if (!code) return;

        confirmationResult.confirm(code).catch((error) => {
            if (errorEl) errorEl.textContent = "Неверный код из СМС!";
            else alert("Неверный код!");
        });
    };
                    }
