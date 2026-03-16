import{initializeApp}from"https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";import{getAuth,onAuthStateChanged}from"https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";import{getDatabase,ref,get,update,set}from"https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";
const app=initializeApp({apiKey:"AIzaSyBKp-HUZXSGSfBfEhl-HIjaC3Yflpqxg7s",authDomain:"kotogram-9b0b9.firebaseapp.com",databaseURL:"https://kotogram-9b0b9-default-rtdb.firebaseio.com",projectId:"kotogram-9b0b9",storageBucket:"kotogram-9b0b9.firebasestorage.app",messagingSenderId:"755607509917",appId:"1:755607509917:web:29b1b85eea516bde702d74"});
const auth=getAuth(app),db=getDatabase(app),$=id=>document.getElementById(id);
const IMGBB="706ffb03d5653cdf91990abac2ce7a29";
let cUser=null,nFile=null,uData={};

onAuthStateChanged(auth,async u=>{if(!u)return window.location.href="../login/login.html";cUser=u;
const s=await get(ref(db,'users/'+u.uid));if(s.exists()){uData=s.val();$('name-in').value=uData.displayName||'';$('user-in').value=uData.username||'';$('bio-in').value=uData.bio||'';$('emoji-in').value=uData.emoji||'';$('av-preview').src=uData.photoURL||"https://via.placeholder.com/150";}});

$('back-btn').onclick=()=>window.location.href="../main/main.html";
$('av-wrap').onclick=()=>$('av-input').click();
$('av-input').onchange=e=>{const f=e.target.files[0];if(f){nFile=f;const r=new FileReader();r.onload=ev=>$('av-preview').src=ev.target.result;r.readAsDataURL(f);}};

$('save-btn').onclick=async()=>{
    $('err').innerHTML='';
    const em=$('emoji-in').value.trim();
    if(em && !uData.isPremium){
        $('err').innerHTML='<span style="color:red;">Эмодзи только для Premium!</span> <br><a href="../premium/premium.html">Купить KotoGram Premium</a>';
        return;
    }
    $('save-btn').disabled=!0;$('save-btn').textContent='...';
    try{
        let pUrl=$('av-preview').src;
        if(nFile){const fd=new FormData();fd.append('image',nFile);const r=await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB}`,{method:'POST',body:fd}),d=await r.json();if(d.success)pUrl=d.data.url;}
        let un=$('user-in').value.trim();if(un&&!un.startsWith('@'))un='@'+un;
        await update(ref(db,'users/'+cUser.uid),{displayName:$('name-in').value.trim(),username:un,bio:$('bio-in').value.trim(),photoURL:pUrl.startsWith('data:')?null:pUrl,emoji:em});
        $('err').innerHTML='<span style="color:green;">Сохранено!</span>';setTimeout(()=>window.location.href="../main/main.html",1000);
    }catch(e){$('err').innerHTML='Ошибка: '+e.message;}
    $('save-btn').disabled=!1;$('save-btn').textContent='Сохранить';
};

$('fix-btn').onclick=async()=>{
    if(!confirm("Восстановить поля БД?"))return;
    let un=$('user-in').value.trim();if(un&&!un.startsWith('@'))un='@'+un;
    await set(ref(db,'users/'+cUser.uid),{uid:cUser.uid,phoneNumber:cUser.phoneNumber||"",displayName:$('name-in').value.trim()||"Пользователь",username:un,bio:$('bio-in').value.trim(),photoURL:$('av-preview').src.startsWith('data:')?null:$('av-preview').src,emoji:"",banned:!1,warnings:0,isPremium:!1,catAITickets:10,lastTicketReset:new Date().toDateString(),botModel:1});
    alert("База восстановлена! Premium сброшен, тикеты: 10.");
};
        
