class CartCoupon extends HTMLElement {
  constructor() {
    super();

    this.button = this.querySelector("button");
    this.input = this.querySelector("input");
    this.status = this.querySelector(".cart-coupon-status");
    this.allowMultiple = this.dataset.multiple === "true";
    this.couponCodes = [];

    // Focus the coupon input when the minicart <details> opens
    this.details = this.querySelector(".mini-cart-coupon-dropdown");
    if (this.details) {
      this.details.addEventListener("toggle", () => {
        if (this.details.open) {
          requestAnimationFrame(() => {
            this.input?.focus();
            this.input?.select();
          });
        }
      });
    }

    this.getCartContents().then((response) => {
      this.couponCodes = this.getExistingCouponCodes(response);
    });

    this.button.addEventListener("click", this.submit.bind(this));
    this.input.addEventListener("keydown", this.submit.bind(this));
  }

  async submit(event) {
    if (event instanceof KeyboardEvent && event.key !== "Enter") {
      return;
    }

    event.preventDefault();

    this.hideStatusMessage();

    const couponsEntered = this.input.value
      .split(",")
      .map((coupon) => coupon.trim().toUpperCase())
      .filter((coupon) => coupon && coupon.length > 0);

    // Only grab the first coupon entered.
    const coupon = couponsEntered.shift();

    if (!coupon) {
      // Enable these lines and disable the return below to allow clearing all coupons, by simply submitting an empty code.
      // this.couponCodes = [];
      // this.setStatusMessage("Coupons cleared!", true);

      return false;
    }

    const alreadyApplied = (couponCode) =>
      this.couponCodes.reduce((applied, discount) => {
        return applied || discount.code.toUpperCase() === couponCode;
      }, false);

    const couponAppliesToCart = (couponCode) =>
      this.couponCodes.reduce((applied, discount) => {
        return (
          applied || (discount.code.toUpperCase() === couponCode && discount.applicable === true)
        );
      }, false);

    if (coupon && alreadyApplied(coupon)) {
      this.setStatusMessage(cartStrings.couponAlreadyApplied, true);
      return false;
    }

    if (!this.allowMultiple) {
      this.couponCodes = [];
    }

    const newCouponCodes = [coupon, ...this.couponCodes.map((discount) => discount.code)];
    this.setLoading();

    fetch(routes.cart_update_url, {
      ...fetchConfig(),
      ...{
        body: JSON.stringify({
          discount: newCouponCodes.join(","),
          sections: this.getSectionsToRender().map((section) => section.section),
        }),
      },
    })
      .then((response) => response.json())
      .then((response) => {
        this.couponCodes = this.getExistingCouponCodes(response);

        if (coupon) {
          if (couponAppliesToCart(coupon)) {
            this.setStatusMessage(cartStrings.couponSuccess, true);
            this.input.value = "";
          } else {
            this.setStatusMessage(cartStrings.couponNotApplicable, false);
          }
        }

        this.getSectionsToRender().forEach((section) => {
          const elementToReplace =
            document.getElementById(section.id).querySelector(section.selector) ||
            document.getElementById(section.id);

          if (section.id === "header-mini-cart-footer") {
            const coupon = elementToReplace.querySelector(".minicart-coupon").cloneNode(true);

            // Remove loading state
            const clonedButton = coupon.querySelector("button");
            if (clonedButton) {
              clonedButton.classList.remove("loading");
              const clonedSpinner = coupon.querySelector(".button-overlay-spinner");
              if (clonedSpinner) {
                clonedSpinner.classList.add("hidden");
              }
            }

            elementToReplace.innerHTML = this.getSectionInnerHTML(
              response.sections[section.section],
              section.selector,
            );

            elementToReplace.querySelector(".minicart-coupon").outerHTML = coupon.outerHTML;
          } else {
            elementToReplace.innerHTML = this.getSectionInnerHTML(
              response.sections[section.section],
              section.selector,
            );
          }
        });
      })
      .catch((error) => {
        console.error("Fetch error:", error);
        this.setStatusMessage(cartStrings.couponError, false);
      })
      .finally(() => {
        this.removeLoading();
      });
  }

  async getCartContents() {
    let json = {};

    try {
      const response = await fetch(routes.cart_url, {
        method: "GET",
        headers: { "Content-Type": "application/json", Accept: `application/json` },
      });

      json = await response.json();
    } catch (error) {
      console.error("Error:", error);
    }

    return json;
  }

  getSectionInnerHTML(html, selector = ".shopify-section") {
    return new DOMParser().parseFromString(html, "text/html").querySelector(selector).innerHTML;
  }

  getSectionsToRender() {
    return [
      {
        id: "cart-page-title-wrap",
        section: document.getElementById("cart-page-title-wrap")?.dataset.id,
        selector: ".page-title-wrap",
      },
      {
        id: "main-cart-items",
        section: document.getElementById("main-cart-items")?.dataset.id,
        selector: ".js-contents",
      },
      {
        id: "header",
        section: document.getElementById("header").dataset.id,
        selector: ".head-slot-cart-link",
      },
      {
        id: "cart-live-region-text",
        section: "cart-live-region-text",
        selector: ".shopify-section",
      },
      {
        id: "main-cart-footer",
        section: document.getElementById("main-cart-footer")?.dataset.id,
        selector: ".js-contents",
      },
      {
        id: "header-mini-cart-content",
        section: "header-mini-cart-content",
      },
      {
        id: "header-mini-cart-footer",
        section: "header-mini-cart-footer",
      },
      {
        id: "mobile-dock",
        section: document.getElementById("mobile-dock")?.dataset.id,
        selector: ".head-slot-cart-link",
      },
    ].filter((section) => {
      const element = document.getElementById(section.id);
      return element && (section.selector ? element.querySelector(section.selector) : true);
    });
  }

  getExistingCouponCodes(response) {
    return response?.discount_codes ?? [];
  }

  hideStatusMessage() {
    this.status.classList.add("hidden");
    this.status.classList.remove(...["form-status-success", "form-status-error"]);
    this.status.innerHTML = "";
  }

  setStatusMessage(message, success = false) {
    this.status.classList.remove(...["hidden", "form-status-success", "form-status-error"]);
    this.status.classList.add(success ? "form-status-success" : "form-status-error");
    this.status.innerHTML = message;
  }

  setLoading() {
    this.button.classList.add("loading");
    this.button.querySelector(".button-overlay-spinner")?.classList.remove("hidden");
  }

  removeLoading() {
    this.button.classList.remove("loading");
    this.button.querySelector(".button-overlay-spinner")?.classList.add("hidden");
  }
}
customElements.define("cart-coupon", CartCoupon);
