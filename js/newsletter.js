/*
 * newsletter.js — the "release letter" sign-up form in the footer.
 *
 * Checks the address and the consent box, then:
 *   - with NEWSLETTER_ACTION set in config.js, sends the form there
 *     (for example a Shopify customer form or a mailing service);
 *   - without it (prototype), sends nothing and thanks the visitor.
 * Messages come from the i18n files ("newsletter").
 */
(function () {
  "use strict";

  var CONFIG = window.SITE_CONFIG || {};

  function t(key) {
    return window.I18n && window.I18n.lang ? window.I18n.t(key) : "";
  }

  document.addEventListener("submit", function (event) {
    var form = event.target.closest && event.target.closest("[data-newsletter]");
    if (!form) return;
    var email = form.querySelector('input[type="email"]');
    var agree = form.querySelector('input[type="checkbox"]');
    var status = form.querySelector("[data-newsletter-status]");

    form.classList.remove("is-error", "is-done");
    if (!email.value.trim() || !email.checkValidity()) {
      event.preventDefault();
      status.textContent = t("newsletter.invalid");
      form.classList.add("is-error");
      email.focus();
      return;
    }
    if (!agree.checked) {
      event.preventDefault();
      status.textContent = t("newsletter.consentMissing");
      form.classList.add("is-error");
      agree.focus();
      return;
    }
    if (CONFIG.NEWSLETTER_ACTION) {
      form.action = CONFIG.NEWSLETTER_ACTION;
      form.method = "post";
      return; // the browser sends it
    }
    event.preventDefault();
    status.textContent = t("newsletter.thanks");
    form.classList.add("is-done");
    form.reset();
  });
})();
