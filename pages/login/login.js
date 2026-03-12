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

const phoneStep = document.getElementById('phone-step');
const codeStep = document.getElementById('code-step');
const sendBtn = document.getElementById('send-code-btn');
const verifyBtn = document.getElementById('verify-btn');
const backBtn = document.getElementById('back-btn');
const phoneInput = document.getElementById('phone-number');
const codeInput = document.getElementById('verification-code');
const errorEl = document.getElementById('error-message');

// --- ПРОВЕРКА БАНА ПРИ ВХОДЕ ---
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
            console.error("Ошибка проверки юзера:", error);
        }
    }
});

// --- БРОНЕБОЙНАЯ НАСТРОЙКА КАПЧИ ---
function setupRecaptcha() {
    if (window.recaptchaVerifier) {
        try { window.recaptchaVerifier.clear(); } catch(e) {}
        window.recaptchaVerifier = null;
    }

    // Алгоритм-хакер: пробуем оба варианта Гугла по очереди
    try {
        // Вариант 1 (по документации)
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { 'size': 'invisible' });
    } catch (err1) {
        try {
            // Вариант 2 (фактический)
            window.recaptchaVerifier = new RecaptchaVerifier('recaptcha-container', { 'size': 'invisible' }, auth);
        } catch (err2) {
            console.error("Firebase полностью сошел с ума:", err1, err2);
        }
    }
}

// --- ШАГ 1: ОТПРАВКА СМС ---
sendBtn.onclick = async () => {
    const phoneNumber = phoneInput.value.trim();
    if (errorEl) errorEl.textContent = '';

    if (!phoneNumber) {
        if (errorEl) errorEl.textContent = "Введите номер телефона!";
        return;
    }

    sendBtn.disabled = true;
    sendBtn.textContent = "Отправка...";

    try {
        setupRecaptcha();
        
        confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, window.recaptchaVerifier);
        
        phoneStep.style.display = 'none';
        codeStep.style.display = 'block';
        
        sendBtn.disabled = false;
        sendBtn.textContent = "Получить код";

    } catch (error) {
        console.error("Firebase Error:", error);
        if (errorEl) errorEl.textContent = "Ошибка: " + error.message;
        sendBtn.disabled = false;
        sendBtn.textContent = "Получить код";
    }
};

// --- ШАГ 2: ПРОВЕРКА КОДА ИЗ СМС ---
verifyBtn.onclick = () => {
    const code = codeInput.value.trim();
    if (errorEl) errorEl.textContent = '';

    if (!code) {
        if (errorEl) errorEl.textContent = "Введите код!";
        return;
    }

    verifyBtn.disabled = true;
    verifyBtn.textContent = "Проверка...";

    confirmationResult.confirm(code).catch((error) => {
        console.error(error);
        if (errorEl) errorEl.textContent = "Неверный код из СМС!";
        verifyBtn.disabled = false;
        verifyBtn.textContent = "Подтвердить";
    });
};

// --- ШАГ 3: КНОПКА "НАЗАД К НОМЕРУ" ---
backBtn.onclick = () => {
    codeStep.style.display = 'none';
    phoneStep.style.display = 'block';
    if (errorEl) errorEl.textContent = '';
    codeInput.value = ''; 
};
            
