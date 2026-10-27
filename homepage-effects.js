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
})();
