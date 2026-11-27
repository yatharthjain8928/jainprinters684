const waNumber='919214495684';
const toggle=document.getElementById('menuToggle');const nav=document.getElementById('navLinks');
if(toggle&&nav){toggle.addEventListener('click',()=>{const open=nav.classList.toggle('open');toggle.setAttribute('aria-expanded',String(open));toggle.textContent=open?'×':'☰';});nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');toggle.setAttribute('aria-expanded','false');toggle.textContent='☰';}));}
document.querySelectorAll('.year').forEach(n=>n.textContent=new Date().getFullYear());
// Progressive reveal and staggered entrances for a more considered, editorial feel.
const motionGroups=[
  '.section-head',
  '.strip-item',
  '.card',
  '.gallery-item',
  '.contact-card,.quote-card',
  '.cta-panel',
  '.feature-img',
  '.founder-grid > *,.two-col > *,.dark-grid > *',
  '.hero-chip,.hero-year',
  '.contact-row'
];
motionGroups.forEach(selector=>{
  document.querySelectorAll(selector).forEach((el,index)=>{
    el.classList.add('reveal');
    el.style.setProperty('--reveal-delay',Math.min(index,7)*65+'ms');
  });
});
const prefersReducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const observer=(!prefersReducedMotion&&'IntersectionObserver'in window)
  ?new IntersectionObserver(entries=>entries.forEach(e=>{
    if(e.isIntersecting){e.target.classList.add('visible');observer.unobserve(e.target);}
  }),{threshold:.08,rootMargin:'0px 0px -7% 0px'})
  :null;
document.querySelectorAll('.reveal').forEach(el=>{
  if(observer)observer.observe(el);
  else el.classList.add('visible');
});

// A fine brand-coloured progress rule makes long pages feel more polished.
const progress=document.createElement('div');
progress.className='site-progress';
progress.setAttribute('aria-hidden','true');
document.body.appendChild(progress);
let progressTicking=false;
function updateProgress(){
  const root=document.documentElement;
  const total=root.scrollHeight-window.innerHeight;
  const amount=total>0?Math.min(1,Math.max(0,window.scrollY/total)):0;
  progress.style.transform='scaleX('+amount+')';
  progressTicking=false;
}
window.addEventListener('scroll',()=>{
  if(!progressTicking){progressTicking=true;requestAnimationFrame(updateProgress);}
},{passive:true});
updateProgress();
const params=new URLSearchParams(location.search);const chosen=params.get('service');const selector=document.getElementById('serviceType');if(chosen&&selector){const match=[...selector.options].find(o=>o.text.toLowerCase()===chosen.toLowerCase()||o.text.toLowerCase().includes(chosen.toLowerCase()));if(match)selector.value=match.value;}
const toast=document.getElementById('toast');let toastTimer;function showToast(text){if(!toast)return;toast.textContent=text;toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),3500);}
const form=document.getElementById('quoteForm');if(form){form.addEventListener('submit',e=>{e.preventDefault();const name=form.elements.name.value.trim(),phone=form.elements.phone.value.trim(),service=form.elements.service.value,brief=form.elements.brief.value.trim();if(!name||!phone||!service){showToast('Please complete the required fields.');return;}if(phone.replace(/\D/g,'').length<7){showToast('Please enter a valid phone number.');return;}const message=['Hello Jain Printers, I would like to request a quote.','',`Name: ${name}`,`My phone: ${phone}`,`Service: ${service}`,`Requirement: ${brief||'Please contact me to discuss.'}`].join('\n');const target='https://wa.me/'+waNumber+'?text='+encodeURIComponent(message);const tab=window.open(target,'_blank');if(tab){tab.opener=null;showToast('WhatsApp opened. Review your enquiry and tap Send.');}else{location.href=target;}});}
const lightbox=document.getElementById('lightbox'),lbImage=document.getElementById('lightboxImage');function closeLb(){if(!lightbox)return;lightbox.classList.remove('open');document.body.style.overflow='';lbImage.src='';}document.querySelectorAll('.gallery-item').forEach(btn=>btn.addEventListener('click',()=>{lbImage.src=btn.dataset.image;lbImage.alt=btn.dataset.caption||'Jain Printers project';lightbox.classList.add('open');document.body.style.overflow='hidden';}));const lbClose=document.getElementById('lightboxClose');if(lbClose)lbClose.addEventListener('click',closeLb);if(lightbox)lightbox.addEventListener('click',e=>{if(e.target===lightbox)closeLb();});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeLb();});
