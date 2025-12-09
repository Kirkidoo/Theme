"use strict";

// Helpers
//
const isTouchDevice = () => {
  return "ontouchstart" in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;
};

// Main Menu
//
if (isTouchDevice()) {
  const subMenuNavs = document.querySelectorAll(".has-sub-menu > a");
  subMenuNavs.forEach((mainMenuNav) => {
    mainMenuNav.addEventListener("click", (event) => {
      if (!isTouchDevice()) {
        return;
      }

      subMenuNavs.forEach((item) => {
        if (item === mainMenuNav) {
          return;
        }

        item.classList.remove("is-dropdown-open");
      });

      if (mainMenuNav.classList.contains("is-dropdown-open")) {
        return;
      }

      event.preventDefault();
      mainMenuNav.classList.add("is-dropdown-open");
    });
  });
}

class DropdownModal extends HTMLElement {
  constructor() {
    super();

    this.eventPrefix = this.dataset.eventPrefix;
    this.toggles = this.querySelectorAll(".dropdown-modal-toggle");
    this.content = this.querySelector(".dropdown-modal-toggle + div");
    this.preventOpen = this.getAttribute("prevent-open") === "true";

    if (this.preventOpen) {
      return;
    }

    this.addEventListener("keyup", (event) => {
      if (event.code.toUpperCase() === "ESCAPE") {
        this.close();
      }
    });
    this.toggles.forEach((toggle) => {
      toggle.addEventListener("click", this.handleToggle.bind(this));
    });
  }

  isOpen() {
    return this.getAttribute("open") === "true";
  }

  handleToggle(event) {
    event?.preventDefault?.();

    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  open(opener) {
    this.openedBy = opener;
    this.setAttribute("open", true);
    this.toggles.forEach((toggle) => {
      toggle.setAttribute("aria-expanded", true);
    });
    trapFocus(this);

    if (this.eventPrefix) {
      publish(`${this.eventPrefix}:open`);
    }

    document.querySelectorAll("localization-form")?.forEach?.((localizationForm) => {
      localizationForm?.hidePanel?.();
    });
  }

  close() {
    this.toggles.forEach((toggle) => {
      toggle.setAttribute("aria-expanded", false);
    });
    this.removeAttribute("open");

    if (this.openedBy) {
      removeTrapFocus(this.openedBy);
    }

    if (this.eventPrefix) {
      publish(`${this.eventPrefix}:close`);
    }
  }
}

customElements.define("dropdown-modal", DropdownModal);

class HeaderSearchDropdownModal extends DropdownModal {
  constructor() {
    super();
    this.searchInput = this.querySelector('input[type="search"]');
  }

  open(opener) {
    super.open(opener);
    trapFocus(this, this.searchInput);
  }
}

customElements.define("header-search-dropdown-modal", HeaderSearchDropdownModal);

// Menu classes based on available free space
//
const navigations = document.querySelectorAll(".navigation-menu");

navigations.forEach((navigation) => {
  const navigationMenusTopNavs = navigation.querySelectorAll(":scope > .has-sub-menu");

  const getMenuWidth = (element, initialWidth = 0) => {
    const submenu = element && element.querySelector(".navigation-sub-menu");

    if (!submenu) {
      return initialWidth;
    }

    return getMenuWidth(submenu, initialWidth + submenu.clientWidth);
  };

  const setMenuClasses = () => {
    const windowWidth = window.innerWidth;
    navigationMenusTopNavs.forEach((navigationMenusTopNav) => {
      if (navigationMenusTopNav.classList.contains("navigation-item-static")) {
        return;
      }

      navigationMenusTopNav.classList.remove("nav-open-left");
      const width = getMenuWidth(navigationMenusTopNav);

      if (navigationMenusTopNav.offsetLeft + width > windowWidth) {
        navigationMenusTopNav.classList.add("nav-open-left");
      }
    });
  };

  setMenuClasses();

  let resizeTimer;

  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      setMenuClasses();
    }, 350);
  });
});

// Mobile menu
//
const mobileMenuWrap = document.querySelector(".head-slot-nav-mobile-link-wrapper");
const mobileNavWrap = document.querySelector(".navigation-mobile-wrap");
const mobileMenuToggle = document.querySelector(".head-slot-nav-mobile-link");
const mobileMenu = document.querySelector(".mobile-menu");
const expandOnButton = mobileMenu?.dataset.buttonExpand != null;

const setMobileMenuMaxheight = () => {
  mobileMenu.style.maxHeight = `${
    window.innerHeight - document.querySelector(".header").getBoundingClientRect().bottom + 70
  }px`;
};

const handleMobileMenuOpen = () => {
  // Header must always be visible when the menu is open.
  // Manually show it for cases where we reveal the menu from outside the header.
  const stickyHeader = document.querySelector("sticky-header");
  if (stickyHeader) {
    stickyHeader.reveal();
  }

  document.body.classList.add("mobile-menu-open");
  mobileMenuToggle.ariaExpanded = "true";
  mobileMenu.ariaHidden = "false";
  trapFocus(mobileMenuWrap, mobileNavWrap);

  setMobileMenuMaxheight();

  const event = new CustomEvent("mobile-menu:open");
  document.dispatchEvent(event);
};

const handleMobileMenuDismiss = () => {
  document.body.classList.remove("mobile-menu-open");
  mobileMenuToggle.ariaExpanded = "false";
  mobileMenu.ariaHidden = "true";
  removeTrapFocus(mobileMenuToggle);
  mobileMenu.style.maxHeight = "";

  const event = new CustomEvent("mobile-menu:close");
  document.dispatchEvent(event);
};

const isMobileMenuOpen = () => {
  return document.body.classList.contains("mobile-menu-open");
};

document.body.addEventListener("click", (event) => {
  const { target } = event;
  const mobileNav = target.closest(".navigation-mobile-item");
  const isMobileNavButton =
    target.classList.contains("head-slot-nav-mobile-link") ||
    !!target.closest(".head-slot-nav-mobile-link");
  const isMainNav = !!target.closest(".navigation-main");
  const isAnchorLink = target.tagName === "A" && /^#[\w-]+/.test(target.getAttribute("href"));

  // Handle mobile menu item expand
  if (mobileNav && mobileNav.querySelector("ul")) {
    if (expandOnButton) {
      if (target.closest(".navigation-mobile-item-link-expand")) {
        mobileNav.classList.toggle("menu-item-expanded");
      }
    } else {
      event.preventDefault();
      mobileNav.classList.toggle("menu-item-expanded");
    }
  }

  // Handle mobile menu show / hide
  if (isMobileNavButton && document.body.classList.contains("mobile-menu-open")) {
    handleMobileMenuDismiss();
    return;
  }

  if (isMobileNavButton) {
    handleMobileMenuOpen();
    return;
  }

  if (isAnchorLink) {
    handleMobileMenuDismiss();
  }

  if (isMobileMenuOpen() && !target.closest(".mobile-menu")) {
    event.preventDefault();
    handleMobileMenuDismiss();
  }

  if (isMainNav && isAnchorLink) {
    target.closest(".navigation-main").classList.add("menus-closed");
    setTimeout(() => {
      target.closest(".navigation-main").classList.remove("menus-closed");
    }, 100);
  }
});

// Sidebar drawer button toggle
//
const sidebarDrawerButton = document.querySelector(".button-sidebar-drawer-open");
const sidebarDrawer = document.querySelector(".page-layout-sidebar");

const handleSidebarOpen = () => {
  document.body.classList.add("page-layout-sidebar-drawer-open");
  document.body.classList.add("overflow-hidden-tablet");
  trapFocus(sidebarDrawer, sidebarDrawer.querySelector(".page-layout-sidebar-drawer-header"));
};

const handleSidebarDismiss = () => {
  document.body.classList.remove("page-layout-sidebar-drawer-open");
  document.body.classList.remove("overflow-hidden-tablet");
  removeTrapFocus(sidebarDrawerButton);
};

const isSidebarOpen = () => {
  return document.body.classList.contains("page-layout-sidebar-drawer-open");
};

if (sidebarDrawerButton && sidebarDrawer) {
  document.body.addEventListener("click", (event) => {
    const { target } = event;

    if (target.classList.contains("js-button-sidebar-drawer-dismiss")) {
      handleSidebarDismiss();
      return;
    }

    if (target.classList.contains("button-sidebar-drawer-open")) {
      handleSidebarOpen();
      return;
    }

    if (isSidebarOpen() && !target.closest(".page-layout-sidebar")) {
      handleSidebarDismiss();
      event.preventDefault();
    }
  });

  sidebarDrawer.addEventListener("keyup", (event) => {
    if (event.code.toUpperCase() === "ESCAPE") {
      handleSidebarDismiss();
    }
  });
}

document.addEventListener("change", (event) => {
  if (event.target.parentNode?.classList.contains("select-custom")) {
    const select = event.target;
    const label = select.parentNode.querySelector("label");
    label.textContent = select.options[select.selectedIndex].text;
  }
});

// Review links / scroll
//
(() => {
  // Shopify app review link
  const reviewsLink = document.querySelectorAll('a[href*="#product-reviews"]');
  const reviews = document.getElementById("product-reviews");

  if (reviewsLink && reviews) {
    reviewsLink.forEach((link) => {
      link.addEventListener("click", () => {
        reviews.expand();
      });
    });
  }

  if (window.location.hash === "#product-reviews" && reviews) {
    setTimeout(() => {
      reviews.expand();
    }, 0);

    setTimeout(() => {
      reviews.scrollIntoView();
    }, 200);
  }
})();

