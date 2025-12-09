if (!customElements.get("bulk-order-list")) {
  customElements.define(
    "bulk-order-list",
    class BulkOrderList extends BulkAdd {
      cartUpdateUnsubscriber = undefined;
      hasPendingQuantityUpdate = false;
      constructor() {
        super();
      }

      connectedCallback() {
        this.cartUpdateUnsubscriber = subscribe(PUB_SUB_EVENTS.cartUpdate, async (event) => {
          // skip if cart event was triggered by this section
          if (event.source === this.id) return;

          await this.refresh();
        });

        this.initEventListeners();
      }

      disconnectedCallback() {
        this.cartUpdateUnsubscriber?.();
      }

      initEventListeners() {
        this.querySelectorAll("a.page-number").forEach((link) => {
          link.addEventListener("click", async (event) => {
            event.preventDefault();
            event.stopPropagation();

            const url = new URL(event.currentTarget.href);

            await this.refresh(url.searchParams.get("page") || "1");
            this.scrollTop();
          });
        });

        this.bulkOrderListTable.addEventListener(
          "keydown",
          this.handleSwitchVariantOnEnter.bind(this),
        );

        this.initVariantEventListeners();
      }

      initVariantEventListeners() {
        this.allInputsArray = Array.from(this.querySelectorAll('input[type="number"]'));

        this.querySelectorAll("quantity-input").forEach((qty) => {
          const debouncedOnChange = debounce(
            this.onChange.bind(this),
            BulkAdd.ASYNC_REQUEST_DELAY,
            false,
          );
          qty.addEventListener("change", (event) => {
            this.hasPendingQuantityUpdate = true;
            debouncedOnChange(event);
          });
        });

        this.querySelectorAll(".bulk-order-list-remove-button").forEach((button) => {
          button.addEventListener("click", (event) => {
            event.preventDefault();
            // this.toggleLoading(true);
            this.startQueue(button.dataset.index, 0);
          });
        });

        this.removeAllButton.addEventListener("click", this.handleRemoveAll.bind(this));
      }

      get currentPage() {
        return this.querySelector(".pagination")?.dataset?.page ?? "1";
      }

      get cartVariantsForProduct() {
        return JSON.parse(this.querySelector("[data-cart-contents]")?.innerHTML || "[]");
      }

      get removeAllButton() {
        return this.querySelector("button.bulk-order-remove-product-from-cart");
      }

      handleRemoveAll(event) {
        event.preventDefault();
        const items = this.cartVariantsForProduct.reduce(
          (acc, variantId) => ({ ...acc, [variantId]: 0 }),
          {},
        );

        this.updateMultipleQty(items);
      }

      onChange(event) {
        const inputValue = parseInt(event.target.value);
        // this.cleanErrorMessageOnType(event);
        if (inputValue == 0) {
          event.target.setAttribute("value", inputValue);
          this.startQueue(event.target.dataset.index, inputValue);
        } else {
          this.validateQuantity(event);
        }
      }

      setLoading(loading = false, element) {
        const progressBar = element.querySelector(".qty-progress-bar-container");
        const spinner = element.querySelector(".spinner");
        const checkmark = element.querySelector(".quantity-success-check");

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

      validateInput(target) {
        const targetValue = parseInt(target.value);
        const targetMin = parseInt(target.dataset.min);
        const targetStep = parseInt(target.step);

        if (target.max) {
          return (
            targetValue == 0 ||
            (targetValue >= targetMin &&
              targetValue <= parseInt(target.max) &&
              targetValue % targetStep == 0)
          );
        } else {
          return targetValue == 0 || (targetValue >= targetMin && targetValue % targetStep == 0);
        }
      }

      get bulkOrderListTable() {
        return this.querySelector("table");
      }

      getSectionsToRender() {
        return [
          {
            id: this.id,
            section: this.dataset.section,
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

      async refresh(pageNumber = null) {
        const url = this.dataset.url || window.location.pathname;

        return fetch(
          `${url}?section_id=${this.dataset.section}&page=${pageNumber || this.currentPage}`,
        )
          .then((response) => response.text())
          .then((responseText) => {
            const html = new DOMParser().parseFromString(responseText, "text/html");
            const responseBulkOrderList = html.querySelector(`#${this.id}`);

            if (!responseBulkOrderList) {
              return;
            }

            this.innerHTML = responseBulkOrderList.innerHTML;
            this.initEventListeners();
          })
          .catch((e) => {
            console.error(e);
          });
      }

      getSectionElement(html, selector = ".shopify-section") {
        return new DOMParser().parseFromString(html, "text/html").querySelector(selector);
      }

      renderSections(parsedState) {
        const { items, sections } = parsedState;

        this.getSectionsToRender().forEach(({ id, selector, section }) => {
          const sectionElement = document.getElementById(id);
          if (!sectionElement) {
            return;
          }

          const newSection = this.getSectionElement(sections[section], selector);

          if (section === this.dataset.section) {
            if (this.queue.length > 0 || this.hasPendingQuantityUpdate) {
              return;
            }

            const focusedElement = document.activeElement;
            let focusTarget = focusedElement?.dataset?.target;
            if (focusTarget?.includes("remove")) {
              focusTarget = focusedElement
                .closest("quantity-input")
                ?.querySelector('[data-target*="increment-"]')?.dataset.target;
            }

            const total = this.getTotalBar();
            if (total) {
              total.innerHTML = newSection.querySelector(".bulk-order-list-total").innerHTML;
            }

            const table = this.bulkOrderListTable;
            const newTable = newSection.querySelector("table");

            // only update variants if they are from the active page
            const shouldUpdateVariants =
              this.currentPage === (newSection.querySelector(".pagination")?.dataset.page ?? "1");

            if (newTable && shouldUpdateVariants) {
              table.innerHTML = newTable.innerHTML;

              const newFocusTarget = this.querySelector(`[data-target='${focusTarget}']`);
              if (newFocusTarget) {
                newFocusTarget?.focus({ preventScroll: true });
              }

              this.initVariantEventListeners();
            }
          } else {
            const elementToReplace =
              document.getElementById(id).querySelector(selector) ?? document.getElementById(id);
            if (!elementToReplace) {
              return;
            }
            elementToReplace.innerHTML = newSection.innerHTML;
          }
        });
      }

      getTotalBar() {
        return this.querySelector(".bulk-order-list-total");
      }

      scrollTop() {
        const { top } = this.getBoundingClientRect();
        window.scrollTo({ top: top + window.scrollY, behavior: "instant" });
      }

      handleSwitchVariantOnEnter(event) {
        if (event.key !== "Enter" || event.target.tagName !== "INPUT") {
          return;
        }

        event.preventDefault();
        event.target.blur();

        if (!this.validateInput(event.target) || this.allInputsArray.length <= 1) {
          return;
        }

        const currentIndex = this.allInputsArray.indexOf(event.target);
        const offset = event.shiftKey ? -1 : 1;
        const nextIndex =
          (currentIndex + offset + this.allInputsArray.length) % this.allInputsArray.length;

        this.allInputsArray[nextIndex]?.select();
        this.allInputsArray[nextIndex]?.scrollIntoView({
          block: "nearest",
          behavior: "instant",
        });
      }

      updateMultipleQty(items) {
        for (const [index, item] of Object.entries(items)) {
          const qtyInput = document.getElementById(`Quantity-${index}`).closest("quantity-input");
          this.setLoading(true, qtyInput);
        }

        if (this.queue.length == 0) {
          this.hasPendingQuantityUpdate = false;
        }

        const url = this.dataset.url || window.location.pathname;

        const body = JSON.stringify({
          updates: items,
          sections: this.getSectionsToRender().map(({ section }) => section),
          sections_url: `${url}?page=${this.currentPage}`,
        });

        fetch(`${routes.cart_update_url}`, { ...fetchConfig(), ...{ body } })
          .then((response) => response.text())
          .then(async (state) => {
            const parsedState = JSON.parse(state);
            this.renderSections(parsedState);
            publish(PUB_SUB_EVENTS.cartUpdate, {
              source: this.id,
              cartData: parsedState,
            });
          })
          .catch((e) => {
            console.error(e);
          })
          .finally(() => {
            // this.queue.length === 0 && this.toggleLoading(false);
            for (const [index, item] of Object.entries(items)) {
              const qtyInput = document
                .getElementById(`Quantity-${index}`)
                .closest("quantity-input");
              this.setLoading(false, qtyInput);
            }

            this.setRequestStarted(false);
          });
      }
    },
  );
}
