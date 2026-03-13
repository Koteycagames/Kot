import{initializeApp}from"https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";import{getAuth,onAuthStateChanged,signOut}from"https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";import{getDatabase,ref,onValue,push,set,serverTimestamp,get,remove,query,orderByChild,equalTo,update,onDisconnect}from"https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";
const firebaseConfig={apiKey:"AIzaSyBKp-HUZXSGSfBfEhl-HIjaC3Yflpqxg7s",authDomain:"kotogram-9b0b9.firebaseapp.com",databaseURL:"https://kotogram-9b0b9-default-rtdb.firebaseio.com",projectId:"kotogram-9b0b9",storageBucket:"kotogram-9b0b9.firebasestorage.app",messagingSenderId:"755607509917",appId:"1:755607509917:web:29b1b85eea516bde702d74"};
const IMGBB_API_KEY="706ffb03d5653cdf91990abac2ce7a29",app=initializeApp(firebaseConfig),auth=getAuth(app),db=getDatabase(app),$=id=>document.getElementById(id);
let cUser=null,cChatUser=null,unsubMsgs=null,unsubStatus=null,unsubTyping=null,unsubGrp=null,activeCallId=null,isMsgSending=!1,replyMsg=null,typeTmr=null;
let isGrp=!1,cGrpId=null,cGrpInfo={},cGrpMembers={},cGrpPerms={},myRole='member';
const GROQ_API="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";

async function checkMsg(t){if(!t)return!0;try{const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'Authorization':`Bearer ${GROQ_API}`,'Content-Type':'application/json'},body:JSON.stringify({model:"llama-3.3-70b-versatile",messages:[{role:"system",content:"Ты модератор. Банить ТОЛЬКО за мат и прямой хейт. Имена Лысук, Лыска, Кошарик, Кот — святые, это НЕ мат. Ответь BAN или CLEAN."},{role:"user",content:t}],temperature:0,max_tokens:10})}),d=await r.json();if(!r.ok||!d.choices)return!0;return!d.choices[0].message.content.trim().toUpperCase().includes('BAN')}catch(e){return!0}}

const ctxMenu=document.createElement('div');ctxMenu.style.cssText=`position:fixed;display:none;background:white;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.15);z-index:3000;flex-direction:column;min-width:180px;border:1px solid #eaeaea;`;document.body.appendChild(ctxMenu);
document.addEventListener('click',()=>ctxMenu.style.display='none');

