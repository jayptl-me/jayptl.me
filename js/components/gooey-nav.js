"use strict";

/**
 * Gooey Navigation Effect - Fluid, Calm & Pure Monochromatic
 *
 * Features:
 * - Pure white metaball pill & particles in both Dark and Light modes.
 * - Slower, silky, organic hover bubble burst with staggered fluid emergence.
 * - Instant, seamless transfer between items with zero text jumps or flicker.
 * - Active state continuous breathing loop + orbiting border droplets.
 * - Suppressed transitions on initial page load (zero fly-in from corner).
 * - Real nav links at z-index 2 handle text contrast (#0d1621 / #0f172a).
 *
 * @file js/components/gooey-nav.js
 */

(function () {
  const MOBILE_QUERY = '(max-width: 860px)';
  const PER_ITEM_COOLDOWN_MS = 900;
  const PARTICLE_COUNT = 10;
  const PARTICLE_DISTANCES = [16, 46];
  const PARTICLE_R = 75;
  const ANIMATION_TIME = 1300;
  const TIME_VARIANCE = 200;

  const noise = (n = 1) => n / 2 - Math.random() * n;

  function getXY(distance, pointIndex, totalPoints) {
    const angle = ((360 + noise(6)) / totalPoints) * pointIndex * (Math.PI / 180);
    return [distance * Math.cos(angle), distance * Math.sin(angle)];
  }

  function createParticle(i) {
    const rotate = noise(PARTICLE_R / 10);
    return {
      start: getXY(PARTICLE_DISTANCES[0], PARTICLE_COUNT - i, PARTICLE_COUNT),
      end: getXY(PARTICLE_DISTANCES[1] + noise(6), PARTICLE_COUNT - i, PARTICLE_COUNT),
      time: Math.round(ANIMATION_TIME + noise(TIME_VARIANCE)),
      scale: +(1 + noise(0.25)).toFixed(2),
      rotate: Math.round(rotate > 0 ? (rotate + PARTICLE_R / 20) * 10 : (rotate - PARTICLE_R / 20) * 10)
    };
  }

  function makeParticles(filterEl) {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = createParticle(i);
      setTimeout(() => {
        if (!filterEl || !filterEl.isConnected) return;
        const particle = document.createElement('span');
        particle.className = 'gooey-particle';
        particle.style.setProperty('--start-x', `${Math.round(p.start[0])}px`);
        particle.style.setProperty('--start-y', `${Math.round(p.start[1])}px`);
        particle.style.setProperty('--end-x', `${Math.round(p.end[0])}px`);
        particle.style.setProperty('--end-y', `${Math.round(p.end[1])}px`);
        particle.style.setProperty('--time', `${p.time}ms`);
        particle.style.setProperty('--scale', `${p.scale}`);
        particle.style.setProperty('--rotate', `${p.rotate}deg`);

        const point = document.createElement('span');
        point.className = 'gooey-point';
        particle.appendChild(point);
        filterEl.appendChild(particle);

        setTimeout(() => {
          try { filterEl.removeChild(particle); } catch { /* already gone */ }
        }, p.time + 100);
      }, i * 22);
    }
  }

  function updateEffectPosition(container, els, target) {
    if (!container || !target) return;
    const containerRect = container.getBoundingClientRect();
    const rect = target.getBoundingClientRect();
    const x = Math.round(rect.left - containerRect.left);
    const y = Math.round(rect.top - containerRect.top);
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);

    els.forEach((el) => {
      if (!el) return;
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
      el.style.setProperty('--pill-w', `${w}px`);
      el.style.setProperty('--pill-h', `${h}px`);
    });
  }

  function normalizePath(href) {
    try {
      let path = new URL(href, window.location.href).pathname;
      path = path.replace(/index\.html$/, '').replace(/\.html$/, '');
      if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
      return path || '/';
    } catch {
      return href;
    }
  }

  /**
   * The "locked" item mirrors the current page: a direct rail link whose href
   * matches, otherwise the dropdown toggle that claims the route.
   */
  function resolveLockedItem(rail) {
    const current = normalizePath(window.location.pathname);

    for (const child of Array.from(rail.children)) {
      if (child.matches('a.nav-link') && normalizePath(child.getAttribute('href')) === current) {
        return child;
      }
    }
    for (const child of Array.from(rail.children)) {
      if (!child.classList.contains('nav-dropdown')) continue;
      const claims = Array.from(child.querySelectorAll('a[href]'))
        .some((a) => normalizePath(a.getAttribute('href')) === current);
      if (claims) return child.querySelector(':scope > .nav-dropdown-toggle');
    }
    return null;
  }

  function init(nav) {
    if (!nav || nav.dataset.gooeyReady === 'true') return;

    const rail = nav.querySelector('.nav-rail');
    if (!rail) return;

    const mqMobile = window.matchMedia ? window.matchMedia(MOBILE_QUERY) : null;
    if (mqMobile && mqMobile.matches) {
      const onChange = () => {
        if (!mqMobile.matches) {
          if (mqMobile.removeEventListener) mqMobile.removeEventListener('change', onChange);
          else if (mqMobile.removeListener) mqMobile.removeListener(onChange);
          init(nav);
        }
      };
      if (mqMobile.addEventListener) mqMobile.addEventListener('change', onChange);
      else if (mqMobile.addListener) mqMobile.addListener(onChange);
      return;
    }

    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // Ensure the SVG alpha-threshold filter is available in DOM
    if (!document.getElementById('gooeyNavFilter')) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.id = 'gooeyNavFilterSvg';
      svg.setAttribute('aria-hidden', 'true');
      svg.style.position = 'absolute';
      svg.style.width = '0';
      svg.style.height = '0';
      svg.style.overflow = 'hidden';
      svg.style.pointerEvents = 'none';
      svg.innerHTML = '<defs><filter id="gooeyNavFilter" x="-60%" y="-100%" width="220%" height="300%" color-interpolation-filters="sRGB"><feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur"/><feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -8" result="goo"/><feComposite in="SourceGraphic" in2="goo" operator="atop"/></filter></defs>';
      document.body.appendChild(svg);
    }

    nav.dataset.gooeyReady = 'true';
    rail.classList.add('gooey-nav-container');

    const filter = document.createElement('span');
    filter.className = 'gooey-effect gooey-filter';
    filter.setAttribute('aria-hidden', 'true');

    // Orbiting live bubbles that continuously circulate around the pill border in active state
    const orbit1 = document.createElement('span');
    orbit1.className = 'gooey-orbit-bubble gooey-orbit-1';
    orbit1.setAttribute('aria-hidden', 'true');
    const orbit2 = document.createElement('span');
    orbit2.className = 'gooey-orbit-bubble gooey-orbit-2';
    orbit2.setAttribute('aria-hidden', 'true');
    filter.appendChild(orbit1);
    filter.appendChild(orbit2);

    rail.appendChild(filter);

    const state = {
      locked: null,
      shown: null,
      lastBurst: new WeakMap(),
      loopTimeout: null,
      restoreTimer: null
    };

    const items = Array.from(rail.children).map((child) => {
      if (child.classList.contains('nav-dropdown')) {
        return child.querySelector(':scope > .nav-dropdown-toggle');
      }
      return child.classList.contains('nav-link') ? child : null;
    }).filter(Boolean);

    const clearLoopTimer = () => {
      if (state.loopTimeout) {
        clearTimeout(state.loopTimeout);
        state.loopTimeout = null;
      }
    };

    const cancelRestore = () => {
      if (state.restoreTimer) {
        clearTimeout(state.restoreTimer);
        state.restoreTimer = null;
      }
    };

    const showOn = (el, mode) => {
      clearLoopTimer();
      cancelRestore();
      items.forEach((item) => item.classList.toggle('gooey-active', item === el));

      if (!el) {
        filter.classList.remove('gooey-on', 'gooey-looping');
        return;
      }

      updateEffectPosition(rail, [filter], el);
      filter.classList.add('gooey-on');

      if (mode === 'burst') {
        filter.classList.remove('gooey-looping');
        Array.from(filter.querySelectorAll('.gooey-particle')).forEach((p) => p.remove());
        makeParticles(filter);
      } else if (mode === 'loop') {
        filter.classList.add('gooey-looping');
      } else {
        filter.classList.remove('gooey-looping');
        if (el === state.locked) {
          state.loopTimeout = setTimeout(() => {
            if (state.shown === null && state.locked === el) {
              filter.classList.add('gooey-looping');
            }
          }, 350);
        }
      }
    };

    const restore = () => {
      state.shown = null;
      if (state.locked) {
        showOn(state.locked, 'snap');
      } else {
        showOn(null);
      }
    };

    const scheduleRestore = () => {
      cancelRestore();
      state.restoreTimer = setTimeout(() => {
        restore();
      }, 60);
    };

    // Lock the pill onto the current page's item without fly-in transition on initial load
    state.locked = resolveLockedItem(rail);
    if (state.locked) {
      state.locked.classList.add('gooey-active');
      filter.classList.add('no-transition');
      updateEffectPosition(rail, [filter], state.locked);
      // Force reflow so initial placement has no transition
      void filter.offsetHeight;
      filter.classList.remove('no-transition');
      filter.classList.add('gooey-on');
      state.loopTimeout = setTimeout(() => {
        if (state.shown === null) {
          filter.classList.add('gooey-looping');
        }
      }, 350);
    }

    const canBurst = (el) => {
      const last = state.lastBurst.get(el) || 0;
      return performance.now() - last >= PER_ITEM_COOLDOWN_MS;
    };

    items.forEach((el) => {
      const zone = el.closest('.nav-dropdown') || el;

      zone.addEventListener('mouseenter', () => {
        cancelRestore();
        if (el === state.locked && state.shown === null) return;
        if (state.shown === el) return;
        state.shown = el;
        if (canBurst(el)) {
          state.lastBurst.set(el, performance.now());
          showOn(el, 'burst');
        } else {
          showOn(el, 'glide');
        }
      });

      zone.addEventListener('mouseleave', () => {
        scheduleRestore();
      });

      zone.addEventListener('focusin', () => {
        cancelRestore();
        if (el === state.locked && state.shown === null) return;
        if (state.shown === el) return;
        state.shown = el;
        showOn(el, 'burst');
      });

      zone.addEventListener('focusout', (e) => {
        if (state.shown === el && !(e.relatedTarget && zone.contains(e.relatedTarget))) {
          scheduleRestore();
        }
      });

      el.addEventListener('click', () => {
        cancelRestore();
        state.shown = el;
        showOn(el, 'burst');
      });
    });

    rail.addEventListener('mouseleave', () => {
      scheduleRestore();
    });

    rail.addEventListener('mouseenter', () => {
      cancelRestore();
    });

    const reposition = () => {
      const current = state.shown || state.locked;
      if (current) updateEffectPosition(rail, [filter], current);
    };

    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(reposition).observe(rail);
    }
    window.addEventListener('resize', reposition, { passive: true });
  }

  function boot() {
    const nav = document.getElementById('glassNav');
    if (nav) init(nav);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.initGooeyNav = init;
})();
