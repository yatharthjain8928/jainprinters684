(()=>{
const WA='https://wa.me/919214495684';
const STORE='jpAgentChat';
const GREETING="Namaste! 🙏 I'm the **Jain Printers Assistant**. I can help with wedding invitations, packaging & gift boxes, business printing and more — and help you prepare a quote request. What would you like to print?";
const CHIPS=['Wedding invitation ideas','Sweet & dry fruit boxes','Visiting cards & letterheads','Flex & banners','Shop timings & address'];
let history=[];try{history=JSON.parse(sessionStorage.getItem(STORE)||'[]');if(!Array.isArray(history))history=[];}catch{history=[];}
let busy=false;

const launch=document.createElement('button');launch.className='jp-agent-launch';launch.type='button';launch.setAttribute('aria-label','Chat with the Jain Printers AI assistant');
launch.innerHTML='<span class="jp-orb" aria-hidden="true"></span><span class="jp-l"><small>AI Assistant</small>Ask Jain Printers</span>';
const panel=document.createElement('section');panel.className='jp-agent';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Jain Printers AI assistant');panel.setAttribute('aria-hidden','true');
panel.innerHTML='<div class="jp-agent-head"><img src="assets/logo.webp" alt=""><span><b>Jain Printers Assistant</b><small>AI helper · usually replies instantly</small></span><button class="jp-agent-close" type="button" aria-label="Close assistant">×</button></div><div class="jp-agent-log" aria-live="polite"></div><div class="jp-chips"></div><form class="jp-agent-form"><textarea rows="1" maxlength="1500" placeholder="Ask about cards, boxes, banners…" aria-label="Your message"></textarea><button type="submit" aria-label="Send">➤</button></form><div class="jp-agent-foot"><span>AI answers may be imperfect — confirm details with our team.</span><a href="'+WA+'" target="_blank" rel="noopener">WhatsApp ↗</a></div>';
document.body.append(launch,panel);
const log=panel.querySelector('.jp-agent-log'),chips=panel.querySelector('.jp-chips'),form=panel.querySelector('form'),input=form.querySelector('textarea'),send=form.querySelector('button');

function esc(s){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function inline(s){
  return esc(s)
    .replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:|tel:)[^\s)]+|[a-z0-9-]+\.html(?:#[\w-]+)?)\)/gi,(m,t,u)=>{const ext=/^https?:/i.test(u);return `<a href="${u}"${ext?' target="_blank" rel="noopener"':''}>${t}</a>`;})
    .replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')
    .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g,'$1<a href="$2" target="_blank" rel="noopener">$2</a>');
}
function md(text){
  const out=[];let list=null;
  for(const raw of text.split('\n')){const line=raw.trim();const li=line.match(/^(?:[-*•]|\d+[.)])\s+(.*)/);
    if(li){if(!list){list=[];}list.push('<li>'+inline(li[1])+'</li>');continue;}
    if(list){out.push('<ul>'+list.join('')+'</ul>');list=null;}
    if(line)out.push('<p>'+inline(line.replace(/^#+\s*/,''))+'</p>');}
  if(list)out.push('<ul>'+list.join('')+'</ul>');
  return out.join('');
}
function bubble(role,text){const d=document.createElement('div');d.className='jp-msg '+(role==='user'?'user':'bot');if(role==='user')d.textContent=text;else d.innerHTML=md(text);log.appendChild(d);log.scrollTop=log.scrollHeight;return d;}
function render(){log.innerHTML='';bubble('assistant',GREETING);history.forEach(m=>bubble(m.role,m.content));chips.style.display=history.length?'none':'flex';}
function save(){try{sessionStorage.setItem(STORE,JSON.stringify(history.slice(-30)));}catch{}}
CHIPS.forEach(c=>{const b=document.createElement('button');b.type='button';b.textContent=c;b.addEventListener('click',()=>ask(c));chips.appendChild(b);});

async function ask(text){
  text=text.trim();if(!text||busy)return;busy=true;send.disabled=true;chips.style.display='none';
  history.push({role:'user',content:text});save();bubble('user',text);input.value='';grow();
  const bot=bubble('assistant','');bot.innerHTML='<span class="jp-typing"><i></i><i></i><i></i></span>';
  let reply='';
  try{
    const res=await fetch('/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({messages:history})});
    if(!res.ok||!res.body){
      const detail=await res.text().catch(()=> '');
      if(res.status===503 && detail.includes('ANTHROPIC_API_KEY'))throw new Error('missing_api_key');
      throw new Error('bad response');
    }
    const reader=res.body.getReader(),dec=new TextDecoder();
    while(true){const {done,value}=await reader.read();if(done)break;reply+=dec.decode(value,{stream:true});bot.innerHTML=md(reply);log.scrollTop=log.scrollHeight;}
    if(!reply.trim())throw new Error('empty');
  }catch(e){
    if(e.message==='missing_api_key'){
      reply=`The Jain Printers AI Assistant is temporarily being configured. Please contact our team directly on [WhatsApp](${WA}) or call +91 92144 95684.`;
    }else{
      reply=`Sorry, I couldn't connect just now. You can reach Jain Printers directly on [WhatsApp](${WA}) or call +91 92144 95684.`;
    }
    bot.innerHTML=md(reply);
  }
  history.push({role:'assistant',content:reply});save();
  busy=false;send.disabled=false;input.focus();
}
function grow(){input.style.height='auto';input.style.height=Math.min(input.scrollHeight,110)+'px';}
function openP(){panel.classList.add('open');panel.setAttribute('aria-hidden','false');launch.classList.add('hidden');if(!log.childElementCount)render();setTimeout(()=>input.focus(),150);}
function closeP(){panel.classList.remove('open');panel.setAttribute('aria-hidden','true');launch.classList.remove('hidden');launch.focus();}
launch.addEventListener('click',openP);
panel.querySelector('.jp-agent-close').addEventListener('click',closeP);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&panel.classList.contains('open'))closeP();});
form.addEventListener('submit',e=>{e.preventDefault();ask(input.value);});
input.addEventListener('input',grow);
input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();ask(input.value);}});
document.querySelectorAll('[data-open-agent]').forEach(el=>el.addEventListener('click',e=>{e.preventDefault();openP();}));
})();