function showCtx(x,y,k,m,isM,cId){ctxMenu.innerHTML='';if(m.isDeleted||m.isSystem)return;
const rr=document.createElement('div');rr.style.cssText='display:flex;justify-content:space-around;padding:12px 10px;border-bottom:1px solid #f0f0f0;background:#fafafa;';
['👍','❤️','😂','😲','😢','🙏'].forEach(e=>{const s=document.createElement('span');s.textContent=e;let isSel=(m.reactions&&m.reactions[cUser.uid]===e);s.style.cssText='font-size:22px;cursor:pointer;transition:transform 0.1s;padding:2px;border-radius:50%;'+(isSel?'background:#dcedc8;':'');s.onmouseover=()=>s.style.transform='scale(1.2)';s.onmouseout=()=>s.style.transform='scale(1)';s.onclick=()=>{const rR=ref(db,`chats/${cId}/messages/${k}/reactions/${cUser.uid}`);if(isSel)remove(rR);else set(rR,e);ctxMenu.style.display='none';};rr.appendChild(s);});ctxMenu.appendChild(rr);
const rb=document.createElement('div');rb.innerHTML='<span class="material-icons" style="font-size:18px;margin-right:10px;color:#555;">reply</span> Ответить';rb.style.cssText='padding:12px 15px;display:flex;align-items:center;cursor:pointer;color:#333;font-size:15px;border-bottom:1px solid #f0f0f0;';rb.onmouseover=()=>rb.style.background='#f5f5f5';rb.onmouseout=()=>rb.style.background='white';rb.onclick=()=>{setupReply(k,m,isM?(cUser.displayName||'Вы'):(m.sName||'Пользователь'));ctxMenu.style.display='none';};ctxMenu.appendChild(rb);
if(isM&&!m.imageUrl){const eb=document.createElement('div');eb.innerHTML='<span class="material-icons" style="font-size:18px;margin-right:10px;color:#555;">edit</span> Изменить';eb.style.cssText='padding:12px 15px;display:flex;align-items:center;cursor:pointer;color:#333;font-size:15px;border-bottom:1px solid #f0f0f0;';eb.onmouseover=()=>eb.style.background='#f5f5f5';eb.onmouseout=()=>eb.style.background='white';eb.onclick=async()=>{const nt=prompt("Редактировать сообщение:",m.text);if(nt!==null&&nt.trim()!==""&&nt!==m.text){const isC=await checkMsg(nt.trim());if(!isC){const uR=ref(db,'users/'+cUser.uid),sn=await get(uR);let w=(sn.exists()&&sn.val().warnings)||0;w++;await update(uR,{warnings:w});push(ref(db,`chats/${cId}/messages`),{isSystem:!0,text:`🚨 Изменение отфильтровано (${w}/3)`,timestamp:serverTimestamp()});if(w>=3){push(ref(db,`chats/${cId}/messages`),{isSystem:!0,text:`🚫 Пользователь заблокирован`,timestamp:serverTimestamp()});await update(uR,{banned:!0,warnings:0});setTimeout(async()=>{await signOut(auth);window.location.reload();},1500);}return;}update(ref(db,`chats/${cId}/messages/${k}`),{text:nt.trim(),isEdited:!0,editTime:serverTimestamp()});if(!isGrp){update(ref(db,`userChats/${cUser.uid}/${cChatUser.uid}`),{lastMessage:nt.trim()});update(ref(db,`userChats/${cChatUser.uid}/${cUser.uid}`),{lastMessage:nt.trim()});}else{Object.keys(cGrpMembers).forEach(uid=>update(ref(db,`userChats/${uid}/${cGrpId}`),{lastMessage:nt.trim()}));}}};ctxMenu.appendChild(eb);}
let canDel=isM;if(isGrp&&!isM){if(myRole==='creator')canDel=!0;if(myRole==='admin'&&cGrpPerms[cUser.uid]?.deleteMsgs)canDel=!0;}
if(canDel){const dbn=document.createElement('div');dbn.innerHTML='<span class="material-icons" style="font-size:18px;margin-right:10px;color:#e53935;">delete</span> Удалить';dbn.style.cssText='padding:12px 15px;display:flex;align-items:center;cursor:pointer;color:#e53935;font-size:15px;';dbn.onmouseover=()=>dbn.style.background='#ffebee';dbn.onmouseout=()=>dbn.style.background='white';dbn.onclick=()=>{const tt=!isM?"Сообщение удалено администратором":m.imageUrl?`Фото удалено`:`Сообщение удалено`;update(ref(db,`chats/${cId}/messages/${k}`),{isDeleted:!0,text:tt,imageUrl:null});};ctxMenu.appendChild(dbn);}
ctxMenu.style.display='flex';let px=x,py=y;if(px+180>window.innerWidth)px=window.innerWidth-190;if(py+ctxMenu.offsetHeight>window.innerHeight)py=window.innerHeight-ctxMenu.offsetHeight-10;ctxMenu.style.left=px+'px';ctxMenu.style.top=py+'px';}

onAuthStateChanged(auth,async u=>{if(u){const sP=await get(ref(db,'users/'+u.uid));const ud=sP.exists()?sP.val():{};if(ud.banned===!0){alert("🚫 Ваш аккаунт заблокирован.");await signOut(auth);window.location.href="../login/login.html";return;}cUser=u;
$('drawer-display-name').textContent=ud.displayName||"Мой профиль";$('drawer-phone-number').textContent=ud.phoneNumber||"";$('drawer-username').textContent=ud.username||"";$('drawer-avatar').src=ud.photoURL||"https://via.placeholder.com/150/cccccc/ffffff?text=?";
const mSR=ref(db,`status/${u.uid}`),cR=ref(db,'.info/connected');onValue(cR,s=>{if(s.val()===!0)onDisconnect(mSR).set({state:'offline',last_seen:serverTimestamp()}).then(()=>set(mSR,{state:'online',last_seen:serverTimestamp()}));});loadChats();listenCalls();}else window.location.href="../login/login.html";});

