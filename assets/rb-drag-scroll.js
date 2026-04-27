/**
 * Enables click-and-drag horizontal scrolling for a container.
 * Scoped to Raven product hero thumbnails to avoid side effects.
 */

function enableDragScroll(scroller) {
  let isPointerDown = false;
  let startX = 0;
  let startScrollLeft = 0;
  let didDrag = false;
  let activePointerId = null;

  const setGrabbing = (grabbing) => {
    scroller.style.cursor = grabbing ? 'grabbing' : '';
    scroller.style.userSelect = grabbing ? 'none' : '';
  };

  scroller.addEventListener('pointerdown', (e) => {
    // Only enhance mouse / pen dragging. Touch already scrolls naturally.
    if (e.pointerType === 'touch') return;
    if (e.button != null && e.button !== 0) return;

    isPointerDown = true;
    didDrag = false;
    activePointerId = e.pointerId;
    startX = e.clientX;
    startScrollLeft = scroller.scrollLeft;

    try {
      scroller.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    setGrabbing(true);
  });

  scroller.addEventListener('pointermove', (e) => {
    if (!isPointerDown) return;
    if (activePointerId != null && e.pointerId !== activePointerId) return;

    const dx = e.clientX - startX;
    if (Math.abs(dx) > 3) didDrag = true;
    scroller.scrollLeft = startScrollLeft - dx;
  });

  const end = () => {
    if (!isPointerDown) return;
    isPointerDown = false;
    activePointerId = null;
    setGrabbing(false);

    // Prevent “click” on thumbnail buttons if user dragged.
    if (didDrag) {
      const cancelClick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        scroller.removeEventListener('click', cancelClick, true);
      };
      scroller.addEventListener('click', cancelClick, true);
      didDrag = false;
    }
  };

  scroller.addEventListener('pointerup', end);
  scroller.addEventListener('pointercancel', end);
  scroller.addEventListener('pointerleave', end);
}

function init() {
  document
    .querySelectorAll(
      '.rb-product-hero__media slideshow-controls[thumbnails] .slideshow-controls__thumbnails-container'
    )
    .forEach((el) => {
      if (el.dataset.rbDragScrollInitialized === 'true') return;
      el.dataset.rbDragScrollInitialized = 'true';
      enableDragScroll(el);
    });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

