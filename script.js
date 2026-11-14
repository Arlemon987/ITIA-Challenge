const $=id=>document.getElementById(id);
let bank=[],round=[],idx=0,answers=[],chosen=null,currentUser="",avatarUrl="",avatarReady=false,avatarImage=null;
const API_URL="https://script.google.com/macros/s/AKfycbwnNRacfQ218DTw2A_Dik5RM1W4J8O8DMXRx1AAkvdj20fLGxxMoneerQBFhFXGhQvlQQ/exec";
const shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
function cleanHandle(v){return v.trim().replace(/^@+/,"").toLowerCase()}
function validHandle(v){return /^[a-z0-9_]{1,15}$/.test(v)}
function setProfile(){
 const source=`https://unavatar.io/x/${encodeURIComponent(currentUser)}`;
 // The image proxy adds CORS headers so the avatar can be drawn into the downloadable PNG.
 const url=`https://images.weserv.nl/?url=${encodeURIComponent(source)}&output=png`;
 avatarUrl=url;avatarReady=false;avatarImage=null;
 ["sessionPfp","cardPfp"].forEach(id=>{
  const img=$(id);if(!img)return;
  img.crossOrigin="anonymous";img.src=url;
  img.onerror=()=>{img.classList.add("avatar-fallback");img.removeAttribute("src")};
  img.onload=()=>img.classList.remove("avatar-fallback");
 });
 $("sessionUsername").textContent="@"+currentUser;$("cardUsername").textContent="@"+currentUser;$("sessionProfile").classList.remove("hidden");
 const im=new Image();im.crossOrigin="anonymous";
 im.onload=()=>{avatarImage=im;avatarReady=true};
 im.onerror=()=>{avatarImage=null;avatarReady=false};
 im.src=url;
}
function waitForAvatar(){
 if(avatarReady)return Promise.resolve(true);
 if(!avatarUrl)return Promise.resolve(false);
 return new Promise(resolve=>{
  const started=Date.now();
  const check=()=>{if(avatarReady)return resolve(true);if(Date.now()-started>7000)return resolve(false);setTimeout(check,150)};
  check();
 });
}
function apiCall(action,data={}){
 return new Promise((resolve,reject)=>{
  if(API_URL.includes("PASTE_YOUR")){reject(new Error("Google Sheets database is not connected yet. Add the deployed Apps Script URL in script.js."));return}
  const cb="itiaCb"+Date.now()+Math.floor(Math.random()*10000),s=document.createElement("script");
  const cleanup=()=>{delete window[cb];s.remove()};
  const timer=setTimeout(()=>{cleanup();reject(new Error("Database request timed out. Please try again."))},15000);
  window[cb]=result=>{clearTimeout(timer);cleanup();result&&result.ok?resolve(result):reject(new Error(result?.error||"Database request failed."))};
  const params=new URLSearchParams({action,callback:cb,handle:currentUser,...Object.fromEntries(Object.entries(data).map(([k,v])=>[k,JSON.stringify(v)]))});
  s.onerror=()=>{clearTimeout(timer);cleanup();reject(new Error("Could not reach the Google Sheets database."))};
  s.src=API_URL+"?"+params.toString();document.body.appendChild(s);
 });
}
function setStatus(msg,isError=false){$("username-help").textContent=msg;$("username-help").classList.toggle("error",isError)}
fetch("questions.json",{cache:"no-store"}).then(r=>{if(!r.ok)throw Error();return r.json()}).then(data=>{bank=data;$("start").disabled=false}).catch(()=>$("start").textContent="Question bank unavailable");
async function begin(){
 const handle=cleanHandle($("xUsername").value);
 if(!validHandle(handle)){setStatus("Enter a valid X username (1–15 letters, numbers or underscores).",true);return}
 currentUser=handle;$("start").disabled=true;setStatus("Checking your quiz record...");
 try{
  const record=await apiCall("enter");
  setProfile();
  if(record.status==="completed"){restoreRecord(record);showSavedResult(record.result||record);return}
  if(record.status==="in_progress"&&record.progress){restoreRecord(record);setStatus("Your saved quiz has been restored.");$("intro").classList.add("hidden");$("result").classList.add("hidden");if(idx>=10){await result();return}$("quiz").classList.remove("hidden");render();return}
  round=shuffle(bank).slice(0,10);idx=0;answers=[];await apiCall("start",{round});$("intro").classList.add("hidden");$("result").classList.add("hidden");$("quiz").classList.remove("hidden");render();
 }catch(e){setStatus(e.message,true);$("start").disabled=false}
}
function restoreRecord(record){
 round=record.progress?.round||record.round||[];answers=record.progress?.answers||[];idx=answers.length;
 if(!round.length)throw new Error("Saved quiz data is missing. Contact the quiz administrator.");
}
function showSavedResult(resultData){if(!resultData)return;answers=resultData.answers||[];round=resultData.round||[];renderResultData(resultData.score,resultData.rank,resultData.tagline);$("intro").classList.add("hidden");$("quiz").classList.add("hidden");$("result").classList.remove("hidden");$("actions").classList.add("hidden");$("reviewtitle").textContent="YOUR PREVIOUS ANSWERS";$("retryMessage").classList.remove("hidden")}
function render(){
 let q=round[idx];chosen=null;$("category").textContent=q.category.toUpperCase();$("progress").textContent=String(idx+1).padStart(2,"0")+" / 10";$("bar").style.width=(idx+1)*10+"%";$("question").textContent=q.q;$("hint").textContent="Choose one answer";$("next").disabled=true;$("next").textContent=idx===9?"See my result ↗":"Next question →";$("options").innerHTML="";
 let shown=shuffle(q.options.map((text,i)=>({text,correct:i===q.answer})));
 shown.forEach((o,i)=>{let b=document.createElement("button");b.className="option";let l=document.createElement("span");l.className="letter";l.textContent="ABCD"[i];let t=document.createElement("span");t.textContent=o.text;b.append(l,t);
  b.onclick=()=>{if(chosen)return;chosen=o;document.querySelectorAll(".option").forEach(x=>{x.disabled=true;x.classList.add("locked");x.classList.remove("selected")});b.classList.add("selected");$("next").disabled=false;$("hint").textContent="Answer locked in"};
  $("options").append(b);
 });
}
async function next(){
 if(!chosen)return;
 answers.push({q:round[idx],choice:chosen});$("next").disabled=true;
 try{await apiCall("save",{progress:{round,answers}})}catch(e){answers.pop();$("next").disabled=false;alert("Your answer could not be saved. Please try again.\n"+e.message);return}
 if(++idx<10)render();else await result();
}
function level(n){if(n<=2)return["ITIA NEWCOMER","Every journey starts somewhere."];if(n<=4)return["ITIA EXPLORER","You're getting to know the story behind the art."];if(n<=6)return["ITIA ENTHUSIAST","You know your way around the ITIA universe."];if(n<=8)return["ITIA FAMILY MEMBER","You understand the art, the people, and what brings them together."];if(n===9)return["ITIA INSIDER","You know ITIA beyond the surface."];return["ITIA LEGEND","You know the story, the details, and the feeling. ITIA is home."]}
function renderResultData(n,rank,tag){
 $("score").textContent=n;$("rank").textContent=rank;$("tagline").textContent=tag;$("copy").textContent=`You got ${n} out of 10. ${n===10?"Perfect score. You really know ITIA.":"There's always more to discover about ITIA."}`;
 $("correct").textContent=n;$("wrong").textContent=10-n;$("accuracy").textContent=n*10+"%";$("cardScore").textContent=n;$("cardRank").textContent=rank;
 $("review").innerHTML="";answers.forEach((a,i)=>{let d=document.createElement("div");d.className="reviewitem";let b=document.createElement("b");b.textContent=(i+1)+". "+a.q.q;let s=document.createElement("span");s.className=a.choice.correct?"right":"wrong";s.textContent=a.choice.correct?"✓ Correct":"✕ Incorrect";let small=document.createElement("small");small.textContent="Your answer: "+a.choice.text+(a.choice.correct?"":" · Correct answer: "+a.q.options[a.q.answer])+" — "+a.q.explanation;d.append(b,s,small);$("review").append(d)});
}
async function result(){
 let n=answers.filter(a=>a.choice.correct).length,[rank,tag]=level(n);
 try{await apiCall("complete",{result:{round,answers,score:n,rank,tagline:tag}})}catch(e){alert("Final result could not be saved. Keep this page open and try again.\n"+e.message);return}
 $("quiz").classList.add("hidden");$("result").classList.remove("hidden");$("retryMessage").classList.remove("hidden");renderResultData(n,rank,tag);
}
function share(){let n=answers.filter(a=>a.choice.correct).length,[r]=level(n);let text=`@${currentUser} scored ${n}/10 on the “How Much Do You Know About ITIA?” challenge. ${r}! 🎨❤️\n\nBe genuine. There is no retry, just share what you have got.\n\nThink you know ITIA? Take the quiz:`;window.open("https://twitter.com/intent/tweet?text="+encodeURIComponent(text)+"&url="+encodeURIComponent(location.href),"_blank","noopener,noreferrer")}
function roundedImage(ctx,img,x,y,w,h){ctx.save();ctx.beginPath();ctx.arc(x+w/2,y+h/2,w/2,0,Math.PI*2);ctx.clip();ctx.drawImage(img,x,y,w,h);ctx.restore()}
function cardCanvas(){
 let n=answers.filter(a=>a.choice.correct).length,[r]=level(n),c=document.createElement("canvas");c.width=1200;c.height=630;let x=c.getContext("2d"),g=x.createLinearGradient(0,0,1200,630);g.addColorStop(0,"#29202e");g.addColorStop(1,"#111118");x.fillStyle=g;x.fillRect(0,0,1200,630);x.fillStyle="#ff82bd";x.globalAlpha=.15;x.beginPath();x.arc(1100,70,300,0,7);x.fill();x.globalAlpha=1;x.strokeStyle="#70475f";x.lineWidth=3;x.strokeRect(34,34,1132,562);x.fillStyle="#fff";x.font="bold 30px Arial";x.fillText("ITIA",78,100);x.fillStyle="#d2b1c5";x.font="bold 18px Arial";x.fillText("KNOWLEDGE CHALLENGE",900,100);
 if(avatarReady&&avatarImage)roundedImage(x,avatarImage,83,128,84,84);else{x.fillStyle="#ff82bd";x.beginPath();x.arc(125,170,42,0,Math.PI*2);x.fill();x.fillStyle="#24131d";x.font="bold 34px Arial";x.textAlign="center";x.fillText(currentUser.slice(0,1).toUpperCase(),125,182);x.textAlign="left"}
 x.fillStyle="#fff";x.font="bold 30px Arial";x.fillText("@"+currentUser,190,181);x.font="bold 54px Arial";x.fillText("HOW MUCH DO YOU KNOW ABOUT ITIA?",78,270);x.fillStyle="#ff82bd";x.font="bold 150px Arial";x.fillText(n,78,450);x.fillStyle="#ddd";x.font="bold 55px Arial";x.fillText("/10",220,450);x.fillStyle="#ff82bd";x.fillRect(78,480,390,55);x.fillStyle="#24131d";x.font="bold 24px Arial";x.fillText(r,95,517);x.fillStyle="#d1b6c6";x.font="bold 19px Arial";x.fillText("WHERE ART FEELS LIKE HOME",78,570);x.fillStyle="#fff";x.textAlign="right";x.fillText("DEVELOPED BY @lemonar777",1120,570);x.textAlign="left";return c;
}
$("start").disabled=true;$("start").onclick=begin;$("xUsername").addEventListener("keydown",e=>{if(e.key==="Enter"&&!$("start").disabled)begin()});$("next").onclick=next;$("share").onclick=share;$("download").onclick=async()=>{const btn=$("download");btn.disabled=true;const old=btn.textContent;btn.textContent="Preparing card…";await waitForAvatar();let a=document.createElement("a");a.download="itia-knowledge-score.png";a.href=cardCanvas().toDataURL("image/png");a.click();btn.disabled=false;btn.textContent=old};
