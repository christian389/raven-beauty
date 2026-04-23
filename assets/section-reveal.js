import { onDocumentReady, prefersReducedMotion } from '@theme/utilities';

const REVEAL_CLASS = 'rb-reveal';
const REVEAL_VISIBLE_CLASS = 'rb-reveal--visible';

/**
 * @param {Element} el
 * @returns {el is HTMLElement}
 */
function isHTMLElement(el) {
  return el instanceof HTMLElement;
}

/**
 * @returns {HTMLElement[]}
 */
function getRevealTargets() {
  return /** @type {HTMLElement[]} */ ([
    ...document.querySelectorAll('.shopify-section:not(.header-section)'),
  ]).filter((el) => isHTMLElement(el) && el.querySelector('.section'));
}

/**
 * @param {HTMLElement[]} targets
 */
function markInitialState(targets) {
  targets.forEach((el) => {
    if (el.classList.contains(REVEAL_VISIBLE_CLASS)) return;
    el.classList.add(REVEAL_CLASS);
  });
}

function revealAll() {
  getRevealTargets().forEach((el) => {
    el.classList.add(REVEAL_CLASS, REVEAL_VISIBLE_CLASS);
  });
}

function setupRevealObserver() {
  if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
    revealAll();
    return;
  }

  const targets = getRevealTargets();
  markInitialState(targets);

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const target = entry.target;
        if (!isHTMLElement(target)) return;

        if (entry.isIntersecting) {
          target.classList.add(REVEAL_VISIBLE_CLASS);
          observer.unobserve(target);
        }
      });
    },
    {
      threshold: 0.15,
      rootMargin: '0px 0px -10% 0px',
    }
  );

  targets.forEach((el) => observer.observe(el));

  const refresh = () => {
    const next = getRevealTargets();
    markInitialState(next);
    next.forEach((el) => {
      if (!el.classList.contains(REVEAL_VISIBLE_CLASS)) observer.observe(el);
    });
  };

  document.addEventListener('shopify:section:load', refresh);
  document.addEventListener('shopify:section:reorder', refresh);
  document.addEventListener('shopify:section:select', refresh);
}

onDocumentReady(setupRevealObserver);

