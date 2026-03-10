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

// Ключ ImgBB (пока просто объявляем здесь, основное использование будет в main.js)
const IMGBB_API_KEY = "706ffb03d5653cdf91990abac2ce7a29";

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
const errorMessage = document.getElementById('error-message');
const authSubtitle = document.getElementById('auth-subtitle');

let confirmationResult = null;

// Функции для отображения ошибок
function showError(msg) {
    errorMessage.textContent = msg;
}

function clearError() {
    errorMessage.textContent = '';
}

// Проверка, авторизован ли уже пользователь (если да, сразу кидаем в main)
onAuthStateChanged(auth, (user) => {
    if (user) {
        window.location.href = "main/main.html";
    }
});

// Настройка reCAPTCHA (обязательно для Phone Auth)
window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
    'size': 'invisible',
    'callback': (response) => {
        // reCAPTCHA решена, можно отправлять СМС
    }
});

// Шаг 1: Отправка СМС-кода
sendCodeBtn.addEventListener('click', () => {
    clearError();
    const phoneNumber = phoneNumberInput.value.trim();
    
    if (!phoneNumber) {
        showError("Пожалуйста, введите номер телефона в формате +79991234567");
        return;
    }

    sendCodeBtn.disabled = true;
    sendCodeBtn.textContent = "Отправка...";

    const appVerifier = window.recaptchaVerifier;

    signInWithPhoneNumber(auth, phoneNumber, appVerifier)
        .then((result) => {
            // СМС отправлено успешно
            confirmationResult = result;
            phoneStep.style.display = 'none';
            codeStep.style.display = 'block';
            authSubtitle.textContent = `Код отправлен на ${phoneNumber}`;
        })
        .catch((error) => {
            console.error("Ошибка при отправке СМС:", error);
            showError("Не удалось отправить СМС. Проверьте формат номера.");
            sendCodeBtn.disabled = false;
            sendCodeBtn.textContent = "Получить код";
            
            // Сбрасываем reCAPTCHA, чтобы можно было попробовать снова
            if (window.recaptchaVerifier) {
                window.recaptchaVerifier.render().then(function(widgetId) {
                    grecaptcha.reset(widgetId);
                });
            }
        });
});

// Шаг 2: Проверка кода из СМС
verifyBtn.addEventListener('click', () => {
    clearError();
    const code = verificationCodeInput.value.trim();
    
    if (!code) {
        showError("Пожалуйста, введите код из СМС");
        return;
    }

    verifyBtn.disabled = true;
    verifyBtn.textContent = "Проверка...";

    confirmationResult.confirm(code)
        .then((result) => {
            const user = result.user;
            
            // Проверяем, есть ли такой пользователь в Realtime Database
            const userRef = ref(db, 'users/' + user.uid);
            get(userRef).then((snapshot) => {
                if (!snapshot.exists()) {
                    // Если новый пользователь, создаем ему дефолтный профиль
                    set(userRef, {
                        uid: user.uid,
                        phoneNumber: user.phoneNumber,
                        displayName: "Пользователь_" + user.uid.substring(0, 5),
                        avatarUrl: "",
                        status: "online",
                        lastSeen: Date.now()
                    }).then(() => {
                        window.location.href = "main/main.html";
                    });
                } else {
                    // Если пользователь уже есть, просто пускаем дальше
                    window.location.href = "main/main.html";
                }
            }).catch((dbError) => {
                console.error("Ошибка базы данных:", dbError);
                // В случае ошибки БД все равно пускаем в приложение
                window.location.href = "main/main.html";
            });
        })
        .catch((error) => {
            console.error("Ошибка проверки кода:", error);
            showError("Введен неверный код.");
            verifyBtn.disabled = false;
            verifyBtn.textContent = "Подтвердить";
        });
});

// Шаг 3: Возврат к вводу номера
backBtn.addEventListener('click', () => {
    clearError();
    codeStep.style.display = 'none';
    phoneStep.style.display = 'block';
    authSubtitle.textContent = "Введите номер телефона для авторизации";
    sendCodeBtn.disabled = false;
    sendCodeBtn.textContent = "Получить код";
    verificationCodeInput.value = '';
});
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
