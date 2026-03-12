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

// Расширенный список STUN-серверов для пробития роутеров
const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' } 
    ]
};

// --- ЗВУКИ ЗВОНКА (НОВЫЕ ВЕЧНЫЕ ССЫЛКИ MIXKIT) ---
const dialSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2871/2871-preview.mp3'); 
dialSound.loop = true; 
dialSound.volume = 0.5;

const hangupSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3'); 
hangupSound.volume = 0.7;
// --------------------

let peerConnection = null;
let localStream = null;
let remoteStream = null;
let roomId = null;
let mode = null; 
let currentUser = null;
let iceCandidatesQueue = []; 
let isDialing = false; // Флаг, чтобы знать, когда выключать гудки

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const callStatus = document.getElementById('call-status');
const statusSubtitle = document.getElementById('call-subtitle');
const statusTitle = callStatus.querySelector('h2');

const hangupBtn = document.getElementById('hangup-btn');
const toggleAudioBtn = document.getElementById('toggle-audio-btn');
const toggleVideoBtn = document.getElementById('toggle-video-btn');

const urlParams = new URLSearchParams(window.location.search);
roomId = urlParams.get('room');
mode = urlParams.get('mode');

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        if (!roomId || !mode) {
            alert("Ошибка звонка!");
            window.location.href = "../main/main.html";
            return;
        }
        await initMedia();
    } else {
        window.location.href = "../login/login.html";
    }
});

async function initMedia() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
        statusSubtitle.textContent = "Подключение к серверу...";
        setupWebRTC();
    } catch (error) {
        console.error("Ошибка камеры:", error);
        statusTitle.textContent = "Нет доступа к камере";
        statusSubtitle.textContent = "Разрешите доступ в настройках браузера";
    }
}

async function setupWebRTC() {
    peerConnection = new RTCPeerConnection(configuration);

    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    remoteStream = new MediaStream();
    remoteVideo.srcObject = remoteStream;

    peerConnection.ontrack = event => {
        event.streams[0].getTracks().forEach(track => {
            remoteStream.addTrack(track);
        });
    };

    peerConnection.oniceconnectionstatechange = () => {
        if (peerConnection.iceConnectionState === 'connected') {
            // ТРУБКУ ВЗЯЛИ: Выключаем гудки!
            isDialing = false;
            dialSound.pause();
            dialSound.currentTime = 0;
            
            callStatus.style.opacity = '0'; 
            setTimeout(() => callStatus.style.display = 'none', 500);
        } else if (peerConnection.iceConnectionState === 'disconnected') {
            callStatus.style.display = 'flex';
            callStatus.style.opacity = '1';
            statusTitle.textContent = "Слабый интернет...";
            statusSubtitle.textContent = "Попытка переподключения";
        } else if (peerConnection.iceConnectionState === 'failed') {
            statusTitle.textContent = "Связь потеряна";
            statusSubtitle.textContent = "Не удалось пробить фаервол";
            setTimeout(hangup, 3000);
        }
    };

    if (mode === 'caller') {
        await createOffer();
    } else {
        await joinCall();
    }

    listenForHangup();
}

async function addIceCandidateSafely(candidateData) {
    if (peerConnection.remoteDescription) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidateData));
    } else {
        iceCandidatesQueue.push(candidateData);
    }
}

function processIceQueue() {
    while (iceCandidatesQueue.length > 0) {
        const candidateData = iceCandidatesQueue.shift();
        peerConnection.addIceCandidate(new RTCIceCandidate(candidateData)).catch(e => console.error(e));
    }
}