$('burger-menu-btn').onclick=()=>{$('drawer').classList.add('open');$('drawer-overlay').classList.add('open');};
$('drawer-overlay').onclick=()=>{$('drawer').classList.remove('open');$('drawer-overlay').classList.remove('open');};
$('drawer-logout-btn').onclick=()=>signOut(auth);
$('btn-settings').onclick=()=>window.location.href="../settings/settings.html";

$('btn-open-create-group').onclick=()=>{$('drawer').classList.remove('open');$('drawer-overlay').classList.remove('open');$('create-group-modal').style.display='flex';$('new-group-name').value='';};
$('close-create-group-btn').onclick=()=>$('create-group-modal').style.display='none';
$('confirm-create-group-btn').onclick=async()=>{const gn=$('new-group-name').value.trim();if(!gn)return;$('confirm-create-group-btn').disabled=!0;const gId='g_'+push(ref(db,'groups')).key;await set(ref(db,`groups/${gId}/info`),{name:gn,creator:cUser.uid,timestamp:serverTimestamp(),photoURL:'https://via.placeholder.com/150/3390ec/ffffff?text=G'});await set(ref(db,`groups/${gId}/members/${cUser.uid}`),'creator');await update(ref(db,`userChats/${cUser.uid}/${gId}`),{isGroup:!0,timestamp:serverTimestamp(),lastMessage:'Группа создана'});$('create-group-modal').style.display='none';$('confirm-create-group-btn').disabled=!1;};

let searchT=null;
$('search-input').oninput=e=>{clearTimeout(searchT);const q=e.target.value.trim().toLowerCase(),sc=$('search-results-container'),cl=$('chat-list');if(!q){sc.style.display='none';cl.style.display='block';return;}sc.style.display='block';cl.style.display='none';sc.innerHTML='<div style="padding:15px;text-align:center;color:#888;">Поиск...</div>';searchT=setTimeout(async()=>{const s=await get(ref(db,'users'));if(!s.exists()){sc.innerHTML='<div style="padding:15px;text-align:center;color:#888;">Ничего не найдено</div>';return;}sc.innerHTML='';let f=!1;s.forEach(c=>{const u=c.val();if(u.uid===cUser.uid)return;let m=!1;if(q.startsWith('@')){if(u.username&&u.username.toLowerCase().includes(q))m=!0;}else{const p=(u.phoneNumber||'').replace(/\D/g,''),qc=q.replace(/\D/g,'');if((qc&&p.includes(qc))||(u.displayName&&u.displayName.toLowerCase().includes(q))||(u.username&&u.username.toLowerCase().includes(q)))m=!0;}if(m){f=!0;const d=document.createElement('div');d.className='chat-item';d.innerHTML=`<img src="${u.photoURL||'https://via.placeholder.com/150/cccccc/ffffff?text=?'}" class="chat-item-avatar"><div class="chat-item-info"><strong style="display:block;color:#000;">${u.displayName||u.phoneNumber}</strong><span style="font-size:13px;color:#888;">${u.username||''}</span></div>`;d.onclick=()=>{$('search-input').value='';sc.style.display='none';cl.style.display='block';openChat(u,!1);};sc.appendChild(d);}});if(!f)sc.innerHTML='<div style="padding:15px;text-align:center;color:#888;">Ничего не найдено</div>';},500);};

