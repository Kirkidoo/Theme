if (!customElements.get("product-compare-buttons")) {
  customElements.define(
    "product-compare-buttons",
    class ProductCompareButtons extends HTMLElement {
      constructor() {
        super();

        this.compareAction = this.querySelector(".collection-actions-compare-action");
        this.compareLink = this.querySelector("a.collection-actions-compare-button-label");
        this.masterCompareToggleCheckbox = this.querySelector(
          "input.collection-action-compare-toggle-checkbox",
        );
        this.dismissButton = this.querySelector(".collection-actions-compare-button-dismiss");
        this.maxProducts = parseInt(this.dataset.maxProducts || "5", 10);
        this.allCheckboxes = document.querySelectorAll('input[name="compare-product"]');
        this.modal = document.getElementById("ProductCompareModal");

        this.originalCompareActionTop = 0;
        this.isCompareActionSticky = false;
        this.isScrollUpdateScheduled = false;

        this.boundHandleCompareActionScroll = this._handleCompareActionScroll.bind(this);
      }

      connectedCallback() {
        this.unsubscribeAdd = subscribe(
          PUB_SUB_EVENTS.compareAdd,
          this.handleCompareAdd.bind(this),
        );
        this.unsubscribeRemove = subscribe(
          PUB_SUB_EVENTS.compareRemove,
          this.handleCompareRemove.bind(this),
        );

        this.dismissButton.addEventListener("click", this.onDismissClick.bind(this));
        this.compareLink.addEventListener("click", this.onCompareClick.bind(this));

        if (this.masterCompareToggleCheckbox) {
          const masterToggleState = sessionStorage.getItem("compareMasterToggleState");
          if (masterToggleState !== null) {
            this.masterCompareToggleCheckbox.checked = masterToggleState === "true";
          }
          this.masterCompareToggleCheckbox.addEventListener(
            "change",
            this.onMasterCompareToggleChange.bind(this),
          );
        }
        this.setInitialCompareVisibility();

        this.onCompareAlertListener();
        this.updateButtons();

        this._calculateCompareActionOffset();
        window.addEventListener("scroll", this.boundHandleCompareActionScroll, { passive: true });
        this._updateStickyStateOnScroll();
      }

      disconnectedCallback() {
        this.unsubscribeAdd?.();
        this.unsubscribeRemove?.();
        window.removeEventListener("scroll", this.boundHandleCompareActionScroll);
      }

      _calculateCompareActionOffset() {
        if (!this.compareAction || this.compareAction.hidden) {
          this.originalCompareActionTop = 0;
          return;
        }

        const wasSticky = this.isCompareActionSticky;
        if (wasSticky) {
          this.compareAction.classList.remove("is-sticky-scrolled");
        }

        this.originalCompareActionTop =
          this.compareAction.getBoundingClientRect().top + window.scrollY;

        if (wasSticky) {
          this.compareAction.classList.add("is-sticky-scrolled");
        }
      }

      _handleCompareActionScroll() {
        if (!this.isScrollUpdateScheduled) {
          this.isScrollUpdateScheduled = true;
          window.requestAnimationFrame(() => {
            this._updateStickyStateOnScroll();
            this.isScrollUpdateScheduled = false;
          });
        }
      }

      _updateStickyStateOnScroll() {
        if (!this.compareAction) {
          return;
        }

        if (this.compareAction.hidden) {
          if (this.isCompareActionSticky) {
            this.compareAction.classList.remove("is-sticky-scrolled");
            this.isCompareActionSticky = false;
          }
          return;
        }

        if (this.originalCompareActionTop === 0 && !this.compareAction.hidden) {
          this._calculateCompareActionOffset();
          if (this.originalCompareActionTop === 0) return;
        }

        const shouldBeSticky = window.scrollY > this.originalCompareActionTop;

        if (shouldBeSticky && !this.isCompareActionSticky) {
          this.compareAction.classList.add("is-sticky-scrolled");
          this.isCompareActionSticky = true;
        } else if (!shouldBeSticky && this.isCompareActionSticky) {
          this.compareAction.classList.remove("is-sticky-scrolled");
          this.isCompareActionSticky = false;
        }
      }

      onCompareAlertListener() {
        if (window.compareAlertListenerAttached) {
          return;
        }

        document.body.addEventListener("click", (event) => {
          const isAlertLink = event.target.classList.contains("card-product-compare-alert-link");
          const alertLink = event.target;

          if (!isAlertLink) {
            return;
          }

          const useModal = alertLink.dataset.modal === "true";
          if (useModal && this.modal) {
            event.preventDefault();
            this.modal.show(alertLink);
          }
        });

        window.compareAlertListenerAttached = true;
      }

      onCompareClick(event) {
        const useModal = this.dataset.modal === "true";
        const isDisabled = this.compareLink.getAttribute("aria-disabled") === "true";

        if (useModal && !isDisabled) {
          event.preventDefault();
          if (this.modal) {
            this.modal.show(this.compareLink);
          }
        } else if (isDisabled) {
          event.preventDefault();
        }
      }

      handleCompareAdd(event) {
        const handle = event.detail.handle;
        let url = event.detail.url;
        if (window.routes.root_url !== "/") {
          url = url.replace(window.routes.root_url, "");
        }

        this.addProduct(handle, {
          id: event.detail.id,
          handle: handle,
          title: event.detail.title,
          url: url,
        });

        this.updateButtons();
      }

      handleCompareRemove(event) {
        const handle = event.detail.handle;
        this.removeProduct(handle);
        this.updateButtons();
      }

      onDismissClick(event) {
        event.preventDefault();
        sessionStorage.removeItem("compare-products");

        document.querySelectorAll("product-compare-checkbox").forEach((compareCheckbox) => {
          compareCheckbox.setChecked(false);
          compareCheckbox.setDisabled(false);
        });

        this.updateButtons();
      }

      onMasterCompareToggleChange(event) {
        const isChecked = event.target.checked;
        this.toggleCompareVisibility(isChecked);
        sessionStorage.setItem("compareMasterToggleState", isChecked);
      }

      toggleCompareVisibility(show) {
        if (show) {
          document.body.classList.add("product-compare-toggled-on");
        } else {
          document.body.classList.remove("product-compare-toggled-on");
        }
        this.updateButtons();
      }

      addProduct(handle, productProps) {
        let products = getCompareProducts();
        if (Object.keys(products).length < this.maxProducts) {
          products[handle] = productProps;
          sessionStorage.setItem("compare-products", JSON.stringify(products));
        }
      }

      removeProduct(handle) {
        let products = getCompareProducts();
        if (handle in products) {
          delete products[handle];
        }
        sessionStorage.setItem("compare-products", JSON.stringify(products));
      }

      updateButtons() {
        const products = getCompareProducts();
        const productEntries = Object.entries(products);
        const productCount = productEntries.length;
        const useModal = this.dataset.modal === "true";
        const isMasterToggleChecked = this.masterCompareToggleCheckbox
          ? this.masterCompareToggleCheckbox.checked
          : true;
        const shouldShowAction = productCount > 0 && isMasterToggleChecked;

        const wasHidden = this.compareAction.hidden;
        this.compareAction.hidden = !shouldShowAction;

        if (wasHidden && !this.compareAction.hidden) {
          Promise.resolve().then(() => {
            this._calculateCompareActionOffset();
            this._updateStickyStateOnScroll();
          });
        } else {
          this._updateStickyStateOnScroll();
        }

        let compareUrl = null;
        let relativeUrl = null;

        if (productCount > 0) {
          const countSpan = this.compareLink.querySelector(".collection-actions-compare-value");
          if (countSpan) {
            countSpan.textContent = productCount;
          }

          // Construct the comparison URL.
          let firstProductUrl = null;

          for (const [handle, productProps] of Object.entries(products)) {
            if (!compareUrl) {
              firstProductUrl = productProps.url;
              compareUrl = new URL(productProps.url, window.shopUrl);
              if (window.routes.root_url !== "/") {
                compareUrl = new URL(window.routes.root_url + productProps.url, window.shopUrl);
              }
              compareUrl.searchParams.set("view", "compare");
              continue;
            }

            compareUrl.searchParams.append("handles", productProps.handle);
          }

          if (compareUrl) {
            relativeUrl = compareUrl.pathname + compareUrl.search;
          }

          if (useModal) {
            this.compareLink.href = "#";
            if (relativeUrl && this.modal) {
              this.modal.dataset.url = relativeUrl;
            } else if (this.modal) {
              this.modal.removeAttribute("data-url");
            }
            this.compareLink.removeAttribute("aria-disabled");
            this.dismissButton.removeAttribute("disabled");
          } else {
            if (relativeUrl) {
              this.compareLink.setAttribute("href", relativeUrl);
              this.compareLink.removeAttribute("aria-disabled");
              this.dismissButton.removeAttribute("disabled");
            } else {
              this.compareLink.removeAttribute("href");
              this.compareLink.setAttribute("aria-disabled", "true");
              this.dismissButton.setAttribute("disabled", "true");
            }
          }
        } else {
          this.compareLink.removeAttribute("href");
          this.compareLink.setAttribute("aria-disabled", "true");
          this.dismissButton.setAttribute("disabled", "true");

          if (this.modal) {
            this.modal.removeAttribute("data-url");
          }
        }

        publish(PUB_SUB_EVENTS.compareUrlUpdated, {
          url: relativeUrl,
          useModal: useModal,
        });
      }

      setInitialCompareVisibility() {
        // If the initial state was already set by the inline script, respect it
        if (document.body.classList.contains("page-loading")) {
          // Initial state was already applied, just sync the checkbox state
          const isToggled = document.body.classList.contains("product-compare-toggled-on");
          if (this.masterCompareToggleCheckbox) {
            this.masterCompareToggleCheckbox.checked = isToggled;
          }
          return;
        }

        // Fallback for cases where inline script didn't run
        const alwaysOn = !this.masterCompareToggleCheckbox;
        const show = alwaysOn || this.masterCompareToggleCheckbox.checked;
        this.toggleCompareVisibility(show);
      }
    },
  );
}