async function createOffer() {
    statusTitle.textContent = "Вызов...";
    statusSubtitle.textContent = "Ждем ответа собеседника";

    // --- МАГИЯ АВТОПЛЕЯ ДЛЯ ГУДКОВ ---
    isDialing = true;
    dialSound.play().catch(e => {
        console.log("Браузер заблокировал звук. Включится по первому тапу.");
        // Хак: ждем любого клика/тапа по экрану, чтобы обойти блокировку
        document.body.addEventListener('click', function playOnTap() {
            if (isDialing) dialSound.play().catch(err => {});
            document.body.removeEventListener('click', playOnTap);
        }, { once: true });
    });

    const roomRef = ref(db, `calls/${roomId}`);
    const callerCandidatesRef = ref(db, `calls/${roomId}/callerCandidates`);
    const receiverCandidatesRef = ref(db, `calls/${roomId}/receiverCandidates`);

    peerConnection.onicecandidate = event => {
        if (event.candidate) push(callerCandidatesRef, event.candidate.toJSON());
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    await set(roomRef, {
        offer: { type: offer.type, sdp: offer.sdp },
        caller: currentUser.uid,
        status: 'calling'
    });

    onValue(roomRef, async snapshot => {
        const data = snapshot.val();
        if (!peerConnection.currentRemoteDescription && data && data.answer) {
            const answer = new RTCSessionDescription(data.answer);
            await peerConnection.setRemoteDescription(answer);
            processIceQueue(); 
        }
    });

    onChildAdded(receiverCandidatesRef, snapshot => {
        const data = snapshot.val();
        if (data) addIceCandidateSafely(data);
    });
}

async function joinCall() {
    statusTitle.textContent = "Соединение...";
    statusSubtitle.textContent = "Установка канала связи";

    const roomRef = ref(db, `calls/${roomId}`);
    const callerCandidatesRef = ref(db, `calls/${roomId}/callerCandidates`);
    const receiverCandidatesRef = ref(db, `calls/${roomId}/receiverCandidates`);

    peerConnection.onicecandidate = event => {
        if (event.candidate) push(receiverCandidatesRef, event.candidate.toJSON());
    };

    const roomSnapshot = await get(roomRef);
    if (roomSnapshot.exists()) {
        const data = roomSnapshot.val();
        const offer = data.offer;
        
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        await set(ref(db, `calls/${roomId}/answer`), { type: answer.type, sdp: answer.sdp });
        await set(ref(db, `calls/${roomId}/status`), 'answered');
        
        processIceQueue(); 

        onChildAdded(callerCandidatesRef, snapshot => {
            const data = snapshot.val();
            if (data) addIceCandidateSafely(data);
        });
    } else {
        alert("Звонок сброшен");
        hangup();
    }
}

toggleAudioBtn.onclick = () => {
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        toggleAudioBtn.classList.toggle('disabled');
        toggleAudioBtn.querySelector('.material-icons').textContent = audioTrack.enabled ? 'mic' : 'mic_off';
    }
};

toggleVideoBtn.onclick = () => {
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        toggleVideoBtn.classList.toggle('disabled');
        toggleVideoBtn.querySelector('.material-icons').textContent = videoTrack.enabled ? 'videocam' : 'videocam_off';
    }
};

// --- ФУНКЦИЯ СБРОСА ---
async function hangup() {
    if (localStream) localStream.getTracks().forEach(track => track.stop());
    if (remoteStream) remoteStream.getTracks().forEach(track => track.stop());
    if (peerConnection) peerConnection.close();

    // Жестко вырубаем гудки
    isDialing = false;
    dialSound.pause();

    if (roomId) {
        await remove(ref(db, `calls/${roomId}`));
    }
    
    // Играем короткий писк сброса
    callStatus.style.display = 'flex';
    callStatus.style.opacity = '1';
    statusTitle.textContent = "Звонок завершен";
    statusSubtitle.textContent = "";
    
    hangupSound.play().catch(e => console.log(e));

    setTimeout(() => {
        window.location.href = "../main/main.html";
    }, 1500);
}

hangupBtn.onclick = hangup;

function listenForHangup() {
    onValue(ref(db, `calls/${roomId}`), snapshot => {
        if (!snapshot.exists()) {
            hangup();
        }
    });
                  }
