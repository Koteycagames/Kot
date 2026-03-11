import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { getDatabase, ref, get, update } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";

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

const backBtn = document.getElementById('back-btn');
const logoutBtn = document.getElementById('logout-btn');
const saveBtn = document.getElementById('save-btn');
const fixAccountBtn = document.getElementById('fix-account-btn'); // Новая кнопка
const nameInput = document.getElementById('display-name');
const phoneDisplay = document.getElementById('user-phone');
const loadingOverlay = document.getElementById('loading-overlay');

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        phoneDisplay.textContent = user.phoneNumber;
        
        const userRef = ref(db, 'users/' + user.uid);
        try {
            const snapshot = await get(userRef);
            if (snapshot.exists()) {
                const userData = snapshot.val();
                nameInput.value = userData.displayName || "";
            }
        } catch (e) { console.error(e); }
    } else {
        window.location.href = "../login/login.html";
    }
});

backBtn.onclick = () => window.location.href = "../main/main.html";
logoutBtn.onclick = () => signOut(auth);

// --- СОХРАНЕНИЕ ИМЕНИ ---
saveBtn.onclick = async () => {
    const newName = nameInput.value.trim();
    if (!newName) return alert("Имя не может быть пустым!");

    loadingOverlay.style.display = 'flex';
    try {
        await updateProfile(currentUser, { displayName: newName });
        await update(ref(db, 'users/' + currentUser.uid), { displayName: newName });
        
        loadingOverlay.style.display = 'none';
        const originalText = saveBtn.innerHTML;
        saveBtn.innerHTML = '<span class="material-icons">check</span> Сохранено!';
        saveBtn.style.background = '#4caf50';
        setTimeout(() => {
            saveBtn.innerHTML = originalText;
            saveBtn.style.background = '';
        }, 2000);
    } catch (error) {
        loadingOverlay.style.display = 'none';
        alert("Ошибка: " + error.message);
    }
};

// --- ФУНКЦИЯ "ПОЧИНИТЬ АККАУНТ" ---
fixAccountBtn.onclick = async () => {
    if (!currentUser) return;
    
    loadingOverlay.style.display = 'flex';
    try {
        const userRef = ref(db, 'users/' + currentUser.uid);
        const snap = await get(userRef);
        const data = snap.exists() ? snap.val() : {};
        
        let updates = {};
        
        // Проверяем, чего не хватает, и собираем это в объект updates
        if (!data.uid) updates.uid = currentUser.uid;
        if (!data.phoneNumber) updates.phoneNumber = currentUser.phoneNumber;
        if (!data.displayName) updates.displayName = currentUser.displayName || "Без имени";
        
        // В будущем, если добавим аватарки, сюда можно дописать:
        // if (!data.photoUrl) updates.photoUrl = "default_avatar_url";

        // Если нашли что чинить - чиним
        if (Object.keys(updates).length > 0) {
            await update(userRef, updates);
            loadingOverlay.style.display = 'none';
            alert("✅ Аккаунт починен! Добавлены недостающие поля:\n" + Object.keys(updates).join(', '));
        } else {
            loadingOverlay.style.display = 'none';
            alert("✨ С аккаунтом всё в полном порядке, чинить нечего!");
        }
        
    } catch (error) {
        loadingOverlay.style.display = 'none';
        alert("Ошибка при починке: " + error.message);
    }
};