(() => {
  // App review links
  const appReviewLinks = document.querySelectorAll(".star-rating-badge");
  const reviews = document.getElementById("product-reviews");

  if (appReviewLinks.length > 0 && reviews) {
    appReviewLinks.forEach((link) => {
      if (link.classList.contains("star-rating-link")) {
        return;
      }

      link.addEventListener("click", () => {
        reviews.expand();
      });
    });
  }

  if (appReviewLinks.length > 0 && !reviews) {
    appReviewLinks.forEach((link) => {
      if (link.classList.contains("star-rating-link")) {
        return;
      }

      const parentCard = link.closest(".card-product");

      if (parentCard) {
        const href = parentCard.querySelector(".card-heading > a")?.getAttribute("href");
        link.addEventListener("click", () => {
          window.location = `${href}#product-reviews`;
        });
      }
    });
  }
})();

// Collapsible / Expandable
//
class CollapsibleExpandable extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    this.collapsed = this.getAttribute("expanded") === "false";
    this.toggleElement = this.querySelector(".facet-toggle");

    this.onToggle = this.onToggle.bind(this);
    this.toggleElement.addEventListener("click", this.onToggle);

    // Expandable list
    this.list = this.querySelector(".facet-options-list");
    this.listCollapsed = this.list && this.list.getAttribute("aria-expanded") === "false";
    this.expandListToggle = this.querySelector(".facet-button-more");

    this.onListToggle = this.onListToggle.bind(this);

    if (this.expandListToggle) {
      this.expandListToggle.addEventListener("click", this.onListToggle);
    }

    this.shouldCollapseOthers = this.dataset.collapseOthers === "true";
  }

  disconnectedCallback() {
    this.toggleElement.removeEventListener("click", this.onToggle);

    if (this.expandListToggle) {
      this.expandListToggle.removeEventListener("click", this.onListToggle());
    }
  }

  onToggle(event) {
    event.preventDefault();
    this.handleToggle();
  }

  collapse() {
    this.setAttribute("expanded", "false");
    this.toggleElement.setAttribute("aria-expanded", "false");
    this.collapsed = true;
  }

  expand() {
    this.setAttribute("expanded", "true");
    this.toggleElement.setAttribute("aria-expanded", "true");
    this.collapsed = false;
  }

  collapseOthers() {
    for (const child of this.parentElement.children) {
      if (child === this) {
        continue;
      }
      if (child.tagName === "COLLAPSIBLE-EXPANDABLE") {
        child.collapse();
      }
    }

    const rect = this.getBoundingClientRect();
    const stickyHeader = document.querySelector(".section-header-sticky");
    const headerOffset = stickyHeader ? stickyHeader.offsetHeight : 0;
    const isInView = rect.top >= headerOffset && rect.top <= window.innerHeight;

    if (!isInView) {
      const scrollTop = window.scrollY + rect.top - headerOffset;
      window.scrollTo({
        top: scrollTop,
        behavior: "smooth",
      });
    }
  }

  handleToggle() {
    if (this.collapsed) {
      this.expand();
      this.shouldCollapseOthers && this.collapseOthers();
    } else {
      this.collapse();
    }
  }

  onListToggle(event) {
    if (event) {
      event.preventDefault();
    }
    this.handleToggleList();
  }

  collapseList() {
    this.list.setAttribute("aria-expanded", "false");
    this.expandListToggle.innerHTML = "&plus; " + window.productsStrings.facetsShowMore;
    this.listCollapsed = true;
  }

  expandList() {
    this.list.setAttribute("aria-expanded", "true");
    this.expandListToggle.innerHTML = "&minus; " + window.productsStrings.facetsShowLess;
    this.listCollapsed = false;
  }

  handleToggleList() {
    if (this.listCollapsed) {
      this.expandList();
    } else {
      this.collapseList();
    }
  }
}

customElements.define("collapsible-expandable", CollapsibleExpandable);

// Generic Modal Dialog
//
class ModalDialog extends HTMLElement {
  constructor() {
    super();
    this.querySelector('[id^="ModalClose-"]')?.addEventListener("click", this.hide.bind(this));

    this.addEventListener("keyup", (event) => {
      if (event.code.toUpperCase() === "ESCAPE") {
        this.hide();
      }
    });
    if (this.classList.contains("media-modal")) {
      this.addEventListener("pointerup", (event) => {
        if (
          event.pointerType === "mouse" &&
          !event.target.closest("deferred-media, product-model")
        ) {
          this.hide();
        }
      });
    } else {
      this.addEventListener("click", (event) => {
        if (event.target.nodeName === "MODAL-DIALOG") {
          this.hide();
        }
      });
    }
  }

  connectedCallback() {
    if (this.moved || Shopify.designMode) {
      return;
    }

    this.moved = true;
    document.body.appendChild(this);
  }

  show(opener) {
    this.openedBy = opener;
    document.body.classList.add("overflow-hidden");
    this.setAttribute("open", "");
    trapFocus(this, this.querySelector('[role="dialog"]'));
    window.pauseAllMedia();
  }

  hide() {
    document.body.classList.remove("overflow-hidden");
    this.removeAttribute("open");
    if (this.openedBy) {
      removeTrapFocus(this.openedBy);
    }
    window.pauseAllMedia();
  }
}

customElements.define("modal-dialog", ModalDialog);

// Global modal opener
//
class ModalOpener extends HTMLElement {
  constructor() {
    super();

    const button = this.querySelector("button");

    if (!button) {
      return;
    }

    button.addEventListener("click", () => {
      const modal = document.querySelector(this.getAttribute("data-modal"));
      if (modal) {
        modal.show(button);
      }
    });
  }
}

customElements.define("modal-opener", ModalOpener);

class HTMLUpdateUtility {
  #preProcessCallbacks = [];
  #postProcessCallbacks = [];

  constructor() {}

  addPreProcessCallback(callback) {
    this.#preProcessCallbacks.push(callback);
  }

  addPostProcessCallback(callback) {
    this.#postProcessCallbacks.push(callback);
  }

  /**
   * Used to swap an HTML node with a new node.
   * The new node is inserted as a previous sibling to the old node, the old node is hidden, and then the old node is removed.
   *
   * The function currently uses a double buffer approach, but this should be replaced by a view transition once it is more widely supported https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API
   */
  viewTransition(oldNode, newContent) {
    this.#preProcessCallbacks.forEach((callback) => callback(newContent));

    const newNodeWrapper = document.createElement("div");
    HTMLUpdateUtility.setInnerHTML(newNodeWrapper, newContent.outerHTML);
    const newNode = newNodeWrapper.firstChild;
    oldNode.parentNode.insertBefore(newNode, oldNode);
    oldNode.style.display = "none";

    // dedupe IDs
    const uniqueKey = Date.now();
    oldNode.querySelectorAll("[id], [form]").forEach((element) => {
      element.id && (element.id = `${element.id}-${uniqueKey}`);
      element.form &&
        element.setAttribute("form", `${element.form.getAttribute("id")}-${uniqueKey}`);
    });

    this.#postProcessCallbacks.forEach((callback) => callback(newNode));

    setTimeout(() => oldNode.remove(), 500);
  }

  // Sets inner HTML and reinjects the script tags to allow execution. By default, scripts are disabled when using element.innerHTML.
  static setInnerHTML(element, html) {
    element.innerHTML = html;
    element.querySelectorAll("script").forEach((oldScriptTag) => {
      const newScriptTag = document.createElement("script");
      Array.from(oldScriptTag.attributes).forEach((attribute) => {
        newScriptTag.setAttribute(attribute.name, attribute.value);
      });
      newScriptTag.appendChild(document.createTextNode(oldScriptTag.innerHTML));
      oldScriptTag.parentNode.replaceChild(newScriptTag, oldScriptTag);
    });
  }
}

// Variations
//
class VariantSelects extends HTMLElement {
  constructor() {
    super();

    this.initializeProductSwapUtility();

    this.addEventListener("change", this.handleProductUpdate);

    this.sectionId = this.dataset.section;
    this.hideOutOfStock = this.dataset.variantsVisibility === "hide";
    this.hideSingle = this.dataset.hideSingle === "true";
    this.optionsWithValues = JSON.parse(
      this.querySelector('[type="application/json"][data-id="product-options-with-values"]')
        .textContent,
    );
    this.variants = JSON.parse(
      this.querySelector('[type="application/json"][data-id="product-variants"]')?.textContent ??
        null,
    );

    this.updateVisibility();
  }

  initializeProductSwapUtility() {
    this.swapProductUtility = new HTMLUpdateUtility();
    this.swapProductUtility.addPostProcessCallback((newNode) => {
      window?.Shopify?.PaymentButton?.init();
      window?.ProductModel?.loadShopifyXR();
      publish(PUB_SUB_EVENTS.sectionRefreshed, {
        data: {
          sectionId: this.sectionId,
          resource: {
            type: "product",
            id: newNode.querySelector("variant-selects, variant-radios").dataset.productId,
          },
        },
      });
    });
  }