function openChat(u, isG=false, gId=null, gName=''){
  isGrp=isG;cGrpId=gId;$('no-chat-selected').style.display='none';$('active-chat').style.display='flex';$('app-viewport').classList.add('chat-open');cancelReply();
  if(unsubGrp)unsubGrp();$('group-manage-btn').style.display='none';$('call-btn').style.display=isG?'none':'block';
  if(!isG){
    cChatUser=u;$('current-chat-name').textContent=u.displayName||u.phoneNumber;$('current-chat-avatar').src=u.photoURL||"https://via.placeholder.com/150/cccccc/ffffff?text=?";$('current-chat-avatar').style.display='block';$('current-chat-status').textContent='загрузка...';loadMsgs();listenStatus();
  }else{
    cChatUser=null;$('current-chat-name').textContent=gName;$('current-chat-status').textContent='Группа';
    unsubGrp=onValue(ref(db,`groups/${gId}`),s=>{
      if(!s.exists())return;const d=s.val();cGrpInfo=d.info||{};cGrpMembers=d.members||{};cGrpPerms=d.permissions||{};myRole=cGrpMembers[cUser.uid]||'member';
      $('current-chat-name').textContent=cGrpInfo.name;$('current-chat-avatar').src=cGrpInfo.photoURL||"https://via.placeholder.com/150/3390ec/ffffff?text=G";$('current-chat-avatar').style.display='block';
      let mc=Object.keys(cGrpMembers).length;$('current-chat-status').textContent=`Участников: ${mc}`;
      let canManage=myRole==='creator'||(myRole==='admin'&&cGrpPerms[cUser.uid]?.manageUsers)|| (myRole==='admin'&&cGrpPerms[cUser.uid]?.editInfo);
      $('group-manage-btn').style.display=canManage?'block':'none';
    });
    loadMsgs();
  }
}
$('back-to-sidebar-btn').onclick=()=>$('app-viewport').classList.remove('chat-open');

$('group-manage-btn').onclick=()=>{
  $('group-manage-modal').style.display='flex';
  let canE=myRole==='creator'||(myRole==='admin'&&cGrpPerms[cUser.uid]?.editInfo);
  $('group-edit-info-section').style.display=canE?'flex':'none';$('edit-group-name-input').value=cGrpInfo.name||'';
  let canM=myRole==='creator'||(myRole==='admin'&&cGrpPerms[cUser.uid]?.manageUsers);
  $('group-add-member-section').style.display=canM?'flex':'none';$('add-member-input').value='';
  renderMembers();
};
$('close-manage-group-btn').onclick=()=>$('group-manage-modal').style.display='none';
$('save-group-name-btn').onclick=()=>{const nn=$('edit-group-name-input').value.trim();if(nn)update(ref(db,`groups/${cGrpId}/info`),{name:nn});};
$('add-member-btn').onclick=async()=>{
  const q=$('add-member-input').value.trim();if(!q)return;
  const s=await get(ref(db,'users'));let fU=null;s.forEach(c=>{const u=c.val();if(q.startsWith('@')){if(u.username&&u.username.toLowerCase()===q.toLowerCase())fU=u;}else{const p=(u.phoneNumber||'').replace(/\D/g,'');if(p===q.replace(/\D/g,''))fU=u;}});
  if(fU){
    if(cGrpMembers[fU.uid]){alert("Уже в группе!");return;}
    await set(ref(db,`groups/${cGrpId}/members/${fU.uid}`),'member');
    await update(ref(db,`userChats/${fU.uid}/${cGrpId}`),{isGroup:!0,timestamp:serverTimestamp(),lastMessage:'Вас добавили в группу'});
    push(ref(db,`chats/${cGrpId}/messages`),{isSystem:!0,text:`${fU.displayName||fU.phoneNumber} присоединился к группе`,timestamp:serverTimestamp()});
    $('add-member-input').value='';
  }else alert("Пользователь не найден");
};
async function renderMembers(){
  const ml=$('group-members-list');ml.innerHTML='';const uids=Object.keys(cGrpMembers);
  for(let uid of uids){
    const us=await get(ref(db,`users/${uid}`)),u=us.exists()?us.val():{uid:uid,displayName:'Удален'};
    let role=cGrpMembers[uid],perms=cGrpPerms[uid]||{};
    const d=document.createElement('div');d.className='member-card';
    let isMe=uid===cUser.uid, canIEdit=myRole==='creator'||(myRole==='admin'&&cGrpPerms[cUser.uid]?.manageUsers);
    if(role==='creator')canIEdit=!1;if(isMe)canIEdit=!1;
    let html=`<div class="member-header"><div><strong>${u.displayName||u.phoneNumber}</strong> <span style="font-size:12px;color:#888;">${role==='creator'?'👑 Создатель':role==='admin'?'🛡️ Админ':'👤 Участник'}</span></div>`;
    if(canIEdit)html+=`<button class="kick-btn" onclick="kick('${uid}')">Кикнуть</button>`;
    html+=`</div>`;
    if(canIEdit&&myRole==='creator'){
      html+=`<select class="role-select" onchange="chRole('${uid}',this.value)"><option value="member" ${role==='member'?'selected':''}>Участник</option><option value="admin" ${role==='admin'?'selected':''}>Администратор</option></select>`;
      if(role==='admin')html+=`<div class="permissions-box"><div class="perm-row">Изменять название <input type="checkbox" onchange="chPerm('${uid}','editInfo',this.checked)" ${perms.editInfo?'checked':''}></div><div class="perm-row">Удалять чужие SMS <input type="checkbox" onchange="chPerm('${uid}','deleteMsgs',this.checked)" ${perms.deleteMsgs?'checked':''}></div><div class="perm-row">Управлять людьми <input type="checkbox" onchange="chPerm('${uid}','manageUsers',this.checked)" ${perms.manageUsers?'checked':''}></div></div>`;
    }
    d.innerHTML=html;ml.appendChild(d);
  }
}
window.kick=async(uid)=>{if(confirm('Точно удалить?')){await remove(ref(db,`groups/${cGrpId}/members/${uid}`));await remove(ref(db,`groups/${cGrpId}/permissions/${uid}`));await remove(ref(db,`userChats/${uid}/${cGrpId}`));renderMembers();}};
window.chRole=async(uid,r)=>{await set(ref(db,`groups/${cGrpId}/members/${uid}`),r);renderMembers();};
window.chPerm=async(uid,p,v)=>{await set(ref(db,`groups/${cGrpId}/permissions/${uid}/${p}`),v);};

