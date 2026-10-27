/* Lightweight, dependency-free homepage interactions. */
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
