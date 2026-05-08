import { Component } from '@theme/component';
import { CartErrorEvent, CartUpdateEvent } from '@theme/events';

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

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, '&#39;');
}

function showWishlistNotice(root, message, { tone = 'warning', timeoutMs = 7000 } = {}) {
  if (!(root instanceof Element)) return;
  const el = root.querySelector('[data-wishlist-notice]');
  if (!(el instanceof HTMLElement)) return;
  if (!message) {
    el.hidden = true;
    el.textContent = '';
    el.removeAttribute('data-tone');
    return;
  }
  el.textContent = String(message);
  el.hidden = false;
  el.setAttribute('data-tone', tone);

  if (timeoutMs > 0) {
    window.clearTimeout(el.__rbWishlistNoticeTimeout);
    el.__rbWishlistNoticeTimeout = window.setTimeout(() => {
      el.hidden = true;
    }, timeoutMs);
  }
}

/** Matches `assets/icon-add-to-cart.svg` for card actions (no CSS var stroke width). */
const WISHLIST_BAG_ADD_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.33" d="M16.608 9.421V6.906H3.392v8.016c0 .567.224 1.112.624 1.513.4.402.941.627 1.506.627H8.63M8.818 3h2.333c.618 0 1.212.247 1.649.686a2.35 2.35 0 0 1 .683 1.658v1.562H6.486V5.344c0-.622.246-1.218.683-1.658A2.33 2.33 0 0 1 8.82 3"/><path stroke="currentColor" stroke-linecap="round" stroke-width="1.33" d="M14.608 12.563v5m2.5-2.5h-5"/></svg>`;

