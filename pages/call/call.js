import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { getDatabase, ref, set, onValue, push, onChildAdded, remove, get } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";

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

// Настройки серверов для пробития NAT (чтобы видео шло даже если вы в разных сетях)
const configuration = {
    iceServers: [
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
    ]
};

let peerConnection = null;
let localStream = null;
let remoteStream = null;
let roomId = null;
let mode = null; // 'caller' или 'receiver'
let currentUser = null;

// Элементы UI
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const callStatus = document.getElementById('call-status');
const statusSubtitle = document.getElementById('call-subtitle');

// Кнопки
const hangupBtn = document.getElementById('hangup-btn');
const toggleAudioBtn = document.getElementById('toggle-audio-btn');
const toggleVideoBtn = document.getElementById('toggle-video-btn');

// Читаем параметры из URL (какая комната и кто мы)
const urlParams = new URLSearchParams(window.location.search);
roomId = urlParams.get('room');
mode = urlParams.get('mode');

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        if (!roomId || !mode) {
            alert("Ошибка параметров звонка!");
            window.location.href = "../main/main.html";
            return;
        }
        await initMedia();
    } else {
        window.location.href = "../login/login.html";
    }
});

// 1. Получаем доступ к камере и микрофону
async function initMedia() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
        
        statusSubtitle.textContent = "Подключение к серверу...";
        setupWebRTC();
    } catch (error) {
        console.error("Ошибка доступа к камере:", error);
        callStatus.querySelector('h2').textContent = "Камера недоступна";
        statusSubtitle.textContent = "Проверьте разрешения в браузере";
    }
}

// 2. Настраиваем WebRTC соединение
async function setupWebRTC() {
    peerConnection = new RTCPeerConnection(configuration);

    // Добавляем наши треки (видео и звук) в соединение
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    // Готовим место под видео собеседника
    remoteStream = new MediaStream();
    remoteVideo.srcObject = remoteStream;

    // Как только получаем трек от собеседника - добавляем его в плеер
    peerConnection.ontrack = event => {
        event.streams[0].getTracks().forEach(track => {
            remoteStream.addTrack(track);
        });
        // Убираем черный экран, когда появилось видео
        callStatus.style.opacity = '0'; 
        setTimeout(() => callStatus.style.display = 'none', 500);
    };

    if (mode === 'caller') {
        await createOffer();
    } else {
        await joinCall();
    }

    listenForHangup();
}

// 3. Логика звонящего (Создаем комнату)
async function createOffer() {
    callStatus.querySelector('h2').textContent = "Вызов...";
    statusSubtitle.textContent = "Ждем ответа собеседника";

    const roomRef = ref(db, `calls/${roomId}`);
    const callerCandidatesRef = ref(db, `calls/${roomId}/callerCandidates`);
    const receiverCandidatesRef = ref(db, `calls/${roomId}/receiverCandidates`);

    // Собираем ICE кандидаты (маршруты связи) и шлем в базу
    peerConnection.onicecandidate = event => {
        if (event.candidate) push(callerCandidatesRef, event.candidate.toJSON());
    };

    // Создаем предложение связи (Offer)
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    const roomWithOffer = {
        offer: { type: offer.type, sdp: offer.sdp },
        caller: currentUser.uid,
        status: 'calling'
    };
    await set(roomRef, roomWithOffer);

    // Ждем, пока собеседник ответит (появится Answer в базе)
    onValue(roomRef, async snapshot => {
        const data = snapshot.val();
        if (!peerConnection.currentRemoteDescription && data && data.answer) {
            const answer = new RTCSessionDescription(data.answer);
            await peerConnection.setRemoteDescription(answer);
        }
    });

    // Слушаем маршруты (ICE) от собеседника
    onChildAdded(receiverCandidatesRef, snapshot => {
        const candidate = new RTCIceCandidate(snapshot.val());
        peerConnection.addIceCandidate(candidate);
    });
}

// 4. Логика отвечающего (Принимаем звонок)
async function joinCall() {
    callStatus.querySelector('h2').textContent = "Соединение...";
    statusSubtitle.textContent = "Установка защищенного канала";

    const roomRef = ref(db, `calls/${roomId}`);
    const callerCandidatesRef = ref(db, `calls/${roomId}/callerCandidates`);
    const receiverCandidatesRef = ref(db, `calls/${roomId}/receiverCandidates`);

    // Шлем свои ICE кандидаты
    peerConnection.onicecandidate = event => {
        if (event.candidate) push(receiverCandidatesRef, event.candidate.toJSON());
    };

    const roomSnapshot = await get(roomRef);
    if (roomSnapshot.exists()) {
        const data = roomSnapshot.val();
        const offer = data.offer;
        
        // Принимаем предложение
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        
        // Создаем ответ
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        // Обновляем комнату в базе
        await set(ref(db, `calls/${roomId}/answer`), { type: answer.type, sdp: answer.sdp });
        await set(ref(db, `calls/${roomId}/status`), 'answered');

        // Получаем маршруты от того, кто звонил
        onChildAdded(callerCandidatesRef, snapshot => {
            const candidate = new RTCIceCandidate(snapshot.val());
            peerConnection.addIceCandidate(candidate);
        });
    } else {
        alert("Звонок завершен или не существует.");
        hangup();
    }
}

// 5. Управление кнопками
toggleAudioBtn.onclick = () => {
    const audioTrack = localStream.getAudioTracks()[0];
    audioTrack.enabled = !audioTrack.enabled;
    toggleAudioBtn.classList.toggle('disabled');
    toggleAudioBtn.querySelector('.material-icons').textContent = audioTrack.enabled ? 'mic' : 'mic_off';
};

toggleVideoBtn.onclick = () => {
    const videoTrack = localStream.getVideoTracks()[0];
    videoTrack.enabled = !videoTrack.enabled;
    toggleVideoBtn.classList.toggle('disabled');
    toggleVideoBtn.querySelector('.material-icons').textContent = videoTrack.enabled ? 'videocam' : 'videocam_off';
};

// 6. Завершение звонка
async function hangup() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop());
    }
    if (peerConnection) {
        peerConnection.close();
    }

    // Удаляем комнату из Firebase, чтобы у собеседника тоже сбросилось
    if (roomId) {
        await remove(ref(db, `calls/${roomId}`));
    }

    window.location.href = "../main/main.html";
}

hangupBtn.onclick = hangup;

// Если собеседник положил трубку - удалилась комната
function listenForHangup() {
    onValue(ref(db, `calls/${roomId}`), snapshot => {
        if (!snapshot.exists()) {
            callStatus.style.display = 'flex';
            callStatus.style.opacity = '1';
            callStatus.querySelector('h2').textContent = "Звонок завершен";
            statusSubtitle.textContent = "";
            setTimeout(() => {
                window.location.href = "../main/main.html";
            }, 1500);
        }
    });
}
