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

auth.useDeviceLanguage();

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
}

// КРИТИЧЕСКИЙ УЧАСТОК: Сохранение юзера в базу при входе
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userRef = ref(db, 'users/' + user.uid);
        try {
            const snapshot = await get(userRef);
            // Если данных в базе нет - создаем их прямо сейчас
            if (!snapshot.exists()) {
                await set(userRef, {
                    uid: user.uid,
                    phoneNumber: user.phoneNumber,
                    displayName: "Пользователь_" + user.uid.substring(0, 5),
                    avatarUrl: "",
                    status: "online",
                    lastSeen: Date.now()
                });
            }
            // Только после того как убедились, что юзер в базе - пускаем в main
            window.location.href = "../main/main.html";
        } catch (e) {
            console.error("Ошибка БД при входе:", e);
            // Даже если БД тупит, пускаем, но в логах увидим ошибку
            window.location.href = "../main/main.html";
        }
    }
});

window.recaptchaVerifier = new RecaptchaVerifier('recaptcha-container', {
    'size': 'invisible'
}, auth);

sendCodeBtn.addEventListener('click', () => {
    if (errorMessage) errorMessage.textContent = '';
    const phoneNumber = phoneNumberInput.value.trim();
    if (!phoneNumber) return showError("Введите номер");

    sendCodeBtn.disabled = true;
    sendCodeBtn.textContent = "Отправка...";

    signInWithPhoneNumber(auth, phoneNumber, window.recaptchaVerifier)
        .then((result) => {
            confirmationResult = result;
            phoneStep.style.display = 'none';
            codeStep.style.display = 'block';
            authSubtitle.textContent = `Код отправлен на ${phoneNumber}`;
        })
        .catch((error) => {
            showError("Ошибка: " + error.message);
            sendCodeBtn.disabled = false;
            sendCodeBtn.textContent = "Получить код";
            if (window.recaptchaVerifier) {
                window.recaptchaVerifier.render().then(id => grecaptcha.reset(id));
            }
        });
});

verifyBtn.addEventListener('click', () => {
    const code = verificationCodeInput.value.trim();
    if (!code) return showError("Введите код");

    verifyBtn.disabled = true;
    verifyBtn.textContent = "Проверка...";

    confirmationResult.confirm(code)
        .catch((error) => {
            showError("Неверный код");
            verifyBtn.disabled = false;
            verifyBtn.textContent = "Подтвердить";
        });
});

backBtn.addEventListener('click', () => {
    codeStep.style.display = 'none';
    phoneStep.style.display = 'block';
    sendCodeBtn.disabled = false;
    sendCodeBtn.textContent = "Получить код";
});
