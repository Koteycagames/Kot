import{initializeApp}from"https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";import{getAuth,onAuthStateChanged}from"https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";import{getDatabase,ref,onValue,push,set,serverTimestamp,get,remove,update}from"https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";
const firebaseConfig={apiKey:"AIzaSyBKp-HUZXSGSfBfEhl-HIjaC3Yflpqxg7s",authDomain:"kotogram-9b0b9.firebaseapp.com",databaseURL:"https://kotogram-9b0b9-default-rtdb.firebaseio.com",projectId:"kotogram-9b0b9",storageBucket:"kotogram-9b0b9.firebasestorage.app",messagingSenderId:"755607509917",appId:"1:755607509917:web:29b1b85eea516bde702d74"};
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getDatabase(app),$=id=>document.getElementById(id);
const GROQ_API="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";

const params=new URLSearchParams(window.location.search), cType=params.get('type'), tId=params.get('id');
let cUser=null,cId=null,unMsgs=null,unGrp=null,rep=null,isGrp=cType==='group',cGrpM={},cGrpP={},myRole='member';

// Закрываем iframe, если жмем "назад"
$('back-btn').onclick=()=>{if(window.parent&&window.parent.closeChatFromIframe)window.parent.closeChatFromIframe();};

onAuthStateChanged(auth,async u=>{if(u){cUser=u;initChat();}else if(window.parent)window.parent.location.href="../../login/login.html";});

async function checkMsg(t){if(!t)return!0;try{const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'Authorization':`Bearer ${GROQ_API}`,'Content-Type':'application/json'},body:JSON.stringify({model:"llama-3.3-70b-versatile",messages:[{role:"system",content:"Ты модератор. Банить ТОЛЬКО за мат."},{role:"user",content:t}],temperature:0,max_tokens:10})}),d=await r.json();return!d.choices[0].message.content.trim().toUpperCase().includes('BAN')}catch(e){return!0}}

async function initChat(){
  if(!isGrp){
    cId=cUser.uid<tId?`${cUser.uid}_${tId}`:`${tId}_${cUser.uid}`;
    const s=await get(ref(db,'users/'+tId)),u=s.exists()?s.val():{};
    $('chat-name').textContent=u.displayName||u.phoneNumber||"Неизвестный";$('chat-avatar').src=u.photoURL||"https://via.placeholder.com/150";
    onValue(ref(db,`status/${tId}`),st=>{const v=st.val();$('chat-status').innerHTML=v?.state==='online'?'<span style="color:#3390ec">в сети</span>':v?`был(а) в ${new Date(v.last_seen).toLocaleTimeString()}`:'недавно';});
  }else{
    cId=tId;$('call-btn').style.display='none';
    unGrp=onValue(ref(db,`groups/${tId}`),s=>{if(!s.exists())return;const d=s.val();cGrpM=d.members||{};cGrpP=d.permissions||{};myRole=cGrpM[cUser.uid]||'member';$('chat-name').textContent=d.info?.name||'Группа';$('chat-avatar').src=d.info?.photoURL||"https://via.placeholder.com/150/3390ec/ffffff?text=G";$('chat-status').textContent=`Участников: ${Object.keys(cGrpM).length}`;
    if(myRole==='creator'||(myRole==='admin'&&(cGrpP[cUser.uid]?.manageUsers||cGrpP[cUser.uid]?.editInfo)))$('group-manage-btn').style.display='flex';});
    buildAdmin();
  }
  loadMsgs();
}

function loadMsgs(){if(unMsgs)unMsgs();unMsgs=onValue(ref(db,`chats/${cId}/messages`),s=>{const c=$('messages-container');c.innerHTML='';s.forEach(ch=>{const m=ch.val(),k=ch.key;const isMe=m.senderId===cUser.uid;const d=document.createElement('div');d.style.cssText=`align-self:${isMe?'flex-end':'flex-start'};background:${isMe?'#effdde':'#fff'};padding:8px 12px;border-radius:12px;margin:4px 0;max-width:85%;`;
let h='';if(isGrp&&!isMe&&m.sName)h+=`<div style="font-size:12px;color:#3390ec;font-weight:bold;">${m.sName}</div>`;if(m.isDeleted)h+=`<i style="color:#888;font-size:14px;">${m.text}</i>`;else h+=`<span>${m.text}</span>`;
d.innerHTML=h;d.ondblclick=()=>{$('reply-box').style.display='flex';$('reply-name').innerText=isMe?'Вы':m.sName||'User';$('reply-text').innerText=m.text;rep={id:k,name:isMe?'Вы':m.sName,text:m.text};};
c.appendChild(d);});c.scrollTop=c.scrollHeight;});}

$('cancel-reply-btn').onclick=()=>{$('reply-box').style.display='none';rep=null;};

$('send-btn').onclick=async()=>{const t=$('message-input').value.trim();if(!t)return;$('message-input').value='';const isC=await checkMsg(t);if(!isC)return alert('Мат запрещен!');
const mD={senderId:cUser.uid,sName:cUser.displayName,text:t,timestamp:serverTimestamp(),status:'sent'};if(rep){mD.replyTo=rep;$('cancel-reply-btn').click();}push(ref(db,`chats/${cId}/messages`),mD);
if(!isGrp){update(ref(db,`userChats/${cUser.uid}/${tId}`),{timestamp:serverTimestamp(),lastMessage:t});update(ref(db,`userChats/${tId}/${cUser.uid}`),{timestamp:serverTimestamp(),lastMessage:t});}else{Object.keys(cGrpM).forEach(u=>update(ref(db,`userChats/${u}/${tId}`),{timestamp:serverTimestamp(),lastMessage:t}));}};

// АДМИНКА ГРУППЫ
function buildAdmin(){
  const gm=$('group-manage-modal');
  gm.innerHTML=`<div class="modal-content"><h3>Управление</h3><input type="text" id="add-m" placeholder="@username" style="width:100%;padding:10px;margin:10px 0;"><button class="btn primary" id="add-btn">Добавить</button><button class="btn" id="close-adm" style="background:#eee;">Закрыть</button></div>`;
  $('group-manage-btn').onclick=()=>gm.style.display='flex';$('close-adm').onclick=()=>gm.style.display='none';
  $('add-btn').onclick=async()=>{const q=$('add-m').value.trim();if(!q)return;const s=await get(ref(db,'users'));let fU=null;s.forEach(c=>{const u=c.val();if(u.username===q)fU=u;});if(fU){await set(ref(db,`groups/${tId}/members/${fU.uid}`),'member');await update(ref(db,`userChats/${fU.uid}/${tId}`),{isGroup:!0,timestamp:serverTimestamp(),lastMessage:'Вас добавили'});alert('Добавлен!');$('add-m').value='';}else alert('Не найден');};
  }
