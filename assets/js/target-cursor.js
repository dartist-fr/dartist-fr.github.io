/* React Bits TargetCursor — adaptation for a plain HTML/CSS/JS site. */
(function () {
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  if (!finePointer.matches) return;
  var rootStyle = getComputedStyle(document.documentElement);
  var settings = {
    targetSelector: '.cursor-target',
    cursorColor: rootStyle.getPropertyValue('--amber').trim() || '#ffffff',
    cursorColorOnTarget: rootStyle.getPropertyValue('--accent').trim() || '#ffffff',
    spinDuration: 2, hoverDuration: 0.2, parallaxOn: true, hideDefaultCursor: true,
    size: 36, cornerSize: 12, thickness: 3, padding: 6, matchRadius: true,
    dotSize: 4, blendMode: 'normal', showLabel: true, clickEffect: true
  };
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.createElement('div');
  root.className = 'target-cursor'; root.setAttribute('aria-hidden', 'true'); root.style.mixBlendMode = settings.blendMode;
  root.innerHTML = '<span class="target-cursor__corner"></span><span class="target-cursor__corner"></span><span class="target-cursor__corner"></span><span class="target-cursor__corner"></span><span class="target-cursor__dot"></span><span class="target-cursor__label"></span>';
  document.body.appendChild(root);
  var corners = Array.prototype.slice.call(root.querySelectorAll('.target-cursor__corner'));
  var dot = root.querySelector('.target-cursor__dot'), label = root.querySelector('.target-cursor__label');
  var angles = [0,90,180,270], quarter = Math.PI/2;
  var pointer = {x:0,y:0,inside:false,pressed:false}, target = null, turn = 0, raf = 0, last = 0, lastLabel = '', currentColor = '';
  var center = {x:0,y:0}, half = {w:settings.size/2,h:settings.size/2}, presence = 0, lock = 0, press = 0, cornerRadius = 0;
  function markTargets(scope) {
    var selector = 'a, button, [role="button"], input, textarea, select, .carousel-stage';
    if (scope.nodeType === 1 && scope.matches && scope.matches(selector)) markOne(scope);
    if (scope.querySelectorAll) scope.querySelectorAll(selector).forEach(markOne);
  }
  function markOne(el) {
    el.classList.add('cursor-target');
    if (!el.hasAttribute('data-cursor-label')) {
      var name = (el.getAttribute('aria-label') || el.getAttribute('data-title') || el.textContent || el.tagName).trim().replace(/\s+/g,' ');
      el.setAttribute('data-cursor-label', name.slice(0,32));
    }
  }
  markTargets(document);
  new MutationObserver(function (records) {
    records.forEach(function (record) {
      record.addedNodes.forEach(function (node) { if (node.nodeType === 1) markTargets(node); });
    });
  }).observe(document.documentElement, { childList: true, subtree: true });
  function tick(now) {
    raf=0;
    var dt=last?Math.min(.05,(now-last)/1000):1/60; last=now;
    presence += ((pointer.inside?1:0)-presence)*Math.min(1,dt*14);
    var locked=!!(target&&target.isConnected&&pointer.inside);
    lock += ((locked?1:0)-lock)*Math.min(1,dt*(1/settings.hoverDuration));
    press += (((pointer.pressed&&settings.clickEffect)?1:0)-press)*Math.min(1,dt*22);
    var gx=pointer.x, gy=pointer.y, gw=settings.size/2, gh=settings.size/2, radius=2;
    if(locked) {
      var rect=target.getBoundingClientRect(), cx=rect.left+rect.width/2, cy=rect.top+rect.height/2;
      var lean=settings.parallaxOn?.08:0;
      gx=cx+(pointer.x-cx)*lean; gy=cy+(pointer.y-cy)*lean;
      var odd=Math.abs(Math.round(turn/quarter))%2===1;
      gw=(odd?rect.height:rect.width)/2+settings.padding; gh=(odd?rect.width:rect.height)/2+settings.padding;
      radius=settings.matchRadius?Math.min((parseFloat(getComputedStyle(target).borderTopLeftRadius)||0)+Math.max(0,settings.padding),settings.cornerSize):0;
      cornerRadius=radius; turn=Math.round(turn/quarter)*quarter;
    } else if(settings.spinDuration>0&&!reduced) turn+=(Math.PI*2/settings.spinDuration)*dt;
    center.x+=(gx-center.x)*Math.min(1,dt*(locked?22:38)); center.y+=(gy-center.y)*Math.min(1,dt*(locked?22:38));
    half.w+=(gw-half.w)*Math.min(1,dt*18); half.h+=(gh-half.h)*Math.min(1,dt*18);
    var w=half.w*(1-press*.14), h=half.h*(1-press*.14), cos=Math.cos(turn), sin=Math.sin(turn), left=Infinity, top=Infinity;
    var pts=[[-w,-h],[w,-h],[w,h],[-w,h]];
    corners.forEach(function(corner,i){
      var x=center.x+pts[i][0]*cos-pts[i][1]*sin, y=center.y+pts[i][0]*sin+pts[i][1]*cos;
      left=Math.min(left,x); top=Math.min(top,y);
      corner.style.transform='translate3d('+x.toFixed(2)+'px,'+y.toFixed(2)+'px,0) rotate('+(angles[i]+turn*180/Math.PI).toFixed(2)+'deg)';
      corner.style.width=settings.cornerSize+'px'; corner.style.height=settings.cornerSize+'px';
      corner.style.borderWidth=settings.thickness+'px 0 0 '+settings.thickness+'px';
      corner.style.borderTopLeftRadius=Math.min(cornerRadius,settings.cornerSize)+'px';
    });
    dot.style.width=settings.dotSize+'px'; dot.style.height=settings.dotSize+'px';
    dot.style.transform='translate3d('+pointer.x+'px,'+pointer.y+'px,0) translate(-50%,-50%) scale('+(1-press*.35)+')';
    var text= settings.showLabel&&locked ? target.getAttribute('data-cursor-label')||'' : '';
    if(text&&text!==lastLabel) label.textContent=lastLabel=text;
    label.style.transform='translate3d('+left.toFixed(2)+'px,'+(top-8).toFixed(2)+'px,0) translateY(-100%)';
    label.style.opacity=text?String(Math.max(0,Math.min(1,lock))):'0';
    var color=locked?settings.cursorColorOnTarget:settings.cursorColor;
    if(color!==currentColor){root.style.setProperty('--target-cursor-color',color);currentColor=color;}
    root.style.opacity=String(Math.max(0,Math.min(1,presence)));
    if(pointer.inside||presence>.01||Math.abs(center.x-gx)+Math.abs(center.y-gy)>.5||Math.abs(lock-(locked?1:0))>.01||Math.abs(press-(pointer.pressed?1:0))>.01) raf=requestAnimationFrame(tick); else last=0;
  }
  function wake(){if(!raf)raf=requestAnimationFrame(tick);}
  function move(e){if(e.pointerType&&e.pointerType!=='mouse')return;pointer.x=e.clientX;pointer.y=e.clientY;pointer.inside=true;var el=e.target;target=el&&el.closest?el.closest(settings.targetSelector):null;wake();}
  function leave(){pointer.inside=false;pointer.pressed=false;target=null;wake();}
  window.addEventListener('pointermove',move,{passive:true});
  window.addEventListener('pointerdown',function(e){if(!e.pointerType||e.pointerType==='mouse'){pointer.pressed=true;wake();}},{passive:true});
  window.addEventListener('pointerup',function(){pointer.pressed=false;wake();},{passive:true});
  document.documentElement.addEventListener('pointerleave',leave); window.addEventListener('blur',leave);
  document.documentElement.classList.add('has-target-cursor');
})();