  handleProductUpdate(event) {
    const input = this.getInputForEventTarget(event.target);
    const targetId = input.id;
    const targetUrl = input.dataset.productUrl || this.dataset.url;
    const sectionId = this.sectionId;

    this.currentVariant = this.getVariantData(targetId);
    this.currentVariant = this.maybeGetFirstAvailableVariant(this.currentVariant, input);

    this.hideVariants = this.dataset.hideVariants === "true";

    let productUrl = this.getProductInfoUrl(targetUrl, this.currentVariant?.id);

    // Short circuit the rendering logic
    // when we are in the quick view drawer
    const quickViewDrawer = this.closest("quick-view-drawer");
    if (quickViewDrawer) {
      this.handleQuickviewUpdate(productUrl, targetId);
      return;
    }

    this.toggleAddButton(true, "");

    let callback = () => {};

    if (this.dataset.url !== targetUrl || (this.hideVariants && this.currentVariant)) {
      // Combined listing - Different product (or hide variants is enabled)
      this.updateURL(targetUrl);
      this.updateShareUrl(targetUrl);
      callback = this.handleSwapProduct(sectionId);

      // Make sure we fetch only the section if we're in a featured product
      const shouldFetchFullPage = this.dataset.updateUrl === "true";
      productUrl = this.getProductInfoUrl(targetUrl, this.currentVariant?.id, shouldFetchFullPage);
    } else if (!this.currentVariant) {
      // Variant does not exist.
      this.setUnavailable();
      callback = (html) => {
        this.updatePickupAvailability();
        this.updateOptionValues(html);
      };
    } else {
      // Product variant.
      this.updateMedia();
      this.updateURL(targetUrl);
      this.updateShareUrl(targetUrl);
      this.updateVariantInput();
      callback = this.handleUpdateProductInfo(sectionId).bind(this);
    }

    this.renderProductInfo(productUrl, targetId, callback);
  }

  maybeGetFirstAvailableVariant(currentVariant, inputClicked) {
    /* Handle case where immediate selection of the first available variant is required.
     * hideOutOfStock needs to be enabled and the following line is required under (inside) <variant-selects> and <variant-radios>
     * in snippets/product-variant-picker.liquid:
     *
     * <script type="application/json" data-id="product-variants">{{ product.variants | json }}</script>
     */
    let newVariant = currentVariant;

    if (this.variants && this.hideOutOfStock && (!currentVariant || !currentVariant.available)) {
      const selectedOptionPosition =
        inputClicked.closest("fieldset, select").dataset.optionPosition;

      const selectedOptions = Array.from(
        this.querySelectorAll("fieldset input:checked, select option:checked"),
      ).reduce((acc, element) => {
        acc.push(element.value);
        return acc;
      }, []);
      const firstAvailableVariant = this.variants.find((variant, index) => {
        // Subset the arrays up to the selected option's index, so that the next available variant
        // has common values with all options above (and including) the clicked one.
        // Note: selectedOptionPosition is 1-based but slice() does not include the last element, so no arithmetic is needed.
        const variantSlice = variant.options.slice(0, selectedOptionPosition).toString(),
          selectedSlice = selectedOptions.slice(0, selectedOptionPosition).toString();

        return variant.available && variantSlice === selectedSlice;
      });

      if (firstAvailableVariant) {
        newVariant = firstAvailableVariant;
      }
    }

    return newVariant;
  }

  getInputForEventTarget(target) {
    return target.tagName === "SELECT" ? target.selectedOptions[0] : target;
  }

  getWrappingSection(sectionId) {
    return (
      this.closest(`#shopify-section-${sectionId}`) || // should match both main-product and featured-product
      null
    );
  }

  handleSwapProduct(sectionId) {
    return (html) => {
      const oldContent = this.getWrappingSection(sectionId);
      if (!oldContent) {
        return;
      }

      document.getElementById(`ProductModal-${sectionId}`)?.remove();

      const response = html.getElementById(`shopify-section-${sectionId}`);

      if (this.dataset.updateUrl === "true") {
        this.swapProductUtility.viewTransition(
          document.querySelector("main"),
          html.querySelector("main"),
        );
        document.querySelector("head title").innerHTML = html.querySelector("head title").innerHTML;
      } else {
        this.swapProductUtility.viewTransition(oldContent, response);
      }
    };
  }

  /**
   * Handles updating a variant in the Quickview drawer.
   */
  handleQuickviewUpdate(productUrl, targetId) {
    const quickViewDrawer = this.closest("quick-view-drawer");
    const productForm = quickViewDrawer.querySelector("product-form form");

    if (productForm) {
      productForm.style.opacity = "0.7";
    }

    this.renderProductInfo(productUrl, targetId, (html) => {
      quickViewDrawer.renderProduct(html, this.currentVariant);
    });
  }

  updateMedia() {
    const mediaGallery = document.getElementById(`MediaGallery-${this.dataset.section}`);

    if (!this.currentVariant || !this.currentVariant.featured_media) {
      return;
    }

    if (mediaGallery?.setActiveMedia) {
      mediaGallery.setActiveMedia(
        this.currentVariant.featured_media.id,
        mediaGallery.getAttribute("hide-variants") === "true",
      );
    }
  }

  updateURL(url) {
    if (!this.currentVariant || this.dataset.updateUrl === "false") {
      return;
    }
    window.history.replaceState(
      {},
      "",
      `${url}${this.currentVariant?.id ? `?variant=${this.currentVariant.id}` : ""}`,
    );
  }

  updateShareUrl(url) {
    const shareButtons = document.querySelectorAll(
      `Product-${this.dataset.section} .list-social-item a`,
    );
    if (!shareButtons) {
      return;
    }
    shareButtons.forEach((button) => {
      const fullUrl = `${window.shopUrl}${url}${
        this.currentVariant?.id ? `?variant=${this.currentVariant.id}` : ""
      }`;
      button.href = `${button.dataset.shareUrl}${encodeURIComponent(fullUrl)}`;
    });
  }

