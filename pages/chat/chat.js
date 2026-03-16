import{initializeApp}from"https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";import{getAuth,onAuthStateChanged}from"https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";import{getDatabase,ref,onValue,push,set,serverTimestamp,get,remove,update}from"https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";
const firebaseConfig={apiKey:"AIzaSyBKp-HUZXSGSfBfEhl-HIjaC3Yflpqxg7s",authDomain:"kotogram-9b0b9.firebaseapp.com",databaseURL:"https://kotogram-9b0b9-default-rtdb.firebaseio.com",projectId:"kotogram-9b0b9",storageBucket:"kotogram-9b0b9.firebasestorage.app",messagingSenderId:"755607509917",appId:"1:755607509917:web:29b1b85eea516bde702d74"};
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getDatabase(app),$=id=>document.getElementById(id);

// АПИ КЛЮЧИ
const GROQ_API="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"; // НОВЫЙ КЛЮЧ
const GEMINI_API="AIzaSyAvIDSBaggbPh5D6RbuD0uckfmndI9vypw";

const params=new URLSearchParams(window.location.search), cType=params.get('type'), tId=params.get('id');
let cUser=null,cId=null,uData={},unMsgs=null,unGrp=null,rep=null,isGrp=cType==='group',isBot=cType==='bot',cGrpM={},cGrpP={},myRole='member';

$('back-btn').onclick=()=>{if(window.parent&&window.parent.closeChatFromIframe)window.parent.closeChatFromIframe();};

onAuthStateChanged(auth,async u=>{if(u){cUser=u;const snap=await get(ref(db,'users/'+u.uid));uData=snap.exists()?snap.val():{};initChat();}else if(window.parent)window.parent.location.href="../../login/login.html";});

async function checkMsg(t){if(!t)return!0;try{const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'Authorization':`Bearer ${GROQ_API}`,'Content-Type':'application/json'},body:JSON.stringify({model:"llama-3.3-70b-versatile",messages:[{role:"system",content:"Ты модератор. Банить ТОЛЬКО за мат. Имена Лысук, Лыска, Кошарик, Кот — святые."},{role:"user",content:t}],temperature:0,max_tokens:10})}),d=await r.json();return!d.choices[0].message.content.trim().toUpperCase().includes('BAN')}catch(e){return!0}}

async function initChat(){
  if(isBot){
    cId=`bot_${cUser.uid}`;$('chat-name').textContent="CatAI 🤖";$('chat-avatar').src="https://via.placeholder.com/150/9c27b0/ffffff?text=AI";$('chat-status').textContent="Всегда онлайн";$('call-btn').style.display='none';
  }else if(!isGrp){
    cId=cUser.uid<tId?`${cUser.uid}_${tId}`:`${tId}_${cUser.uid}`;const s=await get(ref(db,'users/'+tId)),u=s.exists()?s.val():{};
    $('chat-name').textContent=(u.displayName||u.phoneNumber||"Неизвестный")+(u.emoji?` ${u.emoji}`:'');$('chat-avatar').src=u.photoURL||"https://via.placeholder.com/150";
    onValue(ref(db,`status/${tId}`),st=>{const v=st.val();$('chat-status').innerHTML=v?.state==='online'?'<span style="color:#3390ec">в сети</span>':v?`был(а) в ${new Date(v.last_seen).toLocaleTimeString()}`:'недавно';});
  }else{
    cId=tId;$('call-btn').style.display='none';
    unGrp=onValue(ref(db,`groups/${tId}`),s=>{if(!s.exists())return;const d=s.val();cGrpM=d.members||{};cGrpP=d.permissions||{};myRole=cGrpM[cUser.uid]||'member';$('chat-name').textContent=d.info?.name||'Группа';$('chat-avatar').src=d.info?.photoURL||"https://via.placeholder.com/150/3390ec/ffffff?text=G";$('chat-status').textContent=`Участников: ${Object.keys(cGrpM).length}`;
    if(myRole==='creator'||(myRole==='admin'&&(cGrpP[cUser.uid]?.manageUsers||cGrpP[cUser.uid]?.editInfo)))$('group-manage-btn').style.display='flex';});
  }
  loadMsgs();
}

function loadMsgs(){if(unMsgs)unMsgs();unMsgs=onValue(ref(db,`chats/${cId}/messages`),s=>{const c=$('messages-container');c.innerHTML='';s.forEach(ch=>{const m=ch.val(),k=ch.key;const isMe=m.senderId===cUser.uid;const d=document.createElement('div');d.style.cssText=`align-self:${isMe?'flex-end':'flex-start'};background:${isMe?'#effdde':'#fff'};padding:8px 12px;border-radius:12px;margin:4px 0;max-width:85%;`;
let h='';if(!isMe&&m.sName)h+=`<div style="font-size:12px;color:#3390ec;font-weight:bold;margin-bottom:2px;">${m.sName}</div>`;if(m.isDeleted)h+=`<i style="color:#888;">${m.text}</i>`;else{if(m.imageUrl)h+=`<img src="${m.imageUrl}" style="max-width:100%;border-radius:8px;margin-bottom:5px;">`;h+=`<span>${m.text||''}</span>`;}d.innerHTML=h;c.appendChild(d);});c.scrollTop=c.scrollHeight;});}

