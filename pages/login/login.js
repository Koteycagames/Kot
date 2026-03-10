// Если ты не видишь даже этот первый алерт, значит GitHub не может найти файл login.js 
// (проверь название файла - заглавные/строчные буквы) или блокирует импорты.
alert("Шаг 1: Скрипт login.js начал загрузку!");

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

alert("Шаг 2: Модули Firebase успешно импортированы!");

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

alert("Шаг 3: Firebase инициализирован, ищем элементы на странице...");

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
    alert("ОШИБКА: " + msg);
}

// Проверка, авторизован ли уже пользователь
onAuthStateChanged(auth, (user) => {
    if (user) {
        alert("Пользователь уже авторизован! Перекидываем в main...");
        window.location.href = "../main/main.html";
    }
});

// Настройка reCAPTCHA
try {
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'send-code-btn', {
        'size': 'invisible',
        'callback': (response) => {
            alert("reCAPTCHA пройдена успешно!");
        }
    });
    alert("Шаг 4: reCAPTCHA готова к работе. Ждем нажатия кнопки...");
} catch (e) {
    showError("Ошибка reCAPTCHA: " + e.message);
}

// Шаг 1: Отправка СМС-кода
sendCodeBtn.addEventListener('click', () => {
    alert("Шаг 5: Кнопка нажата! Проверяем номер...");
    
    if (errorMessage) errorMessage.textContent = '';
    const phoneNumber = phoneNumberInput.value.trim();
    
    if (!phoneNumber) {
        showError("Введите номер телефона");
        return;
    }

    sendCodeBtn.disabled = true;
    sendCodeBtn.textContent = "Отправка...";

    alert("Шаг 6: Отправляем запрос в Firebase для " + phoneNumber);

    const appVerifier = window.recaptchaVerifier;

    signInWithPhoneNumber(auth, phoneNumber, appVerifier)
        .then((result) => {
            alert("Шаг 7: УСПЕХ! СМС отправлено!");
            confirmationResult = result;
            phoneStep.style.display = 'none';
            codeStep.style.display = 'block';
            authSubtitle.textContent = `Код отправлен на ${phoneNumber}`;
        })
        .catch((error) => {
            showError(`Firebase Error: ${error.message}`);
            sendCodeBtn.disabled = false;
            sendCodeBtn.textContent = "Получить код";
            
            if (window.recaptchaVerifier) {
                window.recaptchaVerifier.render().then(function(widgetId) {
                    grecaptcha.reset(widgetId);
                }).catch(e => console.log(e));
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
            alert("Код верный! Ищем профиль в базе...");
            
            const userRef = ref(db, 'users/' + user.uid);
            get(userRef).then((snapshot) => {
                if (!snapshot.exists()) {
                    set(userRef, {
                        uid: user.uid,
                        phoneNumber: user.phoneNumber,
                        displayName: "Пользователь_" + user.uid.substring(0, 5),
                        avatarUrl: "",
                        status: "online",
                        lastSeen: Date.now()
                    }).then(() => {
                        window.location.href = "../main/main.html";
                    }).catch(err => showError("Ошибка БД: " + err.message));
                } else {
                    window.location.href = "../main/main.html";
                }
            }).catch(err => showError("Ошибка чтения БД: " + err.message));
        })
        .catch((error) => {
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
