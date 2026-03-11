import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { getDatabase, ref, get, set } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";

// --- КОНФИГУРАЦИЯ FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyBKp-HUZXSGSfBfEhl-HIjaC3Yflpqxg7s",
    authDomain: "kotogram-9b0b9.firebaseapp.com",
    databaseURL: "https://kotogram-9b0b9-default-rtdb.firebaseio.com",
    projectId: "kotogram-9b0b9",
    storageBucket: "kotogram-9b0b9.firebasestorage.app",
    messagingSenderId: "755607509917",
    appId: "1:755607509917:web:29b1b85eea516bde702d74"
};

// Инициализация
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

let confirmationResult = null;

// --- ГЛАВНАЯ ПРОВЕРКА ПРИ ВХОДЕ (СИСТЕМА БАНОВ) ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const userRef = ref(db, 'users/' + user.uid);
            const userSnap = await get(userRef);
            
            // 1. ПРОВЕРЯЕМ БАН
            if (userSnap.exists() && userSnap.val().banned === true) {
                alert("🚫 Ваш аккаунт заблокирован администрацией за нарушение правил KotoGram.");
                await signOut(auth); // Мгновенно выкидываем
                window.location.reload(); // Перезагружаем страницу
                return;
            }

            // 2. ЕСЛИ НОВЕНЬКИЙ - СОЗДАЕМ ПРОФИЛЬ
            if (!userSnap.exists()) {
                await set(userRef, {
                    uid: user.uid,
                    phoneNumber: user.phoneNumber,
                    displayName: "Новый пользователь",
                    banned: false
                });
            }

            // 3. ЕСЛИ ВСЁ ОК - ПУСКАЕМ В МЕССЕНДЖЕР
            window.location.href = "../main/main.html";

        } catch (error) {
            console.error("Ошибка при проверке пользователя:", error);
            alert("Ошибка подключения к базе данных.");
        }
    }
});

// --- ИСПРАВЛЕННАЯ НАСТРОЙКА RECAPTCHA (Firebase v9) ---
// auth теперь передается ПЕРВЫМ параметром!
// И капча жестко привязана к кнопке 'send-code-btn'
window.recaptchaVerifier = new RecaptchaVerifier(auth, 'send-code-btn', {
    'size': 'invisible',
    'callback': (response) => {
        // Капча пройдена
    }
});

// --- ШАГ 1: ОТПРАВКА СМС ---
document.getElementById('send-code-btn').onclick = () => {
    const phoneNumber = document.getElementById('phone-number').value.trim();
    const errorEl = document.getElementById('login-error');
    errorEl.textContent = '';

    if (!phoneNumber) {
        errorEl.textContent = "Введите номер телефона!";
        return;
    }

    const appVerifier = window.recaptchaVerifier;

    signInWithPhoneNumber(auth, phoneNumber, appVerifier)
        .then((result) => {
            // СМС отправлено успешно
            confirmationResult = result;
            document.getElementById('step-1').style.display = 'none'; // Скрываем ввод номера
            document.getElementById('step-2').style.display = 'block'; // Показываем ввод кода
        }).catch((error) => {
            console.error(error);
            errorEl.textContent = "Ошибка отправки СМС. Проверьте формат номера (+7...).";
            // Сбрасываем капчу при ошибке, чтобы можно было нажать еще раз
            if (window.recaptchaVerifier) {
                window.recaptchaVerifier.render().then(function(widgetId) {
                    grecaptcha.reset(widgetId);
                });
            }
        });
};

// --- ШАГ 2: ПРОВЕРКА КОДА ИЗ СМС ---
document.getElementById('verify-code-btn').onclick = () => {
    const code = document.getElementById('verification-code').value.trim();
    const errorEl = document.getElementById('login-error');
    errorEl.textContent = '';

    if (!code) {
        errorEl.textContent = "Введите код!";
        return;
    }

    confirmationResult.confirm(code).then((result) => {
        // Код верный! Сработает onAuthStateChanged наверху и проверит бан.
    }).catch((error) => {
        console.error(error);
        errorEl.textContent = "Неверный код из СМС!";
    });
};
