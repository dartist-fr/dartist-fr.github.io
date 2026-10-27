/* Lightweight homepage motion: tech-text decoding inspired by ReactBits. */
(function () {
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var items = document.querySelectorAll('.reveal, .project');

  if (reducedMotion || !('IntersectionObserver' in window)) {
    items.forEach(function (item) { item.classList.add('is-visible'); });
  } else {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -24px 0px' });
    items.forEach(function (item) {
      item.classList.add('reveal');
      observer.observe(item);
    });
  }

  /* Tech-text: scramble glyphs resolve into the real title from left to right. */
  var title = document.querySelector('.hero-gradient');
  if (title) {
    var finalText = title.textContent;
    title.setAttribute('aria-label', finalText);
    title.setAttribute('role', 'text');
    title.textContent = '';
    var chars = [];
    Array.from(finalText).forEach(function (character, index) {
      var span = document.createElement('span');
      span.className = 'tech-char';
      span.setAttribute('aria-hidden', 'true');
      span.textContent = character === ' ' ? '\u00a0' : character;
      title.appendChild(span);
      chars.push({ node: span, final: character, index: index });
    });

    if (reducedMotion) {
      chars.forEach(function (char) { char.node.textContent = char.final === ' ' ? '\u00a0' : char.final; });
    } else {
      var glyphs = '01ABCDEFGHIJKLMNOPQRSTUVWXYZ#$%&*+-<>/\\';
      var started = performance.now();
      var duration = 1350;
      function decode(now) {
        var progress = Math.min(1, (now - started) / duration);
        chars.forEach(function (char) {
          var threshold = char.index / Math.max(chars.length, 1);
          if (progress >= threshold + .16) {
            char.node.textContent = char.final === ' ' ? '\u00a0' : char.final;
            char.node.classList.remove('is-decoding');
          } else {
            char.node.textContent = char.final === ' ' ? '\u00a0' : glyphs[Math.floor(Math.random() * glyphs.length)];
            char.node.classList.add('is-decoding');
          }
        });
        if (progress < 1) window.requestAnimationFrame(decode);
        else chars.forEach(function (char) {
          char.node.textContent = char.final === ' ' ? '\u00a0' : char.final;
          char.node.classList.remove('is-decoding');
        });
      }
      window.requestAnimationFrame(decode);
    }
  }

  /* Cursor-following card glow only on precise pointers, never on touch screens. */
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches && !reducedMotion) {
    document.querySelectorAll('.project').forEach(function (card) {
      card.addEventListener('pointermove', function (event) {
        var rect = card.getBoundingClientRect();
        card.style.setProperty('--pointer-x', (event.clientX - rect.left) + 'px');
        card.style.setProperty('--pointer-y', (event.clientY - rect.top) + 'px');
      });
    });
  }

  /* Target Cursor: reticle snaps around interactive elements on desktop. */
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (finePointer && !reducedMotion) {
    var cursor = document.createElement('div');
    cursor.className = 'target-cursor';
    cursor.setAttribute('aria-hidden', 'true');
    cursor.innerHTML = '<span class="target-cursor__corner target-cursor__corner--tl"></span><span class="target-cursor__corner target-cursor__corner--tr"></span><span class="target-cursor__corner target-cursor__corner--bl"></span><span class="target-cursor__corner target-cursor__corner--br"></span><span class="target-cursor__dot"></span>';
    document.body.appendChild(cursor);
    var cursorX = -100, cursorY = -100, cursorFrame = 0;
    document.addEventListener('pointermove', function (event) {
      cursorX = event.clientX; cursorY = event.clientY;
      if (!cursorFrame) cursorFrame = window.requestAnimationFrame(function () {
        cursor.style.transform = 'translate3d(' + cursorX + 'px,' + cursorY + 'px,0) translate(-50%,-50%)';
        cursor.classList.add('is-active'); cursorFrame = 0;
      });
      var target = event.target && event.target.closest ? event.target.closest('a, button, [role="button"], input, .carousel-stage') : null;
      cursor.classList.toggle('is-targeting', !!target);
    });
    document.addEventListener('pointerleave', function () { cursor.classList.remove('is-active'); });
  }

  /* Circular carousel: 3D ring with drag/swipe, controls, keyboard and click-to-focus. */
  var stage = document.getElementById('project-carousel');
  if (stage) {
    var ring = stage.querySelector('.carousel-ring');
    var cards = Array.prototype.slice.call(stage.querySelectorAll('.orbit-card'));
    var status = document.getElementById('carousel-status');
    var current = 0, rotation = 0, startX = 0, startRotation = 0, dragging = false, moved = false;
    var radius = window.matchMedia('(max-width: 640px)').matches ? 215 : 300;
    var cardAngle = 360 / cards.length;
    function layoutCarousel(animate) {
      ring.style.transition = animate ? 'transform .65s cubic-bezier(.2,.75,.2,1)' : 'none';
      ring.style.transform = 'translateZ(-' + radius + 'px) rotateY(' + rotation + 'deg)';
      cards.forEach(function (card, index) {
        var angle = index * cardAngle;
        card.style.transform = 'translate(-50%, -50%) rotateY(' + angle + 'deg) translateZ(' + radius + 'px)';
        card.style.zIndex = String(Math.round(100 + 50 * Math.cos((angle + rotation) * Math.PI / 180)));
        card.setAttribute('aria-current', index === current ? 'true' : 'false');
        card.style.filter = Math.cos((angle + rotation) * Math.PI / 180) > .2 ? 'brightness(1)' : 'brightness(.62)';
      });
      if (status) status.innerHTML = String(current + 1).padStart(2, '0') + ' <span>/</span> ' + String(cards.length).padStart(2, '0');
    }
    function goTo(index) { current = (index + cards.length) % cards.length; rotation = -current * cardAngle; layoutCarousel(true); }
    document.getElementById('carousel-prev').addEventListener('click', function () { goTo(current - 1); });
    document.getElementById('carousel-next').addEventListener('click', function () { goTo(current + 1); });
    stage.addEventListener('pointerdown', function (event) {
      startX = event.clientX; startRotation = rotation; moved = false; dragging = true;
      if (stage.setPointerCapture) stage.setPointerCapture(event.pointerId);
      ring.style.transition = 'none';
    });
    stage.addEventListener('pointermove', function (event) {
      if (!dragging) return;
      var delta = event.clientX - startX;
      if (Math.abs(delta) > 5) moved = true;
      rotation = startRotation + delta * .22;
      ring.style.transform = 'translateZ(-' + radius + 'px) rotateY(' + rotation + 'deg)';
      cards.forEach(function (card, index) {
        var angle = index * cardAngle + rotation;
        card.style.zIndex = String(Math.round(100 + 50 * Math.cos(angle * Math.PI / 180)));
        card.style.filter = Math.cos(angle * Math.PI / 180) > .2 ? 'brightness(1)' : 'brightness(.62)';
      });
    });
    function endDrag() {
      if (!dragging) return;
      dragging = false;
      var nearest = Math.round(-rotation / cardAngle);
      current = (nearest % cards.length + cards.length) % cards.length;
      rotation = -current * cardAngle;
      layoutCarousel(true);
    }
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);
    stage.addEventListener('lostpointercapture', endDrag);
    stage.addEventListener('click', function (event) {
      if (moved) { event.preventDefault(); event.stopPropagation(); moved = false; return; }
      var card = event.target.closest('.orbit-card');
      if (!card) return;
      var index = cards.indexOf(card);
      if (index !== current) { event.preventDefault(); goTo(index); return; }
      if (card.dataset.action === 'labo') { event.preventDefault(); document.getElementById('btn-labo').click(); }
    });
    stage.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowLeft') { event.preventDefault(); goTo(current - 1); }
      if (event.key === 'ArrowRight') { event.preventDefault(); goTo(current + 1); }
      if (event.key === 'Home') { event.preventDefault(); goTo(0); }
      if (event.key === 'End') { event.preventDefault(); goTo(cards.length - 1); }
    });
    window.addEventListener('resize', function () { radius = window.matchMedia('(max-width: 640px)').matches ? 215 : 300; layoutCarousel(false); });
    layoutCarousel(false);
  }

})();