if (!customElements.get("product-compare-checkbox")) {
  customElements.define(
    "product-compare-checkbox",
    class ProductCompareCheckbox extends HTMLElement {
      constructor() {
        super();
        this.checkbox = this.querySelector('input[type="checkbox"]');
        this.alert = this.querySelector(".card-product-compare-alert");
        this.alertLink = this.alert?.querySelector("a");
        this.productId = this.dataset.id;
        this.productHandle = this.dataset.handle;
        this.productTitle = this.dataset.title;
        this.productUrl = this.dataset.url;
      }

      connectedCallback() {
        this.checkbox.addEventListener("change", this.onChange.bind(this));

        this.unsubscribeUrlUpdated = subscribe(
          PUB_SUB_EVENTS.compareUrlUpdated,
          this.handleUrlUpdate.bind(this),
        );

        this.unsubscribeRemove = subscribe(
          PUB_SUB_EVENTS.compareRemove,
          this.handleCompareRemove.bind(this),
        );

        const storedProducts = getCompareProducts();
        const isChecked = this.productHandle in storedProducts;
        this.setChecked(isChecked);
      }

      disconnectedCallback() {
        this.unsubscribeUrlUpdated?.();
        this.unsubscribeRemove?.();
      }

      handleUrlUpdate(event) {
        if (this.alertLink && event.url) {
          this.alertLink.setAttribute("href", event.url);
          this.alertLink.dataset.modal = event.useModal;
        } else if (this.alertLink) {
          this.alertLink.removeAttribute("href");
        }
        this.setDisabled(false);
      }

      handleCompareRemove(event) {
        const handle = event.detail?.handle;
        if (handle && handle === this.productHandle) {
          this.setChecked(false);
        }
      }

      onChange(event) {
        const isChecked = event.target.checked;

        if (isChecked) {
          // Hide any other visible alerts
          document.querySelectorAll("product-compare-checkbox").forEach((el) => {
            if (el !== this && el.alert && el.alert.classList.contains("visible")) {
              el.alert.classList.remove("visible");
            }
          });

          const storedProducts = getCompareProducts();
          const productCount = Object.keys(storedProducts).length;
          const maxProducts = parseInt(
            document.querySelector("product-compare-buttons")?.dataset.maxProducts || "5",
            10,
          );

          if (productCount >= maxProducts) {
            event.target.checked = false;
            alert(window.productCompareStrings.maxProductsAlert.replace("[max]", maxProducts));
            return;
          }
        }

        const eventName = isChecked ? PUB_SUB_EVENTS.compareAdd : PUB_SUB_EVENTS.compareRemove;

        publish(eventName, {
          detail: {
            id: this.productId,
            handle: this.productHandle,
            title: this.productTitle,
            url: this.productUrl,
          },
        });

        if (isChecked && this.alert) {
          this.alert.classList.add("visible");
          setTimeout(() => {
            this.alert?.classList.remove("visible");
          }, 2500);
        } else if (this.alert) {
          this.alert.classList.remove("visible");
        }
      }

      setChecked(state) {
        if (this.checkbox && this.checkbox.checked !== state) {
          this.checkbox.checked = state;
        }
      }

      setDisabled(state) {
        if (this.checkbox) {
          this.checkbox.disabled = state;
          this.checkbox.setAttribute("aria-disabled", state);
        }
      }
    },
  );
}