function listenStatus(){if(unsubStatus)unsubStatus();if(unsubTyping)unsubTyping();if(isGrp)return;const sE=$('current-chat-status'),cId=cUser.uid<cChatUser.uid?`${cUser.uid}_${cChatUser.uid}`:`${cChatUser.uid}_${cUser.uid}`;unsubStatus=onValue(ref(db,`status/${cChatUser.uid}`),s=>{const v=s.val();if(!v){sE.textContent='был(а) недавно';return;}if(v.state==='online'){sE.innerHTML='<span style="color:var(--primary-color);">в сети</span>';}else{const d=new Date(v.last_seen||Date.now());sE.textContent=`был(а) в ${d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`;sE.style.color='var(--text-secondary)';}});unsubTyping=onValue(ref(db,`typing/${cId}/${cChatUser.uid}`),s=>{if(s.val()===!0)sE.innerHTML='<span style="color:var(--primary-color);">печатает...</span>';});}
$('message-input').addEventListener('input',()=>{if(isGrp)return;if(!cChatUser)return;const cId=cUser.uid<cChatUser.uid?`${cUser.uid}_${cChatUser.uid}`:`${cChatUser.uid}_${cUser.uid}`;set(ref(db,`typing/${cId}/${cUser.uid}`),!0);clearTimeout(typeTmr);typeTmr=setTimeout(()=>set(ref(db,`typing/${cId}/${cUser.uid}`),!1),1500);});