  updateVariantInput() {
    const productForms = document.querySelectorAll(
      `#product-form-${this.dataset.section}, #product-form-installment`,
    );

    productForms.forEach((productForm) => {
      const input = productForm.querySelector('input[name="id"]');
      input.value = this.currentVariant.id;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  updatePickupAvailability() {
    const pickUpAvailability = document.querySelector("pickup-availability");

    if (!pickUpAvailability || !pickUpAvailability.fetchAvailability) {
      return;
    }

    if (this.currentVariant && this.currentVariant.available) {
      pickUpAvailability.fetchAvailability(this.currentVariant.id);
    } else {
      pickUpAvailability.removeAttribute("available");
      pickUpAvailability.innerHTML = "";
    }
  }

  updateVisibility() {
    // Check if there's only one variant *defined*, i.e. each attribute/option has only one possible value.
    const hasSingleVariant = Array.from(
      this.querySelectorAll("variant-radios fieldset, variant-selects select"),
    ).reduce((acc, fieldset) => {
      return acc && fieldset.querySelectorAll("input, option").length === 1;
    }, true);

    // Check if there's only one variant available for purchase, e.g. only one combination of attributes/options available for purchase due to undefined combinations or out of stock variants.
    const hasSingleVariantAvailable = Array.from(
      this.querySelectorAll("variant-radios fieldset, variant-selects select"),
    ).reduce((acc, fieldset) => {
      return acc && fieldset.querySelectorAll('[data-variant-available="true"]').length === 1;
    }, true);

    const parent = this.closest(".product-variants");

    if (
      this.hideSingle &&
      (hasSingleVariant || (this.hideOutOfStock && hasSingleVariantAvailable))
    ) {
      parent?.classList.add("hidden");
    } else {
      parent?.classList.add("variants-visible");
      parent?.classList.remove("variants-hidden");
    }
  }

  updateOptionValues(html) {
    const variantSelects = html.querySelector("variant-selects, variant-radios");
    if (variantSelects) {
      this.innerHTML = variantSelects.innerHTML;
    }
  }

  getProductInfoUrl(url, variantId, shouldFetchFullPage = false) {
    const params = [];

    if (!shouldFetchFullPage) {
      params.push(`section_id=${this.sectionId}`);
    }

    if (variantId) {
      params.push(`variant=${variantId}`);
    } else {
      const optionValues = this.getSelectedOptionValues();
      if (optionValues.length) {
        params.push(`option_values=${optionValues.join(",")}`);
      }
    }

    return `${url}?${params.join("&")}`;
  }

  renderProductInfo(productUrl, targetId, callback) {
    this.abortController?.abort();
    this.abortController = new AbortController();

    fetch(productUrl, {
      signal: this.abortController.signal,
    })
      .then((response) => response.text())
      .then((responseText) => {
        const html = new DOMParser().parseFromString(responseText, "text/html");
        callback(html);
      })
      .then(() => {
        // set focus to last clicked option value
        const target = document.getElementById(targetId);
        target?.focus();
        target?.tagName === "OPTION" ? (target.selected = true) : false;
      });
  }

  handleUpdateProductInfo(sectionId) {
    return (html) => {
      const priceId = `price-${sectionId}`;
      const stockBadgeId = `ProductAvailability-${sectionId}`;
      const priceDestination = document.getElementById(priceId);
      const priceSource = html.getElementById(priceId);
      const stockBadgeDestination = document.getElementById(stockBadgeId);
      const stockBadgeSource = html.getElementById(stockBadgeId);
      const productFormSource = html.getElementById(`product-form-${sectionId}`);
      const productFormDestination = document.getElementById(`product-form-${sectionId}`);
      const productStockBarSource = html.getElementById(`ProductStockBar-${sectionId}`);
      const productStockBarDestination = document.getElementById(`ProductStockBar-${sectionId}`);
      const productSignupSource = html.getElementById(`ProductSignup-${sectionId}`);
      const productSignupDestination = document.getElementById(`ProductSignup-${sectionId}`);
      const productCountdownSource = html.getElementById(`ProductCountdown-${sectionId}`);
      const productCountdownDestination = document.getElementById(`ProductCountdown-${sectionId}`);

      if (priceSource && priceDestination) {
        priceDestination.innerHTML = priceSource.innerHTML;
      }

      if (stockBadgeSource && stockBadgeDestination) {
        stockBadgeDestination.innerHTML = stockBadgeSource.innerHTML;
      }

      const price = document.getElementById(`price-${sectionId}`);
      const infoMetas = document.querySelectorAll(`.product-info-meta-${this.dataset.section}`);

      if (price) {
        price.classList.remove("visibility-hidden");
      }

      if (infoMetas.length > 0) {
        infoMetas.forEach((infoMeta) => {
          infoMeta.classList.remove("visibility-hidden");
        });
      }

      if (productFormSource && productFormDestination) {
        productFormDestination.outerHTML = productFormSource.outerHTML;
      }

      if (productStockBarSource && productStockBarDestination) {
        productStockBarDestination.innerHTML = productStockBarSource.innerHTML;
        productStockBarDestination.classList.remove("hidden");
      }

      if (productSignupSource && productSignupDestination) {
        productSignupDestination.outerHTML = productSignupSource.outerHTML;
      }

      if (productCountdownSource && productCountdownDestination) {
        productCountdownDestination.outerHTML = productCountdownSource.outerHTML;
      }

      const blockDestinations = document.querySelectorAll(
        `.product-block-content-${sectionId}.variant-changed-update`,
      );
      const blockSources = html.querySelectorAll(
        `.product-block-content-${sectionId}.variant-changed-update`,
      );

      blockDestinations.forEach((blockDestination, index) => {
        const blockSource = blockSources[index];
        if (blockSource) {
          blockDestination.outerHTML = blockSource.outerHTML;
        }
      });

      this.toggleAddButton(!this.currentVariant.available, window.variantStrings.outOfStock);
      this.setSku(this.currentVariant.sku);
      this.setBarcode(this.currentVariant.barcode);

      this.setProductInfo(html);
      this.updatePickupAvailability();
      this.updateOptionValues(html);

      const event = new CustomEvent("product:variant-change", {
        detail: {
          variant: this.currentVariant,
        },
      });
      document.dispatchEvent(event);

      publish(PUB_SUB_EVENTS.productVariantChange, {
        sectionId: sectionId,
        html,
        variant: this.currentVariant,
      });
    };
  }

  setSku(sku) {
    const skuFields = document.querySelectorAll(`.ProductSku-${this.dataset.section}`);

    if (!skuFields.length) {
      return;
    }

    if (!sku) {
      skuFields.forEach((field) => {
        field.parentNode.classList.add("visually-hidden");
      });
      return;
    }
    skuFields.forEach((field) => {
      field.parentNode.classList.remove("visually-hidden");
      field.textContent = sku;
    });
  }

  setBarcode(barcode) {
    const barcodeFields = document.querySelectorAll(`.ProductBarcode-${this.dataset.section}`);

    if (!barcodeFields.length) {
      return;
    }

    if (!barcode) {
      barcodeFields.forEach((field) => {
        field.parentNode.classList.add("visually-hidden");
      });
      return;
    }

    barcodeFields.forEach((field) => {
      field.parentNode.classList.remove("visually-hidden");
      field.textContent = barcode ?? "";
    });
  }

  setProductInfo(html) {
    const className = `#ProductPage-${this.sectionId} .product-info-details-list`;
    const destinations = document.querySelectorAll(className);
    const sources = html.querySelectorAll(className);

    if (destinations.length > 0) {
      destinations.forEach((destination, index) => {
        if (sources[index]) {
          destination.innerHTML = sources[index]?.innerHTML;
        }
      });
    }
  }

  toggleAddButton(disable = true) {
    const productForm = document.getElementById(`product-form-${this.dataset.section}`);
    if (!productForm) {
      return;
    }

    const addButton = productForm.querySelector('[name="add"]');

    if (!addButton) {
      return;
    }

    if (disable) {
      addButton.setAttribute("disabled", "disabled");
    } else {
      addButton.removeAttribute("disabled");
    }
  }

  setUnavailable() {
    const form = document.getElementById(`product-form-${this.dataset.section}`);
    const addButton = form?.querySelector('[name="add"]');
    const addButtonText = form?.querySelector('[name="add"] > span');
    const price = document.getElementById(`price-${this.dataset.section}`);
    const product = document.getElementById(`ProductPage-${this.dataset.section}`);
    const infoMetas = document.querySelectorAll(`.product-info-meta-${this.dataset.section}`);
    const stockBarBlock = document.getElementById(`ProductStockBar-${this.dataset.section}`);

    if (addButton) {
      addButtonText.textContent = window.variantStrings.unavailable;
    }

    if (price) {
      price.classList.add("visibility-hidden");
    }

    if (infoMetas.length > 0) {
      infoMetas.forEach((infoMeta) => {
        infoMeta.classList.add("visibility-hidden");
      });
    }

    if (stockBarBlock) {
      stockBarBlock.classList.add("hidden");
    }

    // SKU and Barcode are variant-depended, so we need to "empty" them but not remove them (so the Details block container won't end up empty).
    const unavailableDetails = product?.querySelectorAll(
      ".product-info-details-variant-field .product-info-details-item-value",
    );
    if (unavailableDetails) {
      unavailableDetails.forEach((detail) => (detail.innerHTML = "-"));
    }
  }

  getVariantData(inputId) {
    return JSON.parse(
      this.querySelector(`script[type="application/json"][data-resource="${inputId}"]`).textContent,
    );
  }

  getSelectedOptionValues() {
    return Array.from(this.querySelectorAll("select option:checked, fieldset input:checked")).map(
      (element) => element.dataset.optionValueId,
    );
  }
}

if (!customElements.get("variant-selects")) {
  customElements.define("variant-selects", VariantSelects);
}

class VariantRadios extends VariantSelects {
  constructor() {
    super();
  }
}

customElements.define("variant-radios", VariantRadios);

// Product card
//

class ProductCard extends HTMLElement {
  constructor() {
    super();
    this.colorSwatches = this.querySelectorAll(".card-product-color-swatch");
    this.productLinks = this.querySelectorAll("a.js-product-link");

    this.colorSwatches.forEach((colorSwatch) => {
      colorSwatch.addEventListener("click", (event) => {
        event.preventDefault();
        this.handleColorSwatchClick(colorSwatch);
      });

      colorSwatch.addEventListener("mouseover", () => {
        this.handleColorSwatchMouseOver(colorSwatch);
      });
    });
  }

  handleColorSwatchClick(colorSwatch) {
    // Set the color swatch to active
    this.colorSwatches.forEach((x) => x.classList.remove("is-active"));
    colorSwatch.classList.add("is-active");

    // Change all links to point to the new URL
    this.productLinks.forEach((productLink) => {
      productLink.setAttribute("href", colorSwatch.getAttribute("href"));
    });

    // Change the image
    const variantImageTemplate = colorSwatch.querySelector(".card-media-image");
    const mainImage = this.querySelector(".card-media img:first-child");
    if (variantImageTemplate && mainImage) {
      const variantImage = variantImageTemplate.cloneNode(true);
      variantImage.classList.remove("card-variant-image");
      mainImage.replaceWith(variantImage);
    }

    // Update the SKU
    const variantSku = colorSwatch.getAttribute("data-variant-sku");
    const skuElement = this.querySelector("[data-card-sku]");
    if (skuElement) {
      skuElement.textContent = variantSku || "";
    }
  }

  handleColorSwatchMouseOver(colorSwatch) {
    const image = colorSwatch.querySelector(".card-media-image");

    // Preload the image on mouseover
    if (image) {
      image.style.display = "inline-block";
      image.setAttribute("loading", "");
    }
  }
}

customElements.define("product-card", ProductCard);

// Expandable list
//
class ExpandableList extends HTMLElement {
  constructor() {
    super();

    this.elements = {
      root: this.querySelector("ul"),
      expandableNavs: this.querySelectorAll(".has-sub-menu"),
      expandableToggles: this.querySelectorAll(".navigation-side-toggle"),
    };

    if (!this.elements.expandableNavs.length) {
      return;
    }

    this.expandOnArrowsOnly = this.getAttribute("expand-on-arrows") === "true";

    if (!this.expandOnArrowsOnly) {
      this.elements.expandableNavs.forEach((nav) => {
        const navLink = nav.querySelector("a");
        navLink.addEventListener("click", this.onToggle.bind(this, nav));
      });
    }
    this.elements.expandableToggles.forEach((toggle) => {
      const nav = toggle.closest(".navigation-side-item");
      toggle.addEventListener("click", this.onToggle.bind(this, nav));
    });
  }

  onToggle(navElement, event) {
    event.preventDefault();
    event.stopImmediatePropagation();

    const submenu = navElement.querySelector("ul");
    const closeOthers = this.getAttribute("close-others");
    const isExpanded = submenu.getAttribute("aria-expanded") === "true";

    if (isExpanded) {
      this.onContract(navElement);
    } else {
      this.onExpand(navElement);

      if (closeOthers) {
        const closestRoot = navElement.closest("ul");
        const siblings = [...closestRoot.querySelectorAll(":scope > .has-sub-menu")].filter(
          (item) => {
            return item !== navElement;
          },
        );
        siblings.forEach(this.onContract);
      }
    }
  }

  onExpand(element) {
    const submenu = element.querySelector("ul");
    element.classList.add("is-expanded");
    submenu.setAttribute("aria-expanded", "true");
  }

  onContract(element) {
    const submenu = element.querySelector("ul");
    element.classList.remove("is-expanded");
    submenu.setAttribute("aria-expanded", "false");
  }
}

customElements.define("expandable-list", ExpandableList);

// Quantity Input
//
class QuantityInput extends HTMLElement {
  constructor() {
    super();
    this.input = this.querySelector("input");
    this.changeEvent = new Event("change", { bubbles: true });
    this.input.addEventListener("change", this.onInputChange.bind(this));

    this.querySelectorAll("button").forEach((button) =>
      button.addEventListener("click", this.onButtonClick.bind(this)),
    );
  }

  quantityUpdateUnsubscriber = undefined;

  connectedCallback() {
    this.validateQtyRules();
    this.quantityUpdateUnsubscriber = subscribe(
      PUB_SUB_EVENTS.quantityUpdate,
      this.validateQtyRules.bind(this),
    );
  }

  disconnectedCallback() {
    if (this.quantityUpdateUnsubscriber) {
      this.quantityUpdateUnsubscriber();
    }
  }

  onInputChange(event) {
    this.validateQtyRules();
  }

  onButtonClick(event) {
    event.preventDefault();
    const previousValue = this.input.value;

    if (event.target.name === "plus") {
      if (parseInt(this.input.dataset.min) > parseInt(this.input.step) && this.input.value == 0) {
        this.input.value = this.input.dataset.min;
      } else {
        this.input.stepUp();
      }
    } else {
      this.input.stepDown();
    }

    if (previousValue !== this.input.value) {
      this.input.dispatchEvent(this.changeEvent);

      const event = new CustomEvent("product:quantity-update", {
        detail: {
          quantity: Number(this.input.value),
        },
      });
      document.dispatchEvent(event);
    }

    if (this.input.dataset.min === previousValue && event.target.name === "minus") {
      this.input.value = parseInt(this.input.min);
    }
  }

  validateQtyRules() {
    const value = parseInt(this.input.value);
    if (this.input.min) {
      const buttonMinus = this.querySelector("button[name='minus']");
      buttonMinus.classList.toggle("disabled", parseInt(value) <= parseInt(this.input.min));
    }
    if (this.input.max) {
      const max = parseInt(this.input.max);
      const buttonPlus = this.querySelector("button[name='plus']");
      buttonPlus.classList.toggle("disabled", value >= max);
    }
  }
}

customElements.define("quantity-input", QuantityInput);

class CartRemoveButton extends HTMLElement {
  constructor() {
    super();
    this.addEventListener("click", (event) => {
      event.preventDefault();
      const cartItems = this.closest("cart-items");
      const miniCart = this.closest("mini-cart");

      if (cartItems) {
        cartItems.updateQuantity(this.dataset.index, 0);
      }

      if (miniCart) {
        miniCart.updateQuantity(this.dataset.index, 0);
      }
    });
  }
}

customElements.define("cart-remove-button", CartRemoveButton);

class CartItems extends HTMLElement {
  constructor() {
    super();

    this.eventContext = this.dataset.eventContext;
    this.lineItemStatusElement = document.getElementById("shopping-cart-line-item-status");

    this.currentItemCount = Array.from(this.querySelectorAll('[name="updates[]"]')).reduce(
      (total, quantityInput) => total + parseInt(quantityInput.value),
      0,
    );

    this.debouncedOnChange = debounce((event) => {
      this.onChange(event);
    }, 500);

    this.addEventListener("change", this.debouncedOnChange.bind(this));
  }

  onChange(event) {
    if (
      event.target.getAttribute("id")?.includes?.("cart-policy") ||
      !!event.target.closest("cart-coupon")
    ) {
      return;
    }

    this.updateQuantity(
      event.target.dataset.index,
      event.target.value,
      document.activeElement.getAttribute("name"),
    );
  }

  getSectionsToRender() {
    return [
      {
        id: "cart-page-title-wrap",
        section: document.getElementById("cart-page-title-wrap").dataset.id,
        selector: ".page-title-wrap",
      },
      {
        id: "main-cart-items",
        section: document.getElementById("main-cart-items").dataset.id,
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
        section: document.getElementById("main-cart-footer").dataset.id,
        selector: ".js-contents",
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

  updateQuantity(line, quantity, name) {
    this.enableLoading(line);

    const body = JSON.stringify({
      line,
      quantity,
      sections: this.getSectionsToRender().map((section) => section.section),
      sections_url: window.location.pathname,
    });

    fetch(`${routes.cart_change_url}`, { ...fetchConfig(), ...{ body } })
      .then((response) => {
        return response.text();
      })
      .then(async (state) => {
        const parsedState = JSON.parse(state);
        const quantityElement =
          document.getElementById(`quantity-input-${line}`) ||
          document.getElementById(`Mini-Cart-Quantity-${line}`);
        const items = document.querySelectorAll(".js-cart-item");

        if (parsedState.errors) {
          await this.updateSectionContents();
          this.updateLiveRegions(line, parsedState.errors);
          return;
        }

        this.classList.toggle("is-empty", parsedState.item_count === 0);
        const cartFooter = document.getElementById("main-cart-footer");

        if (cartFooter) {
          cartFooter.classList.toggle("is-empty", parsedState.item_count === 0);
        }

        this.getSectionsToRender().forEach((section) => {
          const elementToReplace =
            document.getElementById(section.id).querySelector(section.selector) ||
            document.getElementById(section.id);

          elementToReplace.innerHTML = this.getSectionInnerHTML(
            parsedState.sections[section.section],
            section.selector,
          );
        });

        const updatedValue = parsedState.items[line - 1]
          ? parsedState.items[line - 1].quantity
          : undefined;
        let message = "";
        if (
          items.length === parsedState.items.length &&
          updatedValue !== parseInt(quantityElement.value)
        ) {
          if (typeof updatedValue === "undefined") {
            message = window.cartStrings.error;
          } else {
            message = window.cartStrings.quantityError.replace("[quantity]", updatedValue);
          }
        }
        this.updateLiveRegions(line, message);

        const lineItem =
          document.getElementById(`CartItem-${line}`) ||
          document.getElementById(`MiniCartItem-${line}`);
        if (lineItem && lineItem.querySelector(`[name="${name}"]`)) {
          lineItem.querySelector(`[name="${name}"]`).focus();
        }

        if (quantity === 0) {
          const event = new CustomEvent("cart:item-remove", {
            detail: {
              cart: parsedState,
              context: this.eventContext,
            },
          });
          document.dispatchEvent(event);
        } else {
          const event = new CustomEvent("cart:item-quantity-update", {
            detail: {
              cart: parsedState,
              context: this.eventContext,
            },
          });
          document.dispatchEvent(event);
        }

        publish(PUB_SUB_EVENTS.cartUpdate, {
          source: "cart-items",
          cartData: parsedState,
          variantId: parsedState.items[line - 1]?.id,
        });
      })
      .catch(() => {
        this.setError(window.cartStrings.error);
      })
      .finally(() => {
        this.disableLoading();
      });
  }

  setError(error) {
    document.getElementById("cart-errors").textContent = error;
  }

  updateLiveRegions(line, message) {
    const lineItemError = document.getElementById(`Line-item-error-${line}`);

    if (lineItemError) {
      lineItemError.querySelector(".cart-item-error-text").innerHTML = message;
    }

    this.lineItemStatusElement.setAttribute("aria-hidden", true);

    const cartStatus = document.getElementById("cart-live-region-text");
    cartStatus.setAttribute("aria-hidden", false);

    setTimeout(() => {
      cartStatus.setAttribute("aria-hidden", true);
    }, 1000);
  }

  updateSectionContents() {
    return fetch(
      `${window.location.pathname}?sections=${this.getSectionsToRender()
        .map((section) => section.section)
        .join(",")}&v=${Date.now()}`,
    )
      .then((response) => {
        return response.json();
      })
      .then((response) => {
        this.getSectionsToRender().forEach((section) => {
          const elementToReplace =
            document.getElementById(section.id)?.querySelector(section.selector) ||
            document.getElementById(section.id);

          elementToReplace.innerHTML = this.getSectionInnerHTML(
            response[section.section],
            section.selector,
          );
        });
      });
  }

  getSectionInnerHTML(html, selector) {
    return new DOMParser().parseFromString(html, "text/html").querySelector(selector).innerHTML;
  }

  enableLoading(line) {
    document.getElementById("main-cart-items").classList.add("cart-items-disabled");
    this.querySelectorAll(`#CartItem-${line} .cart-item-loading-overlay`).forEach((overlay) =>
      overlay.classList.remove("hidden"),
    );
    document.activeElement.blur();
    this.lineItemStatusElement.setAttribute("aria-hidden", false);
  }

  disableLoading() {
    document.getElementById("main-cart-items").classList.remove("cart-items-disabled");
    this.querySelectorAll(".cart-item-loading-overlay").forEach((overlay) =>
      overlay.classList.add("hidden"),
    );
  }
}

customElements.define("cart-items", CartItems);

class MiniCart extends CartItems {
  constructor() {
    super();
    this.toggle = this.querySelector("drawer-toggle");
  }

  connectedCallback() {
    if (!Shopify.designMode) {
      this.updateSectionContents();
    }

    window.miniCart = this;

    // Listen to global events from apps
    document.addEventListener("open-mini-cart", (e) => {
      this.open(e.detail?.opener || null);
    });
    document.addEventListener("close-mini-cart", () => {
      this.close();
    });
    document.addEventListener("toggle-mini-cart", (e) => {
      const opener = e.detail?.opener || null;
      if (this.toggle?.hasAttribute("open")) {
        this.close();
      } else {
        this.open(opener);
      }
    });
  }

  open(opener) {
    this.toggle.open(opener);
    this.dispatchEvent(new CustomEvent("mini-cart:opened", { bubbles: true }));
  }

  close() {
    this.toggle.close();
    this.dispatchEvent(new CustomEvent("mini-cart:closed", { bubbles: true }));
  }

  getSectionsToRender() {
    return [
      {
        id: "header",
        section: document.getElementById("header")?.dataset.id,
        selector: ".head-slot-cart-link",
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

  getSectionInnerHTML(html, selector = ".shopify-section") {
    return new DOMParser().parseFromString(html, "text/html").querySelector(selector).innerHTML;
  }

  renderContents(parsedState) {
    this.getSectionsToRender().forEach((section) => {
      const elementToReplace =
        document.getElementById(section.id).querySelector(section.selector) ||
        document.getElementById(section.id);

      elementToReplace.innerHTML = this.getSectionInnerHTML(
        parsedState.sections[section.section],
        section.selector,
      );
    });
    this.currentItemCount = Array.from(this.querySelectorAll('[name="updates[]"]')).reduce(
      (total, quantityInput) => total + parseInt(quantityInput.value),
      0,
    );
  }

  setError(error) {
    document.getElementById("mini-cart-error").textContent = error;
  }

  enableLoading() {
    this.querySelector(".mini-cart-wrap").classList.add("loading");
  }

  disableLoading() {
    this.querySelector(".mini-cart-wrap").classList.remove("loading");
  }

  updateLiveRegions(line, message) {
    const lineItemError = document.getElementById(`MiniCart-Line-item-error-${line}`);
    if (lineItemError) {
      lineItemError.querySelector(".cart-item-error-text").innerHTML = message;
    }
  }
}

customElements.define("mini-cart", MiniCart);

// Language & Country selectors.
//
class LocalizationForm extends HTMLElement {
  constructor() {
    super();
    this.elements = {
      input: this.querySelector('input[name="locale_code"], input[name="country_code"]'),
      button: this.querySelector("button"),
      dropdown: this.querySelector(".dropdown"),
      panel: this.querySelector(".dropdown-list-wrap"),
    };
    this.elements.button.addEventListener("click", this.openSelector.bind(this));
    this.elements.button.addEventListener("focusout", this.closeSelector.bind(this));
    this.addEventListener("keyup", this.onContainerKeyUp.bind(this));

    this.querySelectorAll("a").forEach((item) =>
      item.addEventListener("click", this.onItemClick.bind(this)),
    );
  }

  hidePanel() {
    this.elements.button.blur();
    this.elements.button.setAttribute("aria-expanded", "false");
    this.elements.panel.setAttribute("aria-hidden", "true");
  }

  onContainerKeyUp(event) {
    if (event.code.toUpperCase() !== "ESCAPE") {
      return;
    }

    this.hidePanel();
    this.elements.button.focus();
  }

  onItemClick(event) {
    event.preventDefault();
    const form = this.querySelector("form");
    this.elements.input.value = event.currentTarget.dataset.value;
    if (form) {
      form.submit();
    }
  }

  toggleSelector() {
    if (this.isOpen()) {
      this.hidePanel();
      return;
    }

    this.elements.button.focus();
    this.elements.panel.setAttribute("aria-hidden", "false");
    this.elements.button.setAttribute("aria-expanded", "true");
  }

  isOpen() {
    return this.elements.panel.getAttribute("aria-hidden") === "false";
  }

  openSelector() {
    this.elements.button.focus();
    this.elements.panel.setAttribute(
      "aria-hidden",
      this.elements.button.getAttribute("aria-hidden") === "true",
    );
    this.elements.button.setAttribute(
      "aria-expanded",
      (this.elements.button.getAttribute("aria-expanded") === "false").toString(),
    );
  }

  closeSelector(event) {
    const shouldClose =
      event.relatedTarget &&
      (event.relatedTarget.nodeName === "BUTTON" || event.relatedTarget.nodeName === "MAIN");
    if (event.relatedTarget === null || shouldClose) {
      this.hidePanel();
    }
  }
}

customElements.define("localization-form", LocalizationForm);

class TabsComponent extends HTMLElement {
  constructor() {
    super();
  }

  setActiveTab(handle) {
    this.querySelectorAll("[data-handle]").forEach((tab) => {
      tab.setAttribute("aria-hidden", "true");

      if (tab.getAttribute("data-handle") === handle) {
        const carouselComponent = tab.querySelector("carousel-slider");
        tab.setAttribute("aria-hidden", "false");

        if (carouselComponent) {
          carouselComponent.flickity.resize();
        }
      }
    });
  }
}

customElements.define("tabs-component", TabsComponent);

class TabsNavigation extends HTMLElement {
  constructor() {
    super();

    this.sliderId = this.getAttribute("for");
    this.navs = this.querySelectorAll("a, button");
    this.navs.forEach((nav) => {
      nav.addEventListener("click", this.onNavigationClick.bind(this, nav));
    });
  }

  onNavigationClick(element, event) {
    event.preventDefault();
    this.setActiveTab(element);
  }

  setActiveTab(nav) {
    const target = nav.getAttribute("data-handle");
    const tabsComponent = document.querySelector(`#${this.sliderId}`);

    if (!tabsComponent) {
      return;
    }

    tabsComponent.setActiveTab(target);

    this.navs.forEach((element) => {
      if (element === nav) {
        element.classList.add("is-active");
      } else {
        element.classList.remove("is-active");
      }
    });
  }
}

customElements.define("tabs-navigation", TabsNavigation);

class DeferredMedia extends HTMLElement {
  constructor() {
    super();
    const poster = this.querySelector('[id^="Deferred-Poster-"]');

    if (!poster) {
      return;
    }

    poster.addEventListener("click", this.loadContent.bind(this));
  }

  loadContent(focus = true) {
    window.pauseAllMedia();

    if (!this.getAttribute("loaded")) {
      const content = document.createElement("div");
      content.appendChild(this.querySelector("template").content.firstElementChild.cloneNode(true));

      this.setAttribute("loaded", true);
      const deferredElement = this.appendChild(
        content.querySelector("video, model-viewer, iframe"),
      );
      if (focus) {
        deferredElement.focus();
      }
    }
  }
}

customElements.define("deferred-media", DeferredMedia);

// Drawers
//
class DrawerModal extends HTMLElement {
  constructor() {
    super();
    this.bodyClass = this.getAttribute("body-class");
    this.isOpen = false;
    this.eventPrefix = this.dataset.eventPrefix;

    this.addEventListener("keyup", (event) => {
      if (event.code.toUpperCase() === "ESCAPE") {
        if (this.isOpen) {
          this.close();
        }
      }
    });
  }

  open(opener) {
    this.isOpen = true;
    this.openedBy = opener;
    document.body.classList.add(this.bodyClass);
    document.body.classList.add("drawer-open");

    if (this.eventPrefix) {
      const event = new CustomEvent(`${this.eventPrefix}:open`);
      document.dispatchEvent(event);
    }
  }

  close() {
    this.isOpen = false;
    document.body.classList.remove(this.bodyClass);
    document.body.classList.remove("drawer-open");

    if (this.openedBy) {
      removeTrapFocus(this.openedBy);
    }

    if (this.eventPrefix) {
      const event = new CustomEvent(`${this.eventPrefix}:close`);
      document.dispatchEvent(event);
    }
  }
}

customElements.define("drawer-modal", DrawerModal);

class DrawerToggle extends HTMLElement {
  constructor() {
    super();
    this.toggleElement = this.querySelector("a") || this.querySelector("button");
    this.bodyClass = this.getAttribute("body-class");
    this.preventOpen = this.getAttribute("prevent-open") === "true";
    this.eventPrefix = this.dataset.eventPrefix;

    if (this.preventOpen) {
      return;
    }

    this.toggleElement.addEventListener("click", (event) => {
      event.preventDefault();
      this.handleToggle();
    });
  }

  handleToggle(opener) {
    const drawer = document.querySelector(`#${this.getAttribute("for")}`);

    if (drawer.isOpen) {
      this.close();
    } else {
      this.open(opener);
    }
  }

  open(opener) {
    const drawer = document.querySelector(`#${this.getAttribute("for")}`);

    if (drawer) {
      drawer.open(opener || this.toggleElement);
      const drawerHeader = drawer.querySelector(".drawer-header");
      trapFocus(drawer, drawerHeader);
    }
  }

  close() {
    const drawer = document.querySelector(`#${this.getAttribute("for")}`);

    if (drawer && drawer.close && drawer.isOpen) {
      drawer.close();
    }
  }
}

customElements.define("drawer-toggle", DrawerToggle);

class CartConsentCheckbox extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    const CART_CONSENT_CHECKBOX_VALUE = "_CART_CONSENT_CHECKBOX_";
    const checkbox = this.querySelector('[type="checkbox"]');

    if (localStorage.getItem(CART_CONSENT_CHECKBOX_VALUE) === "checked") {
      checkbox.setAttribute("checked", true);
    }

    checkbox.addEventListener("change", function () {
      if (this.checked) {
        localStorage.setItem(CART_CONSENT_CHECKBOX_VALUE, "checked");
      } else {
        localStorage.removeItem(CART_CONSENT_CHECKBOX_VALUE);
      }
    });
  }
}

customElements.define("cart-consent-checkbox", CartConsentCheckbox);

class BulkAdd extends HTMLElement {
  static ASYNC_REQUEST_DELAY = 250;

  constructor() {
    super();
    this.queue = [];
    this.setRequestStarted(false);
    this.ids = [];
  }

  startQueue(id, quantity) {
    this.queue.push({ id, quantity });

    const interval = setInterval(() => {
      if (this.queue.length > 0) {
        if (!this.requestStarted) {
          this.sendRequest(this.queue);
        }
      } else {
        clearInterval(interval);
      }
    }, BulkAdd.ASYNC_REQUEST_DELAY);
  }

  sendRequest(queue) {
    this.setRequestStarted(true);
    const items = {};

    queue.forEach((queueItem) => {
      items[parseInt(queueItem.id)] = queueItem.quantity;
    });
    this.queue = this.queue.filter((queueElement) => !queue.includes(queueElement));

    this.updateMultipleQty(items);
  }

  updateMultipleQty(items) {
    // Subclassed method.
  }

  setRequestStarted(requestStarted) {
    this._requestStarted = requestStarted;
  }

  get requestStarted() {
    return this._requestStarted;
  }

  resetQuantityInput(id) {
    const input = this.querySelector(`#Quantity-${id}`);
    input.value = input.getAttribute("value");
    this.isEnterPressed = false;
  }

  setValidity(event, index, message) {
    event.target.setCustomValidity(message);
    event.target.reportValidity();
    this.resetQuantityInput(index);
    event.target.select();
  }

  validateQuantity(event) {
    const inputValue = parseInt(event.target.value);
    const index = event.target.dataset.index;

    if (inputValue < event.target.dataset.min) {
      this.setValidity(
        event,
        index,
        window.quickOrderListStrings.min_error.replace("[min]", event.target.dataset.min),
      );
    } else if (inputValue > parseInt(event.target.max)) {
      this.setValidity(
        event,
        index,
        window.quickOrderListStrings.max_error.replace("[max]", event.target.max),
      );
    } else if (inputValue % parseInt(event.target.step) != 0) {
      this.setValidity(
        event,
        index,
        window.quickOrderListStrings.step_error.replace("[step]", event.target.step),
      );
    } else {
      event.target.setCustomValidity("");
      event.target.reportValidity();
      event.target.setAttribute("value", inputValue);
      this.startQueue(index, inputValue);
    }
  }

  getSectionInnerHTML(html, selector = ".shopify-section") {
    return new DOMParser().parseFromString(html, "text/html").querySelector(selector).innerHTML;
  }
}

if (!customElements.get("bulk-add")) {
  customElements.define("bulk-add", BulkAdd);
}

if (!customElements.get("quick-add-bulk")) {
  customElements.define(
    "quick-add-bulk",
    class QuickAddBulk extends BulkAdd {
      constructor() {
        super();
        this.quantity = this.querySelector("quantity-input");
        this.revealHeader = this.dataset.revealHeader === "true";
        this.triggerCart = this.dataset.triggerCart === "true";

        const debouncedOnChange = debounce((event) => {
          if (parseInt(event.target.value) === 0) {
            this.startQueue(event.target.dataset.index, parseInt(event.target.value));
          } else {
            this.validateQuantity(event);
          }
        }, 300);

        this.addEventListener("change", debouncedOnChange.bind(this));
        this.listenForActiveInput();
        this.listenForKeydown();
        this.lastActiveInputId = null;
      }

      connectedCallback() {
        this.cartUpdateUnsubscriber = subscribe(PUB_SUB_EVENTS.cartUpdate, (event) => {
          const quantity = parseInt(this.input.value, 10);
          if (
            event.source === "quick-add" ||
            (quantity === 0 &&
              event.cartData.items &&
              !event.cartData.items.some((item) => item.id === parseInt(this.dataset.index))) ||
            (quantity === 0 &&
              event.cartData.variant_id &&
              !(event.cartData.variant_id === parseInt(this.dataset.index)))
          ) {
            return;
          }
          // If it's another section that made the update
          this.onCartUpdate().then(() => {
            this.listenForActiveInput();
            this.listenForKeydown();
          });
        });
      }

      disconnectedCallback() {
        if (this.cartUpdateUnsubscriber) {
          this.cartUpdateUnsubscriber();
        }
      }

      get input() {
        return this.querySelector("quantity-input input");
      }

      listenForActiveInput() {
        if (!this.classList.contains("hidden")) {
          this.input?.addEventListener("focusin", (event) => event.target.select());
        }
        this.isEnterPressed = false;
      }

      listenForKeydown() {
        this.input?.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            this.input?.blur();
            this.isEnterPressed = true;
          }
        });
      }

      cleanErrorMessageOnType(event) {
        event.target.addEventListener(
          "keypress",
          () => {
            event.target.setCustomValidity("");
          },
          { once: true },
        );
      }

      get sectionId() {
        if (!this._sectionId) {
          this._sectionId = this.dataset.sectionId;
        }

        return this._sectionId;
      }

      onCartUpdate() {
        return new Promise((resolve, reject) => {
          fetch(this.getSectionsUrl())
            .then((response) => response.text())
            .then((responseText) => {
              const html = new DOMParser().parseFromString(responseText, "text/html");
              const sourceQty = html.querySelector(
                `#quick-add-bulk-${this.dataset.index}-${this.sectionId}`,
              );
              if (sourceQty) {
                this.innerHTML = sourceQty.innerHTML;
              }
              resolve();
            })
            .catch((e) => {
              console.error(e);
              reject(e);
            });
        });
      }

      getSectionsUrl() {
        const pageParams = new URLSearchParams(window.location.search);
        pageParams.set("section_id", this.sectionId);
        return `${window.location.pathname}${pageParams.toString() ? "?" + pageParams.toString() : ""}`;
      }

      updateMultipleQty(items) {
        this.setLoading(true);

        const ids = Object.keys(items);
        const body = JSON.stringify({
          updates: items,
          sections: this.getSectionsToRender().map((section) => section.section),
          sections_url: this.getSectionsUrl(),
        });

        fetch(`${routes.cart_update_url}`, { ...fetchConfig(), ...{ body } })
          .then((response) => {
            return response.text();
          })
          .then((state) => {
            const parsedState = JSON.parse(state);
            this.renderSections(parsedState, ids);

            if (this.revealHeader) {
              document.querySelector("sticky-header")?.reveal?.();
            }

            if (this.triggerCart) {
              document.querySelector("mini-cart")?.open?.();
            }

            publish(PUB_SUB_EVENTS.cartUpdate, { source: "quick-add", cartData: parsedState });
          })
          .catch((error) => {
            console.log(error);
            // Commented out for now and will be fixed when Shopify Backend issue is done
            // e.target.setCustomValidity(error);
            // e.target.reportValidity();
            // this.resetQuantityInput(ids[index]);
            // this.selectProgressBar().classList.add('hidden');
            // e.target.select();
            // this.cleanErrorMessageOnType(e);
          })
          .finally(() => {
            this.setLoading(false);
            this.setRequestStarted(false);
          });
      }

      setLoading(loading = false) {
        const progressBar = this.querySelector(".qty-progress-bar-container");
        const spinner = this.querySelector(".spinner");
        const checkmark = this.querySelector(".quantity-success-check");

        if (loading) {
          progressBar.classList.add("visible");
          spinner.classList.add("visible");
          checkmark.classList.remove("visible");
        } else {
          progressBar.classList.remove("visible");
          spinner.classList.remove("visible");
          checkmark.classList.add("visible");
          setTimeout(() => checkmark.classList.remove("visible"), 1250);
        }
      }

      getSectionsToRender() {
        return [
          {
            id: `quick-add-bulk-${this.dataset.index}-${this.sectionId}`,
            section: this.sectionId,
            selector: `#quick-add-bulk-${this.dataset.index}-${this.sectionId}`,
          },
          {
            id: "header",
            section: document.getElementById("header")?.dataset.id,
            selector: ".head-slot-cart-link",
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

      renderSections(parsedState, ids) {
        const intersection = this.queue.filter((element) => ids.includes(element.id));
        if (intersection.length !== 0) return;
        this.getSectionsToRender().forEach((section) => {
          const elementToReplace =
            document.getElementById(section.id).querySelector(section.selector) ||
            document.getElementById(section.id);

          elementToReplace.innerHTML = this.getSectionInnerHTML(
            parsedState.sections[section.section],
            section.selector,
          );
        });

        if (this.isEnterPressed) {
          this.querySelector(`#Quantity-${this.lastActiveInputId}`).select();
        }

        this.listenForActiveInput();
        this.listenForKeydown();
      }
    },
  );
}

document.body.addEventListener("click", (event) => {
  if (!document.body.classList.contains("drawer-open")) {
    return;
  }

  if (event.target.closest(".drawer")) {
    return;
  }

  if (event.target.closest("drawer-toggle")) {
    return;
  }

  // Close all drawers
  [...document.querySelectorAll(".drawer")].forEach((drawer) => {
    const dismiss = drawer.querySelector("drawer-toggle");

    if (dismiss) {
      dismiss.close();
    }
  });
});

// Focus trap
function getFocusableElements(container) {
  return Array.from(
    container.querySelectorAll(
      "summary, a[href], button:enabled, [tabindex]:not([tabindex^='-']), [draggable], area, input:not([type=hidden]):enabled, select:enabled, textarea:enabled, object, iframe",
    ),
  );
}

const trapFocusHandlers = {};

function trapFocus(container, elementToFocus = container) {
  var elements = getFocusableElements(container);
  var first = elements[0];
  var last = elements[elements.length - 1];

  removeTrapFocus();

  trapFocusHandlers.focusin = (event) => {
    if (event.target !== container && event.target !== last && event.target !== first) return;

    document.addEventListener("keydown", trapFocusHandlers.keydown);
  };

  trapFocusHandlers.focusout = function () {
    document.removeEventListener("keydown", trapFocusHandlers.keydown);
  };

  trapFocusHandlers.keydown = function (event) {
    if (event.code.toUpperCase() !== "TAB") return; // If not TAB key
    // On the last focusable element and tab forward, focus the first element.
    if (event.target === last && !event.shiftKey) {
      event.preventDefault();
      first.focus();
    }

    //  On the first focusable element and tab backward, focus the last element.
    if ((event.target === container || event.target === first) && event.shiftKey) {
      event.preventDefault();
      last.focus();
    }
  };

  document.addEventListener("focusout", trapFocusHandlers.focusout);
  document.addEventListener("focusin", trapFocusHandlers.focusin);

  elementToFocus.focus();
}

// Here run the querySelector to figure out if the browser supports :focus-visible or not and run code based on it.
try {
  document.querySelector(":focus-visible");
} catch {
  focusVisiblePolyfill();
}

function focusVisiblePolyfill() {
  const navKeys = [
    "ARROWUP",
    "ARROWDOWN",
    "ARROWLEFT",
    "ARROWRIGHT",
    "TAB",
    "ENTER",
    "SPACE",
    "ESCAPE",
    "HOME",
    "END",
    "PAGEUP",
    "PAGEDOWN",
  ];
  let currentFocusedElement = null;
  let mouseClick = null;

  window.addEventListener("keydown", (event) => {
    if (navKeys.includes(event.code.toUpperCase())) {
      mouseClick = false;
    }
  });

  window.addEventListener("mousedown", (event) => {
    mouseClick = true;
  });

  window.addEventListener(
    "focus",
    () => {
      if (currentFocusedElement) {
        currentFocusedElement.classList.remove("focused");
      }

      if (mouseClick) {
        return;
      }

      currentFocusedElement = document.activeElement;
      currentFocusedElement.classList.add("focused");
    },
    true,
  );
}

function removeTrapFocus(elementToFocus = null) {
  document.removeEventListener("focusin", trapFocusHandlers.focusin);
  document.removeEventListener("focusout", trapFocusHandlers.focusout);
  document.removeEventListener("keydown", trapFocusHandlers.keydown);

  if (elementToFocus) {
    elementToFocus.focus();
  }
}

function debounce(func, wait, immediate) {
  let timeout;

  return function executedFunction() {
    const context = this;
    const args = arguments;

    const later = function () {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };

    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);

    if (callNow) {
      func.apply(context, args);
    }
  };
}

function fetchConfig(type = "json") {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: `application/${type}` },
  };
}

function pauseAllMedia() {
  document.querySelectorAll(".js-youtube").forEach((video) => {
    video.contentWindow.postMessage(
      '{"event":"command","func":"' + "pauseVideo" + '","args":""}',
      "*",
    );
  });
  document.querySelectorAll(".js-vimeo").forEach((video) => {
    video.contentWindow.postMessage('{"method":"pause"}', "*");
  });
  document.querySelectorAll("video").forEach((video) => video.pause());
  document.querySelectorAll("product-model").forEach((model) => {
    if (model.modelViewerUI) {
      model.modelViewerUI.pause();
    }
  });
}

(function () {
  // We wrap each RTE table by a specific class to allow wrapping
  document.querySelectorAll(".rte table").forEach(function (table) {
    table.outerHTML = '<div class="table-wrapper">' + table.outerHTML + "</div>";
  });
  document.querySelectorAll(".rte iframe").forEach(function (iframe) {
    // We scope the wrapping only for YouTube and Vimeo
    if (
      iframe.src.indexOf("youtube") !== -1 ||
      iframe.src.indexOf("youtu.be") !== -1 ||
      iframe.src.indexOf("vimeo") !== -1
    ) {
      iframe.outerHTML = '<div class="video-wrapper">' + iframe.outerHTML + "</div>"; // Re-set the src attribute on each iframe after page load for Chrome's "incorrect iFrame content on 'back'" bug.
      // https://code.google.com/p/chromium/issues/detail?id=395791. Need to specifically target video and admin bar

      iframe.src = iframe.src;
    }
  });
})();

/*
 * Shopify Common JS
 * Source: Dawn theme
 */
if (typeof window.Shopify == "undefined") {
  window.Shopify = {};
}

Shopify.bind = function (fn, scope) {
  return function () {
    return fn.apply(scope, arguments);
  };
};

Shopify.setSelectorByValue = function (selector, value) {
  for (var i = 0, count = selector.options.length; i < count; i++) {
    var option = selector.options[i];
    if (value == option.value || value == option.innerHTML) {
      selector.selectedIndex = i;
      return i;
    }
  }
};

Shopify.addListener = function (target, eventName, callback) {
  target.addEventListener
    ? target.addEventListener(eventName, callback, false)
    : target.attachEvent("on" + eventName, callback);
};

Shopify.postLink = function (path, options) {
  options = options || {};
  var method = options["method"] || "post";
  var params = options["parameters"] || {};

  var form = document.createElement("form");
  form.setAttribute("method", method);
  form.setAttribute("action", path);

  for (var key in params) {
    var hiddenField = document.createElement("input");
    hiddenField.setAttribute("type", "hidden");
    hiddenField.setAttribute("name", key);
    hiddenField.setAttribute("value", params[key]);
    form.appendChild(hiddenField);
  }
  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
};

Shopify.CountryProvinceSelector = function (country_domid, province_domid, options) {
  this.countryEl = document.getElementById(country_domid);
  this.provinceEl = document.getElementById(province_domid);
  this.provinceContainer = document.getElementById(options["hideElement"] || province_domid);

  Shopify.addListener(this.countryEl, "change", Shopify.bind(this.countryHandler, this));

  this.initCountry();
  this.initProvince();
};

Shopify.CountryProvinceSelector.prototype = {
  initCountry: function () {
    var value = this.countryEl.getAttribute("data-default");
    Shopify.setSelectorByValue(this.countryEl, value);
    this.countryHandler();
  },

  initProvince: function () {
    var value = this.provinceEl.getAttribute("data-default");
    if (value && this.provinceEl.options.length > 0) {
      Shopify.setSelectorByValue(this.provinceEl, value);
    }
  },

  countryHandler: function (e) {
    var opt = this.countryEl.options[this.countryEl.selectedIndex];
    var raw = opt.getAttribute("data-provinces");
    var provinces = JSON.parse(raw);

    this.clearOptions(this.provinceEl);
    if (provinces && provinces.length == 0) {
      this.provinceContainer.style.display = "none";
    } else {
      for (var i = 0; i < provinces.length; i++) {
        var opt = document.createElement("option");
        opt.value = provinces[i][0];
        opt.innerHTML = provinces[i][1];
        this.provinceEl.appendChild(opt);
      }

      this.provinceContainer.style.display = "";
    }
  },

  clearOptions: function (selector) {
    while (selector.firstChild) {
      selector.removeChild(selector.firstChild);
    }
  },

  setOptions: function (selector, values) {
    for (var i = 0, count = values.length; i < values.length; i++) {
      var opt = document.createElement("option");
      opt.value = values[i];
      opt.innerHTML = values[i];
      selector.appendChild(opt);
    }
  },
};

/*
 * Copy to Clipboard Component
 */
class CopyToClipboard extends HTMLElement {
  constructor() {
    super();
    this.button = this.querySelector("button");
    this.originalText = this.button ? this.button.firstChild.textContent.trim() : "";
    this.tooltipText = this.dataset.tooltipText;
    this.copiedText = this.dataset.copiedText;
    this.copiedTimeout = null;
    this.tooltipElement = null;
  }

  connectedCallback() {
    if (!this.button) return;

    this.button.addEventListener("click", this.handleCopy.bind(this));
    this.button.addEventListener("mouseenter", this.showTooltip.bind(this));
    this.button.addEventListener("mouseleave", this.hideTooltip.bind(this));
    this.button.addEventListener("focus", this.showTooltip.bind(this));
    this.button.addEventListener("blur", this.hideTooltip.bind(this));
  }

  disconnectedCallback() {
    if (!this.button) return;

    this.button.removeEventListener("click", this.handleCopy.bind(this));
    this.button.removeEventListener("mouseenter", this.showTooltip.bind(this));
    this.button.removeEventListener("mouseleave", this.hideTooltip.bind(this));
    this.button.removeEventListener("focus", this.showTooltip.bind(this));
    this.button.removeEventListener("blur", this.hideTooltip.bind(this));

    if (this.copiedTimeout) {
      clearTimeout(this.copiedTimeout);
    }
  }

  async handleCopy(event) {
    event.preventDefault();

    try {
      await navigator.clipboard.writeText(this.originalText);
      this.showCopiedState();
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  }

  showCopiedState() {
    if (!this.button) return;

    // Update tooltip to "Copied!"
    this.updateTooltipText(this.copiedText);

    // Add copied class for styling
    this.button.classList.add("is-copied");

    // Clear any existing timeout
    if (this.copiedTimeout) {
      clearTimeout(this.copiedTimeout);
    }

    // Reset after 2 seconds
    this.copiedTimeout = setTimeout(() => {
      this.button.classList.remove("is-copied");
      if (this.tooltipElement) {
        this.updateTooltipText(this.tooltipText);
      }
    }, 2000);
  }

  showTooltip() {
    if (!this.button) return;

    // Don't show tooltip if already exists
    if (this.tooltipElement) return;

    const tooltipText = this.button.classList.contains("is-copied")
      ? this.copiedText
      : this.tooltipText;

    this.tooltipElement = document.createElement("div");
    this.tooltipElement.className = "copy-tooltip";
    this.tooltipElement.textContent = tooltipText;
    this.appendChild(this.tooltipElement);

    // Trigger reflow for animation
    setTimeout(() => {
      this.tooltipElement?.classList.add("is-visible");
    }, 10);
  }

  hideTooltip() {
    if (!this.tooltipElement) return;

    this.tooltipElement.classList.remove("is-visible");

    setTimeout(() => {
      if (this.tooltipElement && this.tooltipElement.parentNode) {
        this.tooltipElement.remove();
        this.tooltipElement = null;
      }
    }, 200);
  }

  updateTooltipText(text) {
    if (this.tooltipElement) {
      this.tooltipElement.textContent = text;
    }
  }
}

customElements.define("copy-to-clipboard", CopyToClipboard);
