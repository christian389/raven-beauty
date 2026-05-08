import { Component } from '@theme/component';

const STORAGE_KEY = 'raven:wishlist:v1';

function readList() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeList(handles) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(handles));
  document.dispatchEvent(
    new CustomEvent('wishlist:change', {
      detail: { handles: [...handles] },
    }),
  );
}

function unique(handles) {
  return [...new Set(handles.filter(Boolean))];
}

function setPressed(btn, pressed) {
  if (!(btn instanceof HTMLElement)) return;
  btn.setAttribute('aria-pressed', pressed ? 'true' : 'false');
  btn.toggleAttribute('data-wishlist-active', pressed);
}

async function fetchProductJson(handle, { signal } = {}) {
  const res = await fetch(`/products/${encodeURIComponent(handle)}.js`, {
    credentials: 'same-origin',
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Failed to fetch product ${handle}`);
  return await res.json();
}

function money(cents, currency = (window.Shopify && Shopify.currency && Shopify.currency.active) || 'USD') {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
    }).format((cents || 0) / 100);
  } catch {
    return `${(cents || 0) / 100}`;
  }
}

function productCardHtml(product) {
  const img = product?.featured_image;
  const title = product?.title || '';
  const handle = product?.handle || '';
  const url = product?.url || `/products/${handle}`;
  const available = Boolean(product?.available);
  const variantId = product?.variants?.[0]?.id;
  const price = product?.price;
  const compareAt = product?.compare_at_price;

  return `
    <article class="rb-wishlist-card" data-wishlist-handle="${handle}">
      <a class="rb-wishlist-card__media" href="${url}">
        ${img ? `<img src="${img}" alt="" loading="lazy" />` : ''}
      </a>
      <div class="rb-wishlist-card__body">
        <a class="rb-wishlist-card__title" href="${url}">${title}</a>
        <div class="rb-wishlist-card__meta">
          <span class="rb-wishlist-card__price">${money(price)}</span>
          ${
            compareAt && compareAt > price
              ? `<span class="rb-wishlist-card__compare">${money(compareAt)}</span>`
              : ''
          }
        </div>
        <div class="rb-wishlist-card__actions">
          <button class="button button-secondary rb-wishlist-card__remove" type="button" data-wishlist-remove="${handle}">
            ${window.themeStrings?.wishlist?.actions?.remove || 'Remove'}
          </button>
          <button
            class="button rb-wishlist-card__add"
            type="button"
            data-wishlist-add-to-cart="${handle}"
            ${!available || !variantId ? 'disabled' : ''}
            data-variant-id="${variantId || ''}"
          >
            ${window.themeStrings?.wishlist?.actions?.add_to_cart || 'Add to cart'}
          </button>
        </div>
      </div>
    </article>
  `;
}

async function addVariantToCart(variantId, quantity = 1) {
  const res = await fetch('/cart/add.js', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ items: [{ id: variantId, quantity }] }),
  });
  if (!res.ok) throw new Error('Failed to add to cart');
  return await res.json();
}

function updateToggles(handles) {
  const set = new Set(handles);
  document.querySelectorAll('[data-wishlist-toggle]').forEach((btn) => {
    const handle = btn.getAttribute('data-wishlist-toggle') || '';
    setPressed(btn, set.has(handle));
  });
}

function updateHeaderCount(handles) {
  document.querySelectorAll('[data-wishlist-count]').forEach((el) => {
    el.textContent = String(handles.length);
  });
}

function updateWishlistPageUi(root, handles) {
  if (!(root instanceof Element)) return;
  const empty = root.querySelector('[data-wishlist-empty]');
  const grid = root.querySelector('[data-wishlist-grid]');
  const clearBtn = root.querySelector('[data-wishlist-clear]');
  const addAllBtn = root.querySelector('[data-wishlist-add-all]');

  const hasItems = handles.length > 0;

  if (empty instanceof HTMLElement) empty.hidden = hasItems;
  if (grid instanceof HTMLElement) grid.hidden = !hasItems;
  if (clearBtn instanceof HTMLButtonElement) clearBtn.disabled = !hasItems;
  if (addAllBtn instanceof HTMLButtonElement) addAllBtn.disabled = !hasItems;
}

async function renderWishlistGrid(root, handles) {
  const grid = root.querySelector('[data-wishlist-grid]');
  if (!(grid instanceof HTMLElement)) return;

  grid.innerHTML = '';
  if (handles.length === 0) return;

  const controller = new AbortController();
  root.__wishlistAbortController?.abort?.();
  root.__wishlistAbortController = controller;

  const products = await Promise.all(
    handles.map(async (handle) => {
      try {
        return await fetchProductJson(handle, { signal: controller.signal });
      } catch {
        return null;
      }
    }),
  );

  const html = products.filter(Boolean).map(productCardHtml).join('');
  grid.insertAdjacentHTML('beforeend', html);
}

function ensureThemeStrings() {
  // Provide a stable place for wishlist.js to read translated strings without
  // hardcoding english/danish in JS.
  window.themeStrings = window.themeStrings || {};
  window.themeStrings.wishlist = window.themeStrings.wishlist || {};
}

class WishlistPageComponent extends Component {
  connectedCallback() {
    ensureThemeStrings();

    this.onWishlistChange = (evt) => {
      const handles = evt?.detail?.handles || readList();
      updateToggles(handles);
      updateHeaderCount(handles);
      updateWishlistPageUi(this, handles);
      renderWishlistGrid(this, handles);
    };

    document.addEventListener('wishlist:change', this.onWishlistChange);

    // Initial render
    const handles = readList();
    updateToggles(handles);
    updateHeaderCount(handles);
    updateWishlistPageUi(this, handles);
    renderWishlistGrid(this, handles);

    // Delegated actions
    this.addEventListener('click', async (e) => {
      const target = e.target instanceof Element ? e.target.closest('[data-wishlist-remove],[data-wishlist-add-to-cart]') : null;
      if (!target) return;

      if (target.matches('[data-wishlist-remove]')) {
        e.preventDefault();
        const handle = target.getAttribute('data-wishlist-remove');
        if (!handle) return;
        const next = readList().filter((h) => h !== handle);
        writeList(next);
      }

      if (target.matches('[data-wishlist-add-to-cart]')) {
        e.preventDefault();
        const variantId = Number(target.getAttribute('data-variant-id'));
        if (!variantId) return;
        target.setAttribute('aria-busy', 'true');
        try {
          await addVariantToCart(variantId, 1);
        } finally {
          target.removeAttribute('aria-busy');
        }
      }
    });

    this.querySelector('[data-wishlist-clear]')?.addEventListener('click', () => writeList([]));

    this.querySelector('[data-wishlist-add-all]')?.addEventListener('click', async () => {
      const handles = readList();
      if (handles.length === 0) return;
      const buttons = this.querySelectorAll('[data-wishlist-add-to-cart]');
      const ids = Array.from(buttons)
        .map((b) => Number(b.getAttribute('data-variant-id')))
        .filter(Boolean);
      if (ids.length === 0) return;

      // Add sequentially to avoid 429s
      for (const id of ids) {
        // eslint-disable-next-line no-await-in-loop
        await addVariantToCart(id, 1);
      }
    });
  }

  disconnectedCallback() {
    document.removeEventListener('wishlist:change', this.onWishlistChange);
    this.__wishlistAbortController?.abort?.();
  }
}

function attachGlobalWishlistToggleHandlers() {
  document.addEventListener('click', (e) => {
    const btn = e.target instanceof Element ? e.target.closest('[data-wishlist-toggle]') : null;
    if (!(btn instanceof HTMLElement)) return;
    e.preventDefault();
    const handle = btn.getAttribute('data-wishlist-toggle');
    if (!handle) return;

    const current = readList();
    const set = new Set(current);
    if (set.has(handle)) set.delete(handle);
    else set.add(handle);
    const next = unique([...set]);
    writeList(next);
    setPressed(btn, set.has(handle));
  });
}

function boot() {
  ensureThemeStrings();
  attachGlobalWishlistToggleHandlers();

  // Initialize UI based on current store.
  const handles = readList();
  updateToggles(handles);
  updateHeaderCount(handles);

  if (!customElements.get('wishlist-page-component')) {
    customElements.define('wishlist-page-component', WishlistPageComponent);
  }

  // Upgrade any rb-wishlist root into the component instance
  document.querySelectorAll('[data-rb-wishlist]').forEach((root) => {
    if (root.tagName.toLowerCase() === 'wishlist-page-component') return;
    // If the section root is a normal element, morph it into our component behavior by setting prototype.
    // This is a lightweight way to reuse the Component base without changing markup.
    Object.setPrototypeOf(root, WishlistPageComponent.prototype);
    WishlistPageComponent.prototype.connectedCallback.call(root);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