if (!customElements.get("product-compare")) {
  customElements.define(
    "product-compare",
    class ProductCompare extends HTMLElement {
      constructor() {
        super();
        this.sectionId = this.dataset.sectionId;
        this.container = this.querySelector(".product-compare-grid");
        this.handleDismiss = this.handleDismissClick.bind(this);
      }

      async connectedCallback() {
        this.updateColumnCount();
        await this.loadComparisonProducts();

        if (!Shopify.designMode) {
          this.removeEmptyLines();
        } else {
          this.classList.add("is-loaded");
        }
        this.container.addEventListener("click", this.handleDismiss);
        this.updateDismissButtonVisibility();
      }

      disconnectedCallback() {
        this.container.removeEventListener("click", this.handleDismiss);
      }

      handleDismissClick(event) {
        const dismissButton = event.target.closest(".product-dismiss-button");
        if (!dismissButton) {
          return;
        }

        const productColumn = dismissButton.closest(".product-compare-product");
        const handle = productColumn?.dataset.handle;

        if (!handle || !productColumn) {
          return;
        }

        try {
          let products = getCompareProducts();
          if (handle in products) {
            delete products[handle];
            sessionStorage.setItem("compare-products", JSON.stringify(products));
          }
        } catch (e) {
          console.error("Failed to update session storage on dismiss:", e);
        }

        publish(PUB_SUB_EVENTS.compareRemove, { detail: { handle: handle } });
        productColumn.remove();

        this.updateColumnCount();
        this.updateDismissButtonVisibility();
        if (!Shopify.designMode) {
          this.removeEmptyLines();
        }

        const modal = this.closest("product-compare-modal");
        const remainingProducts = this.container.querySelectorAll(
          ".product-compare-product",
        ).length;

        if (modal && remainingProducts <= 1) {
          modal.hide();
        }
      }

      updateColumnCount() {
        const productCols = this.container.querySelectorAll(".product-compare-product");
        this.container.style.setProperty("--compare-product-count", productCols.length);
      }

      updateDismissButtonVisibility() {
        const productCols = this.container.querySelectorAll(".product-compare-product");
        const dismissButtons = this.container.querySelectorAll(".product-dismiss-button");
        const showButtons = productCols.length > 1;

        dismissButtons.forEach((button) => {
          button.hidden = !showButtons;
        });
      }

      removeEmptyLines() {
        const linesCount = Number(this.container.style.getPropertyValue("--compare-row-count"));
        if (!linesCount || linesCount === 0) {
          return;
        }

        this.container.querySelectorAll(".product-compare-value").forEach((cell) => {
          cell.dataset.isEmpty =
            cell.innerText.trim() === "" &&
            cell.querySelectorAll("img, iframe, video").length === 0;
        });

        for (let i = 1; i <= linesCount; i++) {
          const cellsInRow = this.container.querySelectorAll(
            `.product-compare-item-row[data-index="${i}"]`,
          );
          if (cellsInRow.length === 0) continue;

          let rowHasContent = false;
          cellsInRow.forEach((cell) => {
            if (cell.classList.contains("product-compare-label")) {
              // Do thing. The label shouldn't determine whether the values will be shown.
            } else if (cell.classList.contains("product-compare-value")) {
              if (cell.dataset.isEmpty !== "true") {
                rowHasContent = true;
              }
            } else {
              if (cell.innerText.trim() !== "") {
                rowHasContent = true;
              }
            }
          });

          if (!rowHasContent) {
            cellsInRow.forEach((cell) => cell.classList.add("compare-row-hidden"));
          } else {
            cellsInRow.forEach((cell) => cell.classList.remove("compare-row-hidden"));
          }
        }
      }

      async loadComparisonProducts() {
        let productHandles = [];

        if (this.dataset.handles) {
          try {
            productHandles = JSON.parse(this.dataset.handles);
          } catch (e) {
            productHandles = [];
          }
        } else {
          const urlParams = new URLSearchParams(window.location.search);
          productHandles = urlParams.getAll("handles");
        }

        if (!productHandles.length) {
          this.updateColumnCount();
          this.classList.add("is-loaded");

          if (!Shopify.designMode) {
            this.removeEmptyLines();
          }

          return;
        }

        this.querySelectorAll(".product-compare-item-preview").forEach((element) => {
          element.remove();
        });

        let baseProductPath = "/products";
        if (window.routes.root_url !== "/") {
          baseProductPath = window.routes.root_url + "/products";
        }

        const fetchPromises = productHandles.map((handle) => {
          const url = new URL(`${baseProductPath}/${handle}`, window.shopUrl);
          url.searchParams.set("view", "compare");
          url.searchParams.set("section_id", this.sectionId);
          return fetch(url.href.replace(window.shopUrl, ""));
        });

        try {
          const responses = await Promise.all(fetchPromises);

          const textPromises = responses.map((response) => {
            if (!response.ok) {
              console.error(`Failed to load product: ${response.url}, Status: ${response.status}`);
              return Promise.resolve(null);
            }
            return response.text();
          });

          const htmlContents = await Promise.all(textPromises);

          const productElements = htmlContents
            .map((html) => {
              if (!html) {
                return null;
              }

              const parser = new DOMParser();
              const doc = parser.parseFromString(html, "text/html");
              return doc.querySelector(".product-compare-product");
            })
            .filter((element) => element !== null);

          productElements.forEach((productElement) => {
            this.container.appendChild(productElement);
          });
        } catch (error) {
          console.error("Error processing comparison products:", error);
        }

        this.updateColumnCount();

        if (!Shopify.designMode) {
          this.removeEmptyLines();
        } else {
          this.hidePreviewIfEnoughProducts();
        }

        this.classList.add("is-loaded");
      }

      hidePreviewIfEnoughProducts() {
        // In design mode, hide the placeholder if there are 2 or more real products
        const realProducts = this.container.querySelectorAll(
          ".product-compare-product:not(.product-compare-item-preview)",
        );
        const placeholder = this.container.querySelector(".product-compare-item-preview");

        if (placeholder && realProducts.length >= 2) {
          placeholder.style.display = "none";
          this.container.style.setProperty(
            "--compare-product-count",
            realProducts.length.toString(),
          );
        }
      }
    },
  );
}

