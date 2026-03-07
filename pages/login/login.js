// Импортируем нужные функции из Firebase CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { 
    getAuth, 
    RecaptchaVerifier, 
    signInWithPhoneNumber 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { 
    getDatabase, 
    ref, 
    set, 
    get 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

// Твой конфиг
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

// Глобальная переменная для сохранения результата подтверждения
let confirmationResult;

// Настройка reCAPTCHA
auth.useDeviceLanguage();
window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
  'size': 'invisible', // Скрытая капча
  'callback': (response) => {
    // reCAPTCHA решена, можно отправлять код
  }
});

// Элементы DOM
const phoneInput = document.getElementById('phone-number');
const sendCodeBtn = document.getElementById('send-code-btn');
const codeInput = document.getElementById('verification-code');
const verifyCodeBtn = document.getElementById('verify-code-btn');
const step1 = document.getElementById('step-1');
const step2 = document.getElementById('step-2');

// Шаг 1: Отправка SMS
sendCodeBtn.addEventListener('click', () => {
    const phoneNumber = phoneInput.value.trim();
    const appVerifier = window.recaptchaVerifier;

    if (!phoneNumber.startsWith('+')) {
        alert("Пожалуйста, введите номер с плюсом и кодом страны.");
        return;
    }

    signInWithPhoneNumber(auth, phoneNumber, appVerifier)
        .then((result) => {
            confirmationResult = result;
            step1.style.display = 'none';
            step2.style.display = 'block';
            alert("Код отправлен!");
        }).catch((error) => {
            console.error("Ошибка при отправке SMS:", error);
            alert("Ошибка при отправке кода. Проверьте консоль.");
        });
});

// Шаг 2: Проверка кода и сохранение в Realtime Database
verifyCodeBtn.addEventListener('click', () => {
    const code = codeInput.value.trim();

    confirmationResult.confirm(code).then((result) => {
        // Успешная авторизация
        const user = result.user;
        
        // Создаем запись пользователя в базе, если ее еще нет
        const userRef = ref(db, 'users/' + user.uid);
        get(userRef).then((snapshot) => {
            if (!snapshot.exists()) {
                set(userRef, {
                    phoneNumber: user.phoneNumber,
                    createdAt: Date.now(),
                    displayName: "New Koto User",
                    avatarUrl: "" // Сюда потом будем кидать ссылки из ImgBB
                });
            }
            // Перенаправляем на главную страницу
            window.location.href = '../main/main.html';
        });

    }).catch((error) => {
        console.error("Неверный код:", error);
        alert("Код введен неверно, попробуйте еще раз.");
    });
});
