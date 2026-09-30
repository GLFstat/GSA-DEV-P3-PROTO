const toast = document.getElementById('toast');
let toastTimer;
function showToast(message){
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>toast.classList.remove('show'),1200);
}

document.querySelectorAll('[data-action]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const labels={
      'start-round':'Start Round',
      'last-round':'Last Round',
      'summary':'Last Round Summary',
      'clubhouse':'Clubhouse',
      'my-game':'My Game',
      'history':'History'
    };
    showToast(`${labels[btn.dataset.action]} — prototype destination`);
  });
});

document.querySelectorAll('[data-nav]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('[data-nav]').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    showToast(`${btn.textContent.trim()} — prototype navigation`);
  });
});

// Prototype helper: in the browser console run either:
// setClubhouseState('clear')
// setClubhouseState('attention')
window.setClubhouseState = function(state='clear'){
  const status=document.getElementById('clubhouseStatus');
  const context=document.getElementById('clubhouseContext');
  const needs=state==='attention';
  status.classList.toggle('is-clear',!needs);
  status.classList.toggle('needs-attention',needs);
  status.textContent=needs?'2 details need attention.':'You’re all caught up.';
  context.textContent=needs?'Meadows GC · Sep 8':'Review rounds or add follow-up details.';
};
