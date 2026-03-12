import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { getDatabase, ref, get, update, set } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyBKp-HUZXSGSfBfEhl-HIjaC3Yflpqxg7s",
    authDomain: "kotogram-9b0b9.firebaseapp.com",
    databaseURL: "https://kotogram-9b0b9-default-rtdb.firebaseio.com",
    projectId: "kotogram-9b0b9",
    storageBucket: "kotogram-9b0b9.firebasestorage.app",
    messagingSenderId: "755607509917",
    appId: "1:755607509917:web:29b1b85eea516bde702d74"
};

const IMGBB_API_KEY = "706ffb03d5653cdf91990abac2ce7a29";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

let currentUser = null;
let newAvatarFile = null;

const nameInput = document.getElementById('name-input');
const usernameInput = document.getElementById('username-input');
const bioInput = document.getElementById('bio-input');
const avatarPreview = document.getElementById('avatar-preview');
const saveBtn = document.getElementById('save-btn');
const fixBtn = document.getElementById('fix-db-btn');
const errorMsg = document.getElementById('error-msg');

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        try {
            const snapshot = await get(ref(db, 'users/' + user.uid));
            if (snapshot.exists()) {
                const data = snapshot.val();
                nameInput.value = data.displayName || '';
                usernameInput.value = data.username || '';
                bioInput.value = data.bio || '';
                avatarPreview.src = data.photoURL || 'https://via.placeholder.com/150/cccccc/ffffff?text=?';
            }
        } catch (error) {
            console.error("Ошибка загрузки профиля:", error);
            errorMsg.textContent = "Не удалось загрузить данные. Нажмите 'Починить базу'.";
        }
    } else {
        window.location.href = "../login/login.html";
    }
});

document.getElementById('back-btn').onclick = () => {
    window.location.href = "../main/main.html";
};

document.getElementById('avatar-wrapper').onclick = () => {
    document.getElementById('avatar-input').click();
};

document.getElementById('avatar-input').onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
        newAvatarFile = file;
        const reader = new FileReader();
        reader.onload = (event) => {
            avatarPreview.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
};

// --- СТАНДАРТНОЕ СОХРАНЕНИЕ ---
saveBtn.onclick = async () => {
    errorMsg.textContent = '';
    errorMsg.style.color = '#e53935';
    saveBtn.disabled = true;
    saveBtn.textContent = 'Сохранение...';

    try {
        let photoURL = avatarPreview.src;

        if (newAvatarFile) {
            const fd = new FormData();
            fd.append('image', newAvatarFile);
            
            const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
                method: 'POST',
                body: fd
            });
            const data = await response.json();
            
            if (data.success) {
                photoURL = data.data.url;
            } else {
                throw new Error("Ошибка загрузки фото");
            }
        }

        let cleanUsername = usernameInput.value.trim();
        if (cleanUsername && !cleanUsername.startsWith('@')) {
            cleanUsername = '@' + cleanUsername;
        }

        const updates = {
            displayName: nameInput.value.trim(),
            username: cleanUsername,
            bio: bioInput.value.trim(),
            photoURL: photoURL.startsWith('data:') ? null : photoURL
        };

        await update(ref(db, 'users/' + currentUser.uid), updates);

        errorMsg.style.color = '#4caf50';
        errorMsg.textContent = 'Настройки успешно сохранены!';
        newAvatarFile = null;
        
        setTimeout(() => {
            window.location.href = "../main/main.html";
        }, 1000);

    } catch (error) {
        console.error(error);
        errorMsg.style.color = '#e53935';
        errorMsg.textContent = 'Ошибка сохранения: ' + error.message;
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Сохранить изменения';
    }
};

// --- 🛠 КНОПКА ПОЧИНКИ БАЗЫ ДАННЫХ 🛠 ---
fixBtn.onclick = async () => {
    if (!currentUser) return;
    
    const confirmFix = confirm("Это принудительно создаст все недостающие поля в вашей карточке базы данных. Продолжить?");
    if (!confirmFix) return;

    fixBtn.disabled = true;
    fixBtn.textContent = "Чиню базу...";

    try {
        let cleanUsername = usernameInput.value.trim();
        if (cleanUsername && !cleanUsername.startsWith('@')) {
            cleanUsername = '@' + cleanUsername;
        }

        // Используем SET вместо UPDATE, чтобы жестко перезаписать узел профиля
        // merge: true оставит старые поля (типа phoneNumber), но добавит новые
        await set(ref(db, 'users/' + currentUser.uid), {
            uid: currentUser.uid,
            phoneNumber: currentUser.phoneNumber || "", // Номер телефона сохраняем
            displayName: nameInput.value.trim() || "Новый пользователь",
            username: cleanUsername || "",
            bio: bioInput.value.trim() || "",
            photoURL: avatarPreview.src.startsWith('data:') ? null : avatarPreview.src,
            banned: false,   // Снимаем бан, если он забагался
            warnings: 0      // Сбрасываем страйки
        });

        alert("✅ База профиля успешно восстановлена! Все поля на месте.");
        errorMsg.style.color = '#4caf50';
        errorMsg.textContent = "База починена. Теперь можно сохранять.";

    } catch (error) {
        console.error(error);
        alert("🚨 Ошибка при починке базы: " + error.message);
    } finally {
        fixBtn.disabled = false;
        fixBtn.textContent = "🛠 Починить базу профиля";
    }
};
