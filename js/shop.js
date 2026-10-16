/*
 * shop.js — how an "Order" button hands over to Shopify.
 *
 * Four ways are built in, so they can be compared. The one in use is
 * SHOP_MODE in config.js; the test panel can switch between them ("Shop").
 *
 *   page    the original idea: the button opens the cuvée's product page on
 *           Shopify (SHOPIFY_BASE_URL + slug)
 *   link    LEVEL 1: the button goes straight to Shopify's checkout with one
 *           bottle of that cuvée in the cart (a "cart permalink":
 *           https://DOMAIN/cart/VARIANT_ID:QUANTITY)
 *   embed   LEVEL 2, SIMULATED: a basket panel in the look of Shopify's own
 *           embeddable cart. It is a stand-in to judge the experience: the real
 *           thing is supplied by Shopify once a store exists.
 *   basket  LEVEL 3: a basket panel in the site's own design. The visitor
 *           builds an order here, then "Checkout" sends the whole basket to
 *           Shopify's checkout in one cart permalink.
 *
 * Nothing here talks to Shopify yet: prices and variant ids are placeholders
 * from config.js. With a real store, level 3 can later read live prices and
 * stock from Shopify's Storefront API; the basket's behaviour stays the same.
 *
 * Markup contract: any link given to Shop.wire(link, cuveeIndex) becomes an
 * order button for that cuvée, whatever the mode.
 */