function loadMsgs(){if(unsubMsgs)unsubMsgs();const cId=isGrp?cGrpId:(cUser.uid<cChatUser.uid?`${cUser.uid}_${cChatUser.uid}`:`${cChatUser.uid}_${cUser.uid}`);unsubMsgs=onValue(ref(db,`chats/${cId}/messages`),s=>{const c=$('messages-container');c.innerHTML='';s.forEach(ch=>{const m=ch.val(),k=ch.key;if(m.isSystem){const d=document.createElement('div');d.style.alignSelf='center';d.style.background='#ffebee';d.style.color='#c62828';d.style.padding='6px 12px';d.style.borderRadius='12px';d.style.margin='8px 0';d.style.fontSize='12px';d.style.fontWeight='bold';d.style.textAlign='center';d.innerText=m.text;c.appendChild(d);return;}const isM=m.senderId===cUser.uid;if(!isM&&m.status!=='read'&&!m.isDeleted&&!isGrp)update(ref(db,`chats/${cId}/messages/${k}`),{status:'read'});const d=document.createElement('div');d.id='msg-'+k;d.style.alignSelf=isM?'flex-end':'flex-start';d.style.background=isM?'#effdde':'#fff';d.style.padding='8px 12px 20px 12px';d.style.borderRadius='12px';d.style.margin='4px 0';d.style.maxWidth='85%';d.style.minWidth='85px';d.style.boxShadow='0 1px 1px rgba(0,0,0,0.1)';d.style.position='relative';let pT;d.oncontextmenu=e=>{e.preventDefault();showCtx(e.clientX,e.clientY,k,m,isM,cId);};d.ontouchstart=e=>{pT=setTimeout(()=>{showCtx(e.touches[0].clientX,e.touches[0].clientY,k,m,isM,cId);},500);};d.ontouchend=()=>clearTimeout(pT);d.ontouchmove=()=>clearTimeout(pT);if(m.isDeleted){d.style.background=isM?'#f1f8e9':'#f5f5f5';d.innerHTML=`<span style="color:#888;font-style:italic;font-size:14px;">${m.text}</span>`;c.appendChild(d);return;}if(isGrp&&!isM&&m.sName)d.innerHTML+=`<div style="font-size:12px;color:var(--primary-color);font-weight:bold;margin-bottom:2px;">${m.sName}</div>`;if(m.replyTo)d.innerHTML+=`<div class="reply-quote" onclick="let t=document.getElementById('msg-${m.replyTo.id}');if(t){t.scrollIntoView({behavior:'smooth',block:'center'});let ob=t.style.background;t.style.background='#fff59d';setTimeout(()=>t.style.background=ob,1200);}"><div class="reply-quote-name">${m.replyTo.name}</div><div class="reply-quote-text">${m.replyTo.text}</div></div>`;if(m.imageUrl)d.innerHTML+=`<img src="${m.imageUrl}" style="max-width:100%;border-radius:8px;display:block;margin-bottom:5px;">`;if(m.text)d.innerHTML+=`<span style="word-break:break-word;line-height:1.4;">${m.text}</span>`;let rH='';if(m.reactions){const cts={};Object.values(m.reactions).forEach(r=>{cts[r]=(cts[r]||0)+1;});const bgs=Object.entries(cts).map(([r,co])=>`<span class="reaction-badge">${r} ${co>1?co:''}</span>`).join('');rH=`<div style="display:flex;flex-wrap:wrap;margin-top:2px;">${bgs}</div>`;}if(rH)d.innerHTML+=rH;let tS='';const dt=new Date(m.timestamp||Date.now());if(!isNaN(dt))tS=dt.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});let eH='';if(m.isEdited&&m.editTime){const eD=new Date(m.editTime);if(!isNaN(eD))eH=`<span style="font-style:italic;margin-right:5px;">изм. ${eD.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>`;}let tk=isM?(m.status==='read'&&!isGrp?`<span class="material-icons" style="font-size:14px;color:#4caf50;">done_all</span>`:`<span class="material-icons" style="font-size:14px;color:#888;">done</span>`):'';d.innerHTML+=`<div style="position:absolute;bottom:4px;right:10px;display:flex;align-items:center;gap:3px;font-size:11px;color:#8a8a8a;white-space:nowrap;">${eH}<span>${tS}</span>${tk}</div>`;c.appendChild(d);});c.scrollTop=c.scrollHeight;});}
function setupReply(id,d,n){replyMsg={id:id,text:d.text||(d.imageUrl?'📷 Фото':'Сообщение'),name:n};$('reply-preview-name').textContent=replyMsg.name;$('reply-preview-text').textContent=replyMsg.text;$('reply-preview-box').style.display='flex';$('message-input').focus();}
function cancelReply(){replyMsg=null;$('reply-preview-box').style.display='none';}
$('cancel-reply-btn').onclick=cancel