$('send-btn').onclick=async()=>{
    const t=$('message-input').value.trim();if(!t)return;$('message-input').value='';
    
    // БОТ ЛОГИКА
    if(isBot){
        push(ref(db,`chats/${cId}/messages`),{senderId:cUser.uid,sName:cUser.displayName,text:t,timestamp:serverTimestamp(),status:'sent'});
        await processBot(t); return;
    }
    
    const isC=await checkMsg(t);if(!isC){
        let w=uData.warnings||0; w++; await update(ref(db,'users/'+cUser.uid),{warnings:w});
        let limit=uData.isPremium?5:3;
        push(ref(db,`chats/${cId}/messages`),{isSystem:!0,text:`🚨 Отфильтровано (${w}/${limit})`,timestamp:serverTimestamp()});
        if(w>=limit){await update(ref(db,'users/'+cUser.uid),{banned:!0,warnings:0});if(window.parent)window.parent.location.reload();}
        return;
    }
    push(ref(db,`chats/${cId}/messages`),{senderId:cUser.uid,sName:uData.displayName,text:t,timestamp:serverTimestamp(),status:'sent'});
    if(!isGrp){update(ref(db,`userChats/${cUser.uid}/${tId}`),{timestamp:serverTimestamp(),lastMessage:t});update(ref(db,`userChats/${tId}/${cUser.uid}`),{timestamp:serverTimestamp(),lastMessage:t});}else{Object.keys(cGrpM).forEach(u=>update(ref(db,`userChats/${u}/${tId}`),{timestamp:serverTimestamp(),lastMessage:t}));}
};

// --- МОЗГИ CatAI ---
async function processBot(txt){
    let snap=await get(ref(db,'users/'+cUser.uid)); let u=snap.val()||{};
    let today=new Date().toDateString(); let ticks=u.catAITickets||0;
    
    // ЕЖЕДНЕВНОЕ ОБНОВЛЕНИЕ ТИКЕТОВ
    if(u.lastTicketReset!==today){
        ticks=u.isPremium?30:10;
        await update(ref(db,'users/'+cUser.uid),{catAITickets:ticks,lastTicketReset:today});
    }
    
    let modelId=u.botModel||1; // 1-Groq, 2-Gemini
    
    if(txt==='/start') return sendBot("Привет! Я CatAI 🤖.\nКоманды:\n/model 1 - Llama (1 тикет)\n/model 2 - Gemini (3 тикета)\nНапиши 'нарисуй [что-то]', чтобы создать фото (10 тикетов).\nУ вас тикетов: "+ticks);
    if(txt.startsWith('/model ')){
        let m=txt.split(' ')[1]; if(m==='1'||m==='2'){await update(ref(db,'users/'+cUser.uid),{botModel:parseInt(m)}); return sendBot(`✅ Модель: ${m==='1'?'Groq (1 тикет/сообщение)':'Gemini (3 тикета/сообщение)'}`);}
    }
    
    let isImg=txt.toLowerCase().startsWith('нарисуй');
    let cost=isImg?10:(modelId===1?1:3);
    
    if(ticks<cost) return sendBot(`❌ Не хватает тикетов. Нужно: ${cost}, у вас: ${ticks}. Ждите завтра или купите Premium.`);
    
    await update(ref(db,'users/'+cUser.uid),{catAITickets:ticks-cost});
    
    try{
        if(isImg){
            let p=txt.replace(/нарисуй/gi,'').trim();
            let url=`https://image.pollinations.ai/prompt/${encodeURIComponent(p)}?width=512&height=512&nologo=true`;
            push(ref(db,`chats/${cId}/messages`),{senderId:'bot_catai',sName:'CatAI 🤖',text:'',imageUrl:url,timestamp:serverTimestamp(),status:'sent'});
        }else{
            let reply="Ошибка";
            if(modelId===1){
                const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'Authorization':`Bearer ${GROQ_API}`,'Content-Type':'application/json'},body:JSON.stringify({model:"llama-3.3-70b-versatile",messages:[{role:"user",content:txt}]})});
                const d=await r.json(); reply=d.choices[0].message.content;
            }else{
                const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:txt}]}]})});
                const d=await r.json(); reply=d.candidates[0].content.parts[0].text;
            }
            sendBot(reply);
        }
    }catch(e){
        await update(ref(db,'users/'+cUser.uid),{catAITickets:ticks}); // Возврат тикетов при ошибке
        sendBot("Сбой ИИ: "+e.message);
    }
}
function sendBot(txt){push(ref(db,`chats/${cId}/messages`),{senderId:'bot_catai',sName:'CatAI 🤖',text:txt,timestamp:serverTimestamp(),status:'sent'});}
                                                                                               