(function () {
  "use strict";

  var CONFIG = window.SITE_CONFIG || {};
  var CUVEES = CONFIG.CUVEES || [];
  var MODES = ["page", "link", "embed", "basket"];
  var STORAGE_KEY = "site.basket";
  var root = document.documentElement;

  /* ---- Mode ---------------------------------------------------------------- */

  function mode() {
    return root.getAttribute("data-shop") || "link";
  }

  (function initialMode() {
    var saved = null;
    try { saved = localStorage.getItem("proto.shop"); } catch (e) { /* private mode */ }
    var wanted = MODES.indexOf(saved) !== -1 ? saved : CONFIG.SHOP_MODE;
    root.setAttribute("data-shop", MODES.indexOf(wanted) !== -1 ? wanted : "link");
  })();

  function usesBasket() {
    return mode() === "embed" || mode() === "basket";
  }

  /* ---- Links to Shopify -------------------------------------------------------- */

  // Shopify's checkout with these lines already in the cart.
  // lines: [{ index: cuvée position, quantity }]
  function checkoutUrl(lines) {
    var items = lines.map(function (line) {
      return encodeURIComponent(CUVEES[line.index].variantId) + ":" + line.quantity;
    });
    return "https://" + CONFIG.SHOPIFY_DOMAIN + "/cart/" + items.join(",");
  }

  function linkFor(index) {
    var cuvee = CUVEES[index];
    if (!cuvee || cuvee.soon) return null;
    if (mode() === "page") return (CONFIG.SHOPIFY_BASE_URL || "#") + cuvee.slug;
    return checkoutUrl([{ index: index, quantity: 1 }]);
  }

  // Makes `link` the order button of the cuvée at `index` (-1 = none).
  function wire(link, index) {
    if (!link) return;
    link.setAttribute("data-shop-cuvee", index);
    var url = linkFor(index);
    if (url) link.href = url;
    else link.removeAttribute("href"); // unreleased cuvée: a notice, not a link
  }

  function rewire() {
    var links = document.querySelectorAll("[data-shop-cuvee]");
    for (var i = 0; i < links.length; i++) wire(links[i], Number(links[i].getAttribute("data-shop-cuvee")));
  }

  /* ---- Basket contents (levels 2 and 3) ------------------------------------------ */

  var basket = {}; // cuvée position -> quantity

  (function restore() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      Object.keys(saved).forEach(function (key) {
        var cuvee = CUVEES[key];
        if (cuvee && !cuvee.soon && saved[key] > 0) basket[key] = Math.min(99, Math.round(saved[key]));
      });
    } catch (e) { /* nothing saved, or not readable */ }
  })();

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(basket)); } catch (e) { /* private mode */ }
  }

  function lines() {
    return Object.keys(basket).map(function (key) { return { index: Number(key), quantity: basket[key] }; });
  }

  function count() {
    return lines().reduce(function (sum, line) { return sum + line.quantity; }, 0);
  }

  function setQuantity(index, quantity) {
    if (quantity > 0) basket[index] = Math.min(99, quantity);
    else delete basket[index];
    persist();
    render();
  }

  function money(amount) {
    var lang = (window.I18n && window.I18n.lang) || "en";
    try {
      return new Intl.NumberFormat(lang, { style: "currency", currency: CONFIG.CURRENCY || "EUR" }).format(amount);
    } catch (e) {
      return amount.toFixed(2) + " " + (CONFIG.CURRENCY || "EUR");
    }
  }

  function t(key) {
    return window.I18n && window.I18n.lang ? window.I18n.t(key) : "";
  }

  /* ---- Basket panel --------------------------------------------------------------- */

  var panel = null, scrim = null, opener = null, returnFocus = null;

  function build() {
    scrim = document.createElement("div");
    scrim.className = "basket-scrim";
    scrim.hidden = true;
    scrim.addEventListener("click", close);

    panel = document.createElement("aside");
    panel.className = "basket";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "basket-title");
    panel.hidden = true;
    panel.innerHTML =
      '<header class="basket__head">' +
        '<h2 class="basket__title" id="basket-title" data-i18n="shop.basket"></h2>' +
        '<button type="button" class="basket__close" data-basket-close data-i18n="shop.close"></button>' +
      '</header>' +
      '<p class="basket__sim" data-i18n="shop.simNote"></p>' +
      '<ul class="basket__lines" data-basket-lines></ul>' +
      '<p class="basket__empty" data-basket-empty data-i18n="shop.empty"></p>' +
      '<footer class="basket__foot">' +
        '<p class="basket__total"><span class="label" data-i18n="shop.subtotal"></span><span data-basket-total></span></p>' +
        '<label class="basket__gift"><input type="checkbox" data-gift> <span data-i18n="shop.giftCheck"></span></label>' +
        '<label class="basket__message" data-gift-box hidden><span class="label" data-i18n="shop.giftLabel"></span>' +
          '<textarea data-gift-text maxlength="200" rows="3"></textarea><span class="basket__note" data-i18n="shop.giftHint"></span></label>' +
        '<p class="basket__note" data-i18n="shop.note"></p>' +
        '<a class="btn btn--primary basket__checkout" data-basket-checkout data-i18n="shop.checkout"></a>' +
        '<p class="basket__note" data-i18n="shop.demoNote"></p>' +
      '</footer>';

    panel.addEventListener("change", function (event) {
      if (event.target.hasAttribute("data-gift")) panel.querySelector("[data-gift-box]").hidden = !event.target.checked;
      render();
    });
    panel.addEventListener("input", function (event) {
      if (event.target.hasAttribute("data-gift-text")) render();
    });

    panel.addEventListener("click", function (event) {
      var button = event.target.closest("button");
      if (!button) return;
      if (button.hasAttribute("data-basket-close")) return close();
      var index = Number(button.getAttribute("data-line"));
      var step = button.getAttribute("data-step");
      if (step === "remove") setQuantity(index, 0);
      else if (step) setQuantity(index, (basket[index] || 0) + Number(step));
    });

    // The basket button in the header (shown in the two basket modes).
    opener = document.createElement("button");
    opener.type = "button";
    opener.className = "basket-open";
    opener.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 8h14l-1.2 12H6.2zM9 8V6.5a3 3 0 0 1 6 0V8"/></svg>' +
      '<span class="basket-open__count" data-basket-count></span>';
    opener.addEventListener("click", open);
    var header = document.querySelector(".site-header");
    if (header) header.appendChild(opener);

    document.body.appendChild(scrim);
    document.body.appendChild(panel);
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !panel.hidden) close();
    });
  }

  function render() {
    if (!panel) return;
    var list = panel.querySelector("[data-basket-lines]");
    var all = lines();
    var total = 0;
    list.textContent = "";

    all.forEach(function (line) {
      var cuvee = CUVEES[line.index];
      total += (cuvee.price || 0) * line.quantity;
      var item = document.createElement("li");
      item.className = "basket__line";
      item.innerHTML =
        '<p class="basket__name"></p>' +
        '<div class="basket__qty">' +
          '<button type="button" data-step="-1" data-line="' + line.index + '">−</button>' +
          '<span class="basket__n">' + line.quantity + '</span>' +
          '<button type="button" data-step="1" data-line="' + line.index + '">+</button>' +
        '</div>' +
        '<p class="basket__price">' + money((cuvee.price || 0) * line.quantity) + '</p>' +
        '<button type="button" class="basket__remove" data-step="remove" data-line="' + line.index + '"></button>';
      item.querySelector(".basket__name").textContent = t("cuvees." + line.index + ".name");
      var buttons = item.querySelectorAll("button");
      buttons[0].setAttribute("aria-label", t("shop.less"));
      buttons[1].setAttribute("aria-label", t("shop.more"));
      buttons[2].textContent = t("shop.remove");
      list.appendChild(item);
    });

    panel.querySelector("[data-basket-empty]").hidden = all.length > 0;
    panel.querySelector(".basket__foot").hidden = all.length === 0;
    panel.querySelector("[data-basket-total]").textContent = money(total);
    var checkout = panel.querySelector("[data-basket-checkout]");
    if (all.length) checkout.href = checkoutUrl(all) + giftQuery();
    else checkout.removeAttribute("href");

    var n = count();
    opener.querySelector("[data-basket-count]").textContent = n ? String(n) : "";
    opener.setAttribute("aria-label", t("shop.basket") + (n ? " (" + n + ")" : ""));
    panel.classList.toggle("basket--shopify", mode() === "embed");
  }

  // Gift: Shopify carries a note and attributes from the link to the order.
  // TO CHECK with the real store that its checkout keeps them.
  function giftQuery() {
    if (!panel || !panel.querySelector("[data-gift]").checked) return "";
    var message = panel.querySelector("[data-gift-text]").value.trim().slice(0, 200);
    return "?attributes[gift]=yes" + (message ? "&note=" + encodeURIComponent(message) : "");
  }

  function open() {
    if (!panel || !usesBasket()) return;
    returnFocus = document.activeElement;
    render();
    scrim.hidden = false;
    panel.hidden = false;
    root.classList.add("has-basket-open");
    panel.querySelector("[data-basket-close]").focus();
  }

  function close() {
    if (!panel || panel.hidden) return;
    scrim.hidden = true;
    panel.hidden = true;
    root.classList.remove("has-basket-open");
    if (returnFocus && returnFocus.focus) returnFocus.focus();
  }

  function add(index) {
    var cuvee = CUVEES[index];
    if (!cuvee || cuvee.soon) return;
    setQuantity(index, (basket[index] || 0) + 1);
    open();
  }

  /* ---- Wiring ------------------------------------------------------------------------ */

  // In the two basket modes an order button adds to the basket instead of leaving the page.
  // (Its href still points to the checkout, so it works even if this script does not run.)
  document.addEventListener("click", function (event) {
    if (!usesBasket() || event.button || event.metaKey || event.ctrlKey || event.shiftKey) return;
    var link = event.target.closest && event.target.closest("[data-shop-cuvee]");
    if (!link || !link.hasAttribute("href")) return;
    event.preventDefault();
    add(Number(link.getAttribute("data-shop-cuvee")));
  });

  document.addEventListener("shop:change", function () {
    rewire();
    if (!usesBasket()) close();
    render();
  });
  document.addEventListener("i18n:change", function () {
    if (panel) window.I18n.apply(panel);
    render();
  });

  if (document.body) build();
  else document.addEventListener("DOMContentLoaded", build);

  window.Shop = { wire: wire, mode: mode, modes: MODES, add: add, open: open, close: close, checkoutUrl: checkoutUrl };
})();
