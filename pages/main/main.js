import{initializeApp}from"https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";import{getAuth,onAuthStateChanged,signOut}from"https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";import{getDatabase,ref,onValue,push,set,serverTimestamp,get,update,onDisconnect}from"https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";
const firebaseConfig={apiKey:"AIzaSyBKp-HUZXSGSfBfEhl-HIjaC3Yflpqxg7s",authDomain:"kotogram-9b0b9.firebaseapp.com",databaseURL:"https://kotogram-9b0b9-default-rtdb.firebaseio.com",projectId:"kotogram-9b0b9",storageBucket:"kotogram-9b0b9.firebasestorage.app",messagingSenderId:"755607509917",appId:"1:755607509917:web:29b1b85eea516bde702d74"};
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getDatabase(app),$=id=>document.getElementById(id);
let cUser=null;

onAuthStateChanged(auth,async u=>{if(u){const sP=await get(ref(db,'users/'+u.uid)),ud=sP.exists()?sP.val():{};if(ud.banned){alert("🚫 Бан");signOut(auth);return;}cUser=u;$('drawer-display-name').textContent=ud.displayName||"Профиль";$('drawer-phone-number').textContent=ud.phoneNumber||"";$('drawer-username').textContent=ud.username||"";$('drawer-avatar').src=ud.photoURL||"https://via.placeholder.com/150/cccccc/ffffff?text=?";const mSR=ref(db,`status/${u.uid}`);onValue(ref(db,'.info/connected'),s=>{if(s.val()===!0)onDisconnect(mSR).set({state:'offline',last_seen:serverTimestamp()}).then(()=>set(mSR,{state:'online',last_seen:serverTimestamp()}));});loadChats();}else window.location.href="../login/login.html";});

$('burger-menu-btn').onclick=()=>{$('drawer').classList.add('open');$('drawer-overlay').classList.add('open');};
$('drawer-overlay').onclick=()=>{$('drawer').classList.remove('open');$('drawer-overlay').classList.remove('open');};
$('drawer-logout-btn').onclick=()=>signOut(auth);
$('btn-settings').onclick=()=>window.location.href="../settings/settings.html";

$('new-chat-btn').onclick=()=>{$('create-group-modal').style.display='flex';$('new-group-name').value='';};
$('close-create-group-btn').onclick=()=>$('create-group-modal').style.display='none';
$('confirm-create-group-btn').onclick=async()=>{const gn=$('new-group-name').value.trim();if(!gn)return;const gId='g_'+push(ref(db,'groups')).key;await set(ref(db,`groups/${gId}/info`),{name:gn,creator:cUser.uid,timestamp:serverTimestamp(),photoURL:'https://via.placeholder.com/150/3390ec/ffffff?text=G'});await set(ref(db,`groups/${gId}/members/${cUser.uid}`),'creator');await update(ref(db,`userChats/${cUser.uid}/${gId}`),{isGroup:!0,timestamp:serverTimestamp(),lastMessage:'Группа создана'});$('create-group-modal').style.display='none';openInIframe('group',gId);};

let sTmr=null;
$('search-input').oninput=e=>{clearTimeout(sTmr);const q=e.target.value.trim().toLowerCase(),sc=$('search-results-container'),cl=$('chat-list');if(!q){sc.style.display='none';cl.style.display='block';return;}sc.style.display='block';cl.style.display='none';sc.innerHTML='<div style="padding:15px;text-align:center;color:#888;">Поиск...</div>';sTmr=setTimeout(async()=>{const s=await get(ref(db,'users'));if(!s.exists())return sc.innerHTML='<div style="padding:15px;text-align:center;">Пусто</div>';sc.innerHTML='';let f=!1;s.forEach(c=>{const u=c.val();if(u.uid===cUser.uid)return;let p=(u.phoneNumber||'').replace(/\D/g,''),qc=q.replace(/\D/g,'');if((q.startsWith('@')&&u.username?.toLowerCase().includes(q))||(qc&&p.includes(qc))||u.displayName?.toLowerCase().includes(q)||u.username?.toLowerCase().includes(q)){f=!0;const d=document.createElement('div');d.className='chat-item';d.innerHTML=`<img src="${u.photoURL||'https://via.placeholder.com/150'}" class="chat-item-avatar"><div class="chat-item-info"><strong>${u.displayName||u.phoneNumber}</strong><br><span style="font-size:12px;color:#888;">${u.username||''}</span></div>`;d.onclick=()=>{openInIframe('private',u.uid);$('search-input').value='';sc.style.display='none';cl.style.display='block';};sc.appendChild(d);}});if(!f)sc.innerHTML='<div style="padding:15px;text-align:center;">Пусто</div>';},500);};

function loadChats(){onValue(ref(db,'userChats/'+cUser.uid),async s=>{const l=$('chat-list');if(!s.exists())return l.innerHTML='<div style="padding:20px;text-align:center;">Нет чатов</div>';const cs=[];s.forEach(c=>{const v=c.val();cs.push({id:c.key,isGrp:v.isGroup||!1,t:v.timestamp||0,m:v.lastMessage||'Создано'});});cs.sort((a,b)=>b.t-a.t);const cps=cs.map(c=>c.isGrp?get(ref(db,`groups/${c.id}/info`)):get(ref(db,'users/'+c.id))),uss=await Promise.all(cps);l.innerHTML='';cs.forEach((cm,i)=>{if(uss[i].exists()){const u=uss[i].val(),d=document.createElement('div');d.className='chat-item';d.innerHTML=`<img src="${u.photoURL||(cm.isGrp?'https://via.placeholder.com/150/3390ec/ffffff?text=G':'https://via.placeholder.com/150')}" class="chat-item-avatar"><div class="chat-item-info"><strong>${u.name||u.displayName||u.phoneNumber}</strong><br><span style="font-size:13px;color:#888;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;max-width:200px;">${cm.m}</span></div>`;d.onclick=()=>openInIframe(cm.isGrp?'group':'private',cm.id);l.appendChild(d);}});});}

// 🔥 ГЛАВНАЯ МАГИЯ IFRAME 🔥
function openInIframe(type, id){
    $('no-chat-selected').style.display='none';
    const iframe = $('chat-iframe');
    iframe.style.display='block';
    // Загружаем наш отдельный chat.html прямо в правую панель!
    iframe.src=`../chat/chat.html?type=${type}&id=${id}`;
    
    // Для мобилок/планшетов: выдвигаем правую панель
    $('app-viewport').classList.add('chat-open');
}

// Эту функцию сможет вызывать iframe, чтобы закрыть себя на мобилках
window.closeChatFromIframe = function() {
    $('app-viewport').classList.remove('chat-open');
    $('chat-iframe').src = '';
    $('chat-iframe').style.display = 'none';
    $('no-chat-selected').style.display = 'flex';
};
