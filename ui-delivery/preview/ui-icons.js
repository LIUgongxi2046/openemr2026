(()=>{
  const asset='../assets/master/medical-icon-sprite.svg#';
  const navIcons={
    clinical:'home',outpatient:'record',emergency:'critical',inpatient:'ward',
    'specialty-center':'patient',record:'record','quality-center':'quality',
    'archive-assets':'record','care-operations':'patient','clinical-tasks':'success',
    'data-center':'data','ai-center':'ai',workflow:'settings',admin:'settings'
  };
  const svg=(name,label='')=>`<svg class="ui-icon" aria-hidden="true"><use href="${asset}${name}"></use></svg>${label?`<span class="sr-only">${label}</span>`:''}`;
  function decorate(){
    document.querySelectorAll('.nav-item').forEach(button=>{
      const slot=button.querySelector('.nav-icon');
      const name=navIcons[button.dataset.page];
      if(slot&&name&&!slot.querySelector('svg'))slot.innerHTML=svg(name);
    });
    document.querySelectorAll('.ai-top-trigger').forEach(button=>{
      if(!button.querySelector('svg'))button.innerHTML=svg('ai','打开 AI 助手');
    });
    document.querySelectorAll('.top-actions>.icon-btn:not(.ai-top-trigger)').forEach(button=>{
      if(button.querySelector('svg'))return;
      const name=button.textContent.trim()==='?'?'help':'context';
      const label=name==='help'?'帮助':'工作上下文';
      button.innerHTML=svg(name,label);
      button.setAttribute('aria-label',label);
    });
    document.querySelectorAll('.ai-fab span').forEach(slot=>{
      if(!slot.querySelector('svg'))slot.innerHTML=svg('ai');
    });
    document.querySelectorAll('button').forEach(button=>{
      if(!button.textContent.includes('🎙'))return;
      const text=button.textContent.replace('🎙','').trim();
      button.innerHTML=svg('microphone',text||'环境记录')+(text?` ${text}`:'');
      button.setAttribute('aria-label',text||'环境记录');
    });
    document.querySelectorAll('.notice-title').forEach(title=>{
      const text=title.firstChild?.nodeType===Node.TEXT_NODE?title.firstChild.nodeValue:'';
      if(!text||!text.trim().startsWith('✦')||title.querySelector('svg'))return;
      title.firstChild.nodeValue=text.replace('✦','').trimStart();
      title.insertAdjacentHTML('afterbegin',svg('ai')+' ');
    });
    const screen=document.querySelector('.main')?.dataset.screenId||'';
    if(screen.endsWith('-evidence')){
      const body=document.querySelector('.specialty-evidence-layout aside .card-body');
      if(body&&!body.querySelector('.ui-device-degradation-asset')){
        body.insertAdjacentHTML('afterbegin','<figure class="ui-device-degradation-asset"><img src="../assets/master/specialty-device-safe-degradation.png" alt="医疗设备与外部系统安全降级示意"><figcaption>设备异常时隔离单一来源，其余临床链路继续可用。</figcaption></figure>');
      }
    }
  }
  let queued=false;
  const queue=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;decorate()})};
  new MutationObserver(queue).observe(document.getElementById('app'),{childList:true,subtree:true});
  window.decorateUiDelivery=decorate;
  window.addEventListener('hashchange',()=>setTimeout(decorate,0));
  decorate();
})();