function productCardHtml(product) {
  const img = product?.featured_image;
  const title = product?.title || '';
  const vendor = product?.vendor || '';
  const handle = product?.handle || '';
  const url = product?.url || `/products/${handle}`;
  const available = Boolean(product?.available);
  const variantId = product?.variants?.[0]?.id;
  const price = product?.price;
  const compareAt = product?.compare_at_price;
  const addLabel = window.themeStrings?.wishlist?.actions?.add_to_cart || 'Add to cart';
  const removeLabel = window.themeStrings?.wishlist?.actions?.remove || 'Remove';

  const vendorBlock = vendor
    ? `<p class="rb-wishlist-card__vendor">${escapeHtml(vendor)}</p>`
    : '';

  return `
    <article class="rb-wishlist-card" data-wishlist-handle="${escapeAttr(handle)}">
      <a class="rb-wishlist-card__media" href="${escapeAttr(url)}">
        ${
          img
            ? `<img src="${escapeAttr(img)}" alt="${escapeAttr(title)}" loading="lazy" width="262" height="349" />`
            : ''
        }
      </a>
      <div class="rb-wishlist-card__body">
        ${vendorBlock}
        <a class="rb-wishlist-card__title" href="${escapeAttr(url)}">${escapeHtml(title)}</a>
        <div class="rb-wishlist-card__price-row">
          <span class="rb-wishlist-card__price">${money(price)}</span>
          ${
            compareAt && compareAt > price
              ? `<span class="rb-wishlist-card__compare">${money(compareAt)}</span>`
              : ''
          }
        </div>
        <div class="rb-wishlist-card__footer">
          <button
            class="rb-wishlist-card__add"
            type="button"
            data-wishlist-add-to-cart="${escapeAttr(handle)}"
            ${!available || !variantId ? 'disabled' : ''}
            data-variant-id="${variantId || ''}"
          >
            <span class="rb-wishlist-card__add-icon svg-wrapper" aria-hidden="true">${WISHLIST_BAG_ADD_ICON}</span>
            <span>${escapeHtml(addLabel)}</span>
          </button>
          <button class="rb-wishlist-card__remove" type="button" data-wishlist-remove="${escapeAttr(handle)}">
            ${escapeHtml(removeLabel)}
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
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.status) {
    const message = json?.message || 'Failed to add to cart';
    const description = json?.description || '';
    const errors = json?.errors || null;
    const err = new Error(message);
    err.name = 'CartAddError';
    // @ts-ignore
    err.cart = { message, description, errors };
    throw err;
  }
  return json;
}

async function addVariantsToCartBulk(variantIds, quantity = 1) {
  const uniqueIds = [...new Set((variantIds || []).map((x) => Number(x)).filter(Boolean))];
  if (uniqueIds.length === 0) return null;

  const cartAddUrl = window?.Theme?.routes?.cart_add_url || '/cart/add.js';
  const res = await fetch(cartAddUrl, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      items: uniqueIds.map((id) => ({ id, quantity })),
    }),
  });

  // Shopify returns 200 JSON for success and 4xx JSON for errors (message/description/errors/status)
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.status) {
    const message = json?.message || 'Failed to add items to cart';
    const description = json?.description || '';
    const errors = json?.errors || null;
    const err = new Error(message);
    err.name = 'CartAddError';
    // @ts-ignore
    err.cart = { message, description, errors };
    throw err;
  }

  return json;
}

async function fetchCart() {
  const res = await fetch('/cart.js', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('Failed to fetch cart');
  return await res.json();
}

function updateToggles(handles) {
  const set = new Set(handles);
  document.querySelectorAll('[data-wishlist-toggle]').forEach((btn) => {
    const handle = btn.getAttribute('data-wishlist-toggle') || '';
    setPressed(btn, set.has(handle));
  });
}

function wishlistCountDisplay(n) {
  if (n > 99) return '99+';
  return String(n);
}

function updateHeaderCount(handles) {
  const n = handles.length;
  const pageCountText = String(n);
  document.querySelectorAll('[data-wishlist-count]').forEach((el) => {
    el.textContent = pageCountText;
  });
  const bubbleText = wishlistCountDisplay(n);
  document.querySelectorAll('[data-wishlist-header-count]').forEach((el) => {
    el.textContent = bubbleText;
  });
  document.querySelectorAll('[data-wishlist-header-bubble]').forEach((el) => {
    if (el instanceof HTMLElement) el.hidden = n === 0;
  });
  document.querySelectorAll('[data-wishlist-link]').forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    const base = el.getAttribute('data-wishlist-aria-base') || el.getAttribute('aria-label') || 'Wishlist';
    const withCountTpl = el.getAttribute('data-wishlist-aria-with-count') || '';
    if (n === 0) {
      el.setAttribute('aria-label', base);
      return;
    }
    const label = withCountTpl ? withCountTpl.replace(/\{count\}/g, String(n)) : `${base}, ${n}`;
    el.setAttribute('aria-label', label);
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
        showWishlistNotice(this, '', { timeoutMs: 0 });
        const handle = target.getAttribute('data-wishlist-remove');
        if (!handle) return;
        const next = readList().filter((h) => h !== handle);
        writeList(next);
      }

      if (target.matches('[data-wishlist-add-to-cart]')) {
        e.preventDefault();
        showWishlistNotice(this, '', { timeoutMs: 0 });
        const handle = target.getAttribute('data-wishlist-add-to-cart') || '';
        const variantId = Number(target.getAttribute('data-variant-id'));
        if (!variantId) return;
        target.setAttribute('aria-busy', 'true');
        try {
          await addVariantToCart(variantId, 1);
          try {
            const cart = await fetchCart();
            const itemCount = Number(cart?.item_count) || 0;
            this.dispatchEvent(
              new CartUpdateEvent(cart, 'wishlist', {
                itemCount,
                source: 'wishlist',
              }),
            );
          } catch (_) {
            // no-op
          }

          if (handle) {
            const next = readList().filter((h) => h !== handle);
            writeList(next);
          }
        } catch (err) {
          // @ts-ignore
          const cartErr = err?.cart || {};
          const message = cartErr?.message || err?.message || 'Failed to add to cart';
          this.dispatchEvent(new CartErrorEvent('wishlist', message, '', null));

          const isMaxQty = /maximum quantity/i.test(message);
          if (isMaxQty) {
            // Item is already in cart at the max allowed quantity; remove from wishlist as "already handled".
            if (handle) {
              const next = readList().filter((h) => h !== handle);
              writeList(next);
            }
            showWishlistNotice(this, message, { tone: 'warning' });
          } else {
            showWishlistNotice(this, message, { tone: 'error' });
          }
        } finally {
          target.removeAttribute('aria-busy');
        }
      }
    });

    this.querySelector('[data-wishlist-clear]')?.addEventListener('click', () => writeList([]));

    this.querySelector('[data-wishlist-add-all]')?.addEventListener('click', async () => {
      const addAllBtn = this.querySelector('[data-wishlist-add-all]');
      if (addAllBtn instanceof HTMLButtonElement && addAllBtn.disabled) return;

      showWishlistNotice(this, '', { timeoutMs: 0 });

      const handles = readList();
      if (handles.length === 0) return;

      const buttons = this.querySelectorAll('[data-wishlist-add-to-cart]');
      /** @type {Array<{handle: string, variantId: number}>} */
      const addable = Array.from(buttons)
        .filter((b) => b instanceof HTMLButtonElement && !b.disabled)
        .map((b) => ({
          handle: b.getAttribute('data-wishlist-add-to-cart') || '',
          variantId: Number(b.getAttribute('data-variant-id')),
        }))
        .filter((x) => Boolean(x.handle) && Boolean(x.variantId));

      const skipped = Array.from(buttons).filter((b) => b instanceof HTMLButtonElement && b.disabled).length;

      const ids = addable.map((x) => x.variantId);
      if (ids.length === 0) {
        if (skipped > 0) {
          showWishlistNotice(
            this,
            `${skipped} item(s) are currently out of stock. Please remove them to add the remaining products to your cart.`,
            {
            tone: 'warning',
            },
          );
        }
        return;
      }

      if (addAllBtn instanceof HTMLElement) addAllBtn.setAttribute('aria-busy', 'true');
      if (addAllBtn instanceof HTMLButtonElement) addAllBtn.disabled = true;

      try {
        await addVariantsToCartBulk(ids, 1);

        // Fetch true cart state and emit theme event so cart icon/drawer updates.
        const cart = await fetchCart();
        const itemCount = Number(cart?.item_count) || 0;
        this.dispatchEvent(
          new CartUpdateEvent(cart, 'wishlist', {
            itemCount,
            source: 'wishlist',
          }),
        );

        // Items are now in cart: remove them from wishlist grid.
        const handlesToRemove = new Set(addable.map((x) => x.handle));
        const next = readList().filter((h) => !handlesToRemove.has(h));
        writeList(next);

        if (skipped > 0) {
          showWishlistNotice(
            this,
            `${skipped} item(s) are currently out of stock. Please remove them to add the remaining products to your cart.`,
            { tone: 'warning' },
          );
        }
      } catch (err) {
        // Match theme error shape so listeners can show messaging if they want.
        // @ts-ignore
        const cartErr = err?.cart || {};
        const message = cartErr?.message || err?.message || 'Failed to add items to cart';
        const description = cartErr?.description || '';
        const errors = cartErr?.errors || null;
        this.dispatchEvent(new CartErrorEvent('wishlist', message, description, errors));
        showWishlistNotice(this, message, { tone: 'error' });

        // Fallback: try sequential adds, skipping failures, so "some" items still go in cart.
        /** @type {Set<number>} */
        const succeeded = new Set();
        /** @type {Set<number>} */
        const maxedAlreadyInCart = new Set();
        for (const id of [...new Set(ids)]) {
          try {
            // eslint-disable-next-line no-await-in-loop
            await addVariantToCart(id, 1);
            succeeded.add(id);
          } catch (_) {
            // If item is already at max quantity in cart, treat it as "handled" for wishlist removal.
            // @ts-ignore
            const message = _?.cart?.message || _?.message || '';
            if (/maximum quantity/i.test(message)) {
              maxedAlreadyInCart.add(id);
            }
          }
        }
        if (succeeded.size > 0 || maxedAlreadyInCart.size > 0) {
          const handlesToRemove = new Set(
            addable
              .filter((x) => succeeded.has(x.variantId) || maxedAlreadyInCart.has(x.variantId))
              .map((x) => x.handle),
          );
          const next = readList().filter((h) => !handlesToRemove.has(h));
          writeList(next);
        }
        try {
          const cart = await fetchCart();
          const itemCount = Number(cart?.item_count) || 0;
          this.dispatchEvent(
            new CartUpdateEvent(cart, 'wishlist', {
              itemCount,
              source: 'wishlist',
            }),
          );
        } catch (_) {
          // no-op
        }
      } finally {
        if (addAllBtn instanceof HTMLElement) addAllBtn.removeAttribute('aria-busy');
        if (addAllBtn instanceof HTMLButtonElement) addAllBtn.disabled = false;
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

  document.addEventListener('wishlist:change', (evt) => {
    const handles = evt?.detail?.handles || readList();
    updateToggles(handles);
    updateHeaderCount(handles);
  });

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

