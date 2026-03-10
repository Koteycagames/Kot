// --- СОЗДАЕМ ЭКРАННУЮ КОНСОЛЬ ДЛЯ ПЛАНШЕТА ---
const debugConsole = document.createElement('div');
debugConsole.style.position = 'fixed';
debugConsole.style.top = '0';
debugConsole.style.left = '0';
debugConsole.style.width = '100%';
debugConsole.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
debugConsole.style.color = '#00FF00'; // Зеленый текст
debugConsole.style.zIndex = '9999';
debugConsole.style.padding = '10px';
debugConsole.style.fontFamily = 'monospace';
debugConsole.style.fontSize = '12px';
debugConsole.style.maxHeight = '40vh';
debugConsole.style.overflowY = 'scroll';
debugConsole.style.pointerEvents = 'none'; // Чтобы не мешала кликать по кнопкам под ней
debugConsole.innerHTML = '<b>ОТЛАДКА (ЖДЕМ ШАГИ):</b><br>';
document.body.appendChild(debugConsole);

function logStep(msg) {
    const line = document.createElement('div');
    line.textContent = msg;
    debugConsole.appendChild(line);
    debugConsole.scrollTop = debugConsole.scrollHeight; // Автоскролл вниз
    
    // Пытаемся вызвать алерт, но если браузер их заблокировал - текст все равно останется на экране
    try { alert(msg); } catch(e) {}
}

// ---------------------------------------------

logStep("Шаг 1: Скрипт login.js начал загрузку! Если ты это видишь, Гитхаб видит файл.");

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { 
    getAuth, 
    RecaptchaVerifier, 
    signInWithPhoneNumber,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { 
    getDatabase, 
    ref, 
    get, 
    set 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";

logStep("Шаг 2: Модули Firebase успешно импортированы!");

// Конфигурация Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBKp-HUZXSGSfBfEhl-HIjaC3Yflpqxg7s",
    authDomain: "kotogram-9b0b9.firebaseapp.com",
    databaseURL: "https://kotogram-9b0b9-default-rtdb.firebaseio.com",
    projectId: "kotogram-9b0b9",
    storageBucket: "kotogram-9b0b9.firebasestorage.app",
    messagingSenderId: "755607509917",
    appId: "1:755607509917:web:29b1b85eea516bde702d74"
};

// Инициализация Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

auth.useDeviceLanguage();

logStep("Шаг 3: Firebase инициализирован, ищем кнопки на странице...");

// Элементы DOM
const phoneStep = document.getElementById('phone-step');
const codeStep = document.getElementById('code-step');
const phoneNumberInput = document.getElementById('phone-number');
const verificationCodeInput = document.getElementById('verification-code');
const sendCodeBtn = document.getElementById('send-code-btn');
const verifyBtn = document.getElementById('verify-btn');
const backBtn = document.getElementById('back-btn');
const authSubtitle = document.getElementById('auth-subtitle');
const errorMessage = document.getElementById('error-message');

let confirmationResult = null;

function showError(msg) {
    if (errorMessage) errorMessage.textContent = msg;
    logStep("ОШИБКА: " + msg);
}

// Проверка, авторизован ли уже пользователь
onAuthStateChanged(auth, (user) => {
    if (user) {
        logStep("Шаг 3.5: Пользователь уже авторизован! Перекидываем в main...");
        window.location.href = "../main/main.html";
    }
});

// Настройка reCAPTCHA
try {
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'send-code-btn', {
        'size': 'invisible',
        'callback': (response) => {
            logStep("reCAPTCHA пройдена успешно!");
        }
    });
    logStep("Шаг 4: reCAPTCHA готова к работе. Ждем нажатия кнопки 'Получить код'...");
} catch (e) {
    showError("Ошибка инициализации reCAPTCHA: " + e.message);
}

// Шаг 1: Отправка СМС-кода
sendCodeBtn.addEventListener('click', () => {
    logStep("Шаг 5: Кнопка нажата! Проверяем введенный номер...");
    
    if (errorMessage) errorMessage.textContent = '';
    const phoneNumber = phoneNumberInput.value.trim();
    
    if (!phoneNumber) {
        showError("Введите номер телефона");
        return;
    }

    sendCodeBtn.disabled = true;
    sendCodeBtn.textContent = "Отправка...";

    logStep("Шаг 6: Отправляем запрос в Firebase для номера " + phoneNumber);

    const appVerifier = window.recaptchaVerifier;

    signInWithPhoneNumber(auth, phoneNumber, appVerifier)
        .then((result) => {
            logStep("Шаг 7: УСПЕХ! СМС отправлено Firebase'ом!");
            confirmationResult = result;
            phoneStep.style.display = 'none';
            codeStep.style.display = 'block';
            authSubtitle.textContent = `Код отправлен на ${phoneNumber}`;
        })
        .catch((error) => {
            logStep(`Шаг 7 (ОШИБКА): Firebase отклонил запрос. ${error.message}`);
            showError(`Firebase Error: ${error.message}`);
            sendCodeBtn.disabled = false;
            sendCodeBtn.textContent = "Получить код";
            
            if (window.recaptchaVerifier) {
                window.recaptchaVerifier.render().then(function(widgetId) {
                    grecaptcha.reset(widgetId);
                }).catch(e => logStep("Ошибка сброса капчи: " + e));
            }
        });
});

// Шаг 2: Проверка кода из СМС
verifyBtn.addEventListener('click', () => {
    logStep("Шаг 8: Кнопка проверки кода нажата.");
    if (errorMessage) errorMessage.textContent = '';
    const code = verificationCodeInput.value.trim();
    
    if (!code) {
        showError("Введите код из СМС");
        return;
    }

    verifyBtn.disabled = true;
    verifyBtn.textContent = "Проверка...";

    confirmationResult.confirm(code)
        .then((result) => {
            const user = result.user;
            logStep("Шаг 9: Код верный! Ищем профиль в базе данных...");
            
            const userRef = ref(db, 'users/' + user.uid);
            get(userRef).then((snapshot) => {
                if (!snapshot.exists()) {
                    logStep("Шаг 10: Новый пользователь, создаем профиль...");
                    set(userRef, {
                        uid: user.uid,
                        phoneNumber: user.phoneNumber,
                        displayName: "Пользователь_" + user.uid.substring(0, 5),
                        avatarUrl: "",
                        status: "online",
                        lastSeen: Date.now()
                    }).then(() => {
                        logStep("Шаг 11: Профиль создан, переходим в main!");
                        window.location.href = "../main/main.html";
                    }).catch(err => showError("Ошибка записи БД: " + err.message));
                } else {
                    logStep("Шаг 10: Пользователь найден, переходим в main!");
                    window.location.href = "../main/main.html";
                }
            }).catch(err => showError("Ошибка чтения БД: " + err.message));
        })
        .catch((error) => {
            logStep(`Ошибка проверки кода: ${error.message}`);
            showError(`Неверный код: ${error.message}`);
            verifyBtn.disabled = false;
            verifyBtn.textContent = "Подтвердить";
        });
});

// Возврат к вводу номера
backBtn.addEventListener('click', () => {
    if (errorMessage) errorMessage.textContent = '';
    codeStep.style.display = 'none';
    phoneStep.style.display = 'block';
    authSubtitle.textContent = "Введите номер телефона для авторизации";
    sendCodeBtn.disabled = false;
    sendCodeBtn.textContent = "Получить код";
    verificationCodeInput.value = '';
});
