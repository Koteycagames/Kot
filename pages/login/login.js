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

// Устанавливаем язык устройства по умолчанию для СМС
auth.useDeviceLanguage();

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

// Функция для вывода ошибок
function showError(msg) {
    if (errorMessage) {
        errorMessage.textContent = msg;
    }
}

// Проверка, авторизован ли уже пользователь
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Если авторизован, сразу перекидываем в приложение
        window.location.href = "../main/main.html";
    }
});

// Настройка reCAPTCHA
window.recaptchaVerifier = new RecaptchaVerifier(auth, 'send-code-btn', {
    'size': 'invisible',
    'callback': (response) => {
        // reCAPTCHA пройдена успешно
    }
});

// Шаг 1: Отправка СМС-кода
sendCodeBtn.addEventListener('click', () => {
    if (errorMessage) errorMessage.textContent = '';
    const phoneNumber = phoneNumberInput.value.trim();
    
    if (!phoneNumber) {
        showError("Пожалуйста, введите номер телефона");
        return;
    }

    sendCodeBtn.disabled = true;
    sendCodeBtn.textContent = "Отправка...";

    const appVerifier = window.recaptchaVerifier;

    signInWithPhoneNumber(auth, phoneNumber, appVerifier)
        .then((result) => {
            confirmationResult = result;
            phoneStep.style.display = 'none';
            codeStep.style.display = 'block';
            authSubtitle.textContent = `Код отправлен на ${phoneNumber}`;
        })
        .catch((error) => {
            showError(`Ошибка: ${error.message}`);
            sendCodeBtn.disabled = false;
            sendCodeBtn.textContent = "Получить код";
            
            // Сбрасываем reCAPTCHA при ошибке
            if (window.recaptchaVerifier) {
                window.recaptchaVerifier.render().then(function(widgetId) {
                    grecaptcha.reset(widgetId);
                });
            }
        });
});

// Шаг 2: Проверка кода из СМС
verifyBtn.addEventListener('click', () => {
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
            
            // Проверяем профиль в Realtime Database
            const userRef = ref(db, 'users/' + user.uid);
            get(userRef).then((snapshot) => {
                if (!snapshot.exists()) {
                    // Создаем базовый профиль, если его нет
                    set(userRef, {
                        uid: user.uid,
                        phoneNumber: user.phoneNumber,
                        displayName: "Пользователь_" + user.uid.substring(0, 5),
                        avatarUrl: "",
                        status: "online",
                        lastSeen: Date.now()
                    }).then(() => {
                        window.location.href = "../main/main.html";
                    }).catch((err) => showError("Ошибка записи БД: " + err.message));
                } else {
                    // Профиль есть, просто заходим
                    window.location.href = "../main/main.html";
                }
            }).catch((err) => {
                showError("Ошибка чтения БД: " + err.message);
                // Даже при ошибке БД пытаемся пустить внутрь
                window.location.href = "../main/main.html";
            });
        })
        .catch((error) => {
            showError("Неверный код. Попробуйте еще раз.");
            verifyBtn.disabled = false;
            verifyBtn.textContent = "Подтвердить";
        });
});

// Шаг 3: Возврат к вводу номера
backBtn.addEventListener('click', () => {
    if (errorMessage) errorMessage.textContent = '';
    codeStep.style.display = 'none';
    phoneStep.style.display = 'block';
    authSubtitle.textContent = "Введите номер телефона для авторизации";
    sendCodeBtn.disabled = false;
    sendCodeBtn.textContent = "Получить код";
    verificationCodeInput.value = '';
});