if (!customElements.get("product-compare-modal")) {
  customElements.define(
    "product-compare-modal",
    class ProductCompareModal extends ModalDialog {
      constructor() {
        super();
        this.contentArea = this.querySelector(".product-compare-modal-dialog-content");
        this.spinner = this.querySelector(".spinner");
        this.cssAssets = [];
        this.jsAssets = ["product-form.js"];
      }

      connectedCallback() {
        super.connectedCallback();

        this.addEventListener("click", (event) => {
          if (event.target.classList.contains("modal-dialog-wrap")) {
            this.hide();
          }
        });
      }

      show(opener) {
        super.show(opener);
        this.classList.add("is-loading");
        this.loadContent();
      }

      hide() {
        if (this.contentArea && this.spinner) {
          HTMLUpdateUtility.setInnerHTML(this.contentArea, this.spinner.outerHTML);
        }
        this.classList.remove("is-loading");
        super.hide();
      }

      async loadContent() {
        if (!this.dataset.url || !this.contentArea) {
          console.error("Missing URL, content area.");
          this.classList.remove("is-loading");
          return;
        }

        HTMLUpdateUtility.setInnerHTML(this.contentArea, this.spinner.outerHTML);
        this.classList.add("is-loading");

        try {
          const baseCompareUrl = new URL(this.dataset.url, window.location.origin);
          const baseCompareUrlParams = new URLSearchParams(baseCompareUrl.search);
          const productHandles = baseCompareUrlParams.getAll("handles");
          let sectionId = baseCompareUrlParams.get("section_id");

          const baseResponse = await fetch(baseCompareUrl.pathname + baseCompareUrl.search);
          if (!baseResponse.ok) {
            throw new Error(`Failed to fetch base comparison page: ${baseResponse.status}`);
          }

          const baseHtml = await baseResponse.text();
          const baseParser = new DOMParser();
          const baseDoc = baseParser.parseFromString(baseHtml, "text/html");
          const compareContentBase = baseDoc.querySelector(".product-compare-page");

          const productCompareElementBase = compareContentBase.querySelector("product-compare");

          sectionId = sectionId || productCompareElementBase.dataset.sectionId;

          if (!sectionId) {
            throw new Error("No section ID.");
          }

          let baseProductPath = "/products";
          if (window.routes.root_url !== "/") {
            baseProductPath = window.routes.root_url + "/products";
          }

          const additionalProductFetchPromises = productHandles.map((handle) => {
            const productUrl = new URL(`${baseProductPath}/${handle}`, window.shopUrl);
            productUrl.searchParams.set("view", "compare");
            productUrl.searchParams.set("section_id", sectionId);
            return fetch(productUrl.href.replace(window.shopUrl, ""));
          });

          const additionalResponsesSettled = await Promise.allSettled(
            additionalProductFetchPromises,
          );

          const productGrid = compareContentBase.querySelector(".product-compare-grid");

          const textPromises = [];
          additionalResponsesSettled.forEach((result, index) => {
            if (result.status === "fulfilled" && result.value.ok) {
              textPromises.push(
                result.value
                  .text()
                  .then((html) => {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, "text/html");
                    return doc.querySelector(".product-compare-product");
                  })
                  .catch((err) => {
                    console.error(`Error reading text for handle ${productHandles[index]}:`, err);
                    return null;
                  }),
              );
            } else if (result.status === "fulfilled") {
              console.warn(
                `Failed to load product: ${result.value.url}, Status: ${result.value.status}`,
              );
              textPromises.push(Promise.resolve(null));
            } else {
              console.error(
                `Failed to fetch product handle ${productHandles[index]}:`,
                result.reason,
              );
              textPromises.push(Promise.resolve(null));
            }
          });

          const additionalProductElements = await Promise.all(textPromises);

          // Append valid elements to the grid in memory
          additionalProductElements.forEach((productElement) => {
            if (productElement) {
              productGrid.appendChild(productElement);
            }
          });

          // Inject final content and adjust the layout
          HTMLUpdateUtility.setInnerHTML(this.contentArea, compareContentBase.outerHTML);

          const finalCompareElement = this.contentArea.querySelector("product-compare");

          if (finalCompareElement) {
            if (typeof finalCompareElement.updateColumnCount === "function") {
              finalCompareElement.updateColumnCount();
            }

            if (!Shopify.designMode && typeof finalCompareElement.removeEmptyLines === "function") {
              finalCompareElement.removeEmptyLines();
            }

            if (
              Shopify.designMode &&
              typeof finalCompareElement.hidePreviewIfEnoughProducts === "function"
            ) {
              finalCompareElement.hidePreviewIfEnoughProducts();
            }

            this.loadAssets(baseDoc);
          }
        } catch (error) {
          console.error("Error loading or assembling comparison content:", error);
        } finally {
          this.classList.remove("is-loading");
        }
      }

      loadAssets(html) {
        this.cssAssets.forEach((asset) => {
          const links = html.querySelectorAll(`link[href*="${asset}"]`);
          links.forEach((link) => {
            const href = link.getAttribute("href");
            if (!document.querySelector(`link[href="${href}"]`)) {
              const newLink = document.createElement("link");
              newLink.href = href;
              newLink.rel = link.getAttribute("rel") || "stylesheet";
              newLink.type = link.getAttribute("type");
              newLink.media = link.getAttribute("media");
              document.head.appendChild(newLink);
            }
          });
        });

        this.jsAssets.forEach((asset) => {
          const scripts = html.querySelectorAll(`script[src*="${asset}"]`);
          scripts.forEach((script) => {
            const src = script.getAttribute("src");
            if (!document.querySelector(`script[src="${src}"]`)) {
              const newScript = document.createElement("script");
              newScript.src = src;
              if (script.hasAttribute("defer")) {
                newScript.defer = true;
              }
              document.head.appendChild(newScript);
            }
          });
        });
      }
    },
  );
}

/**
 * Helper method to get products for comparison from local state
 * @returns {any}
 */
function getCompareProducts() {
  let data = sessionStorage.getItem("compare-products");
  try {
    data = JSON.parse(data);
    if (!data || typeof data !== "object") {
      data = {};
    }
  } catch (e) {
    data = {};
  }
  return data;
}
