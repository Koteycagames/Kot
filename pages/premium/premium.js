import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { getDatabase, ref, get, set, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";

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

let currentUser = null;

// Проверка пользователя
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        
        // Проверяем, может у него уже есть премиум?
        const snap = await get(ref(db, 'users/' + user.uid));
        if (snap.exists() && snap.val().isPremium === true) {
            document.querySelector('.premium-content').innerHTML = `
                <div style="text-align:center; padding: 50px 20px;">
                    <span class="material-icons" style="font-size: 80px; color: #fbc02d; text-shadow: 0 0 20px rgba(251,192,45,0.5);">workspace_premium</span>
                    <h2 style="margin: 20px 0;">Вы в Элите!</h2>
                    <p style="color: #666; font-size: 15px;">У вас уже активирована подписка KotoGram Premium. Наслаждайтесь всеми функциями.</p>
                </div>
            `;
        }
    } else {
        window.location.href = "../login/login.html";
    }
});

document.getElementById('back-btn').onclick = () => {
    window.location.href = "../main/main.html";
};

// Обработка кнопок покупки
const buyButtons = document.querySelectorAll('.buy-btn');
buyButtons.forEach(btn => {
    btn.onclick = async (e) => {
        if (!currentUser) return;
        
        const card = e.target.closest('.plan-card');
        const planType = card.getAttribute('data-plan');
        const planPrice = card.getAttribute('data-price');
        
        btn.disabled = true;
        btn.innerText = 'Оформление...';

        try {
            // Создаем заявку в отдельной ветке premiumRequests
            // Ключом делаем UID, чтобы у одного чела была только одна активная заявка
            await set(ref(db, `premiumRequests/${currentUser.uid}`), {
                userId: currentUser.uid,
                plan: planType,
                price: planPrice,
                currency: 'UAH',
                status: 'pending',
                timestamp: serverTimestamp()
            });

            // Показываем модалку успеха
            document.getElementById('success-modal').style.display = 'flex';
        } catch (error) {
            console.error(error);
            alert("Ошибка при отправке заявки: " + error.message);
        } finally {
            btn.disabled = false;
            btn.innerText = card.classList.contains('ultimate') ? 'Навсегда в элите' : 'Выбрать';
        }
    };
});

document.getElementById('close-modal-btn').onclick = () => {
    document.getElementById('success-modal').style.display = 'none';
};
