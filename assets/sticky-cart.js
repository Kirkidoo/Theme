if (!customElements.get("sticky-cart")) {
  customElements.define(
    "sticky-cart",
    class StickyCart extends HTMLElement {
      constructor() {
        super();

        this.sectionId = this.dataset.sectionId;
        this.triggerType = this.dataset.triggerType;
        this.triggerOffset = parseInt(this.dataset.triggerOffset) || 500;
        this.showImage = this.dataset.showImage === "true";
        this.loginForPrice = this.dataset.loginForPrice === "true";

        this.container = this.querySelector(".sticky-cart__container");
        this.imageSlot = this.querySelector("[data-sticky-cart-image]");
        this.titleSlot = this.querySelector("[data-sticky-cart-title]");
        this.priceSlot = this.querySelector("[data-sticky-cart-price]");
        this.quantitySlot = this.querySelector("[data-sticky-cart-quantity]");
        this.buttonSlot = this.querySelector("[data-sticky-cart-button]");
        this.errorSlot = this.querySelector("[data-sticky-cart-error]");

        this.mobileDock = null;
        this.mainProductSection = null;
        this.mainAddToCartButton = null;
        this.mainProductForm = null;
        this.mainQuantityInput = null;
        this.productHasVariants = false;

        this.selectOptionsText = this.dataset.selectOptionsText;
        this.errorFadeTimeout = null;
        this.unsubscribeVariantChange = null;

        this.init();
      }

      init() {
        // Don't show if login is required to view price
        if (this.loginForPrice) {
          this.style.display = "none";
          return;
        }

        // Only initialize on product pages
        if (!this.findProductElements()) {
          this.style.display = "none";
          return;
        }

        this.detectMobileDock();
        this.cloneProductContent();
        this.setupScrollDetection();
        this.setupEventListeners();
        this.setupErrorMessageSync();
        this.setupResizeListener();

        // Subscribe to variant changes
        this.unsubscribeVariantChange = subscribe(PUB_SUB_EVENTS.productVariantChange, (data) => {
          this.reinitializeAfterVariantChange();
        });
      }

      findProductElements() {
        // Find the main product section
        this.mainProductSection = document.querySelector(".product-info-wrap");
        if (!this.mainProductSection) return false;

        // Find the product form
        this.mainProductForm = this.mainProductSection.querySelector("product-form");
        if (!this.mainProductForm) return false;

        // Find the add to cart button
        this.mainAddToCartButton = this.mainProductForm.querySelector(".button-add-to-cart");

        // Find the main quantity input
        this.mainQuantityInput = this.mainProductForm.querySelector(".quantity-input-field");

        // Check if product has variants
        const variantPicker = this.mainProductSection.querySelector(
          "variant-radios, variant-selects",
        );
        this.productHasVariants =
          variantPicker && !variantPicker.closest(".product-variants.variants-hidden");

        return true;
      }

      detectMobileDock() {
        this.mobileDock = document.getElementById("mobile-dock");
        if (this.mobileDock) {
          this.classList.add("has-mobile-dock");
          this.updateBottomPosition();

          // Watch for mobile dock height changes
          const resizeObserver = new ResizeObserver(() => {
            this.updateBottomPosition();
          });
          resizeObserver.observe(this.mobileDock);
        }
      }

      updateBottomPosition() {
        if (this.mobileDock) {
          const dockHeight = this.mobileDock.offsetHeight;
          this.style.bottom = `${dockHeight}px`;
        } else {
          this.style.bottom = "0";
        }
      }

      cloneProductContent() {
        this.cloneProductImage();
        this.cloneProductTitle();
        this.cloneProductPrice();

        if (this.productHasVariants) {
          // Hide price for variant products
          if (this.priceSlot) {
            this.priceSlot.style.display = "none";
          }
          this.createSelectOptionsButton();
        } else {
          this.cloneQuantityInput();
          this.cloneAddToCartButton();
        }
      }

      cloneProductImage() {
        if (!this.showImage || !this.imageSlot) return;
        const mainImage = this.mainProductSection.querySelector(
          ".product-media-main.is-active img",
        );
        if (mainImage) {
          const imgClone = document.createElement("img");
          imgClone.src = mainImage.src;
          imgClone.alt = mainImage.alt || "";
          imgClone.loading = "lazy";
          this.imageSlot.appendChild(imgClone);
        }
      }

      cloneProductTitle() {
        const mainTitle = this.mainProductSection.querySelector(".product-info-heading");
        if (mainTitle && this.titleSlot) {
          this.titleSlot.textContent = mainTitle.textContent.trim();
        }
      }

      cloneProductPrice() {
        const priceElement = this.mainProductSection.querySelector('[id^="price-"]');
        if (priceElement && this.priceSlot) {
          const priceClone = priceElement.cloneNode(true);
          priceClone.removeAttribute("id");
          this.priceSlot.appendChild(priceClone);
        }
      }

      cloneQuantityInput() {
        if (!this.quantitySlot) return;
        const mainQuantity = this.mainProductForm.querySelector("quantity-input");
        if (mainQuantity) {
          const quantityClone = mainQuantity.cloneNode(true);

          // Remove IDs to avoid conflicts
          const inputs = quantityClone.querySelectorAll("[id]");
          inputs.forEach((input) => input.removeAttribute("id"));

          this.quantitySlot.appendChild(quantityClone);

          // Store reference to sticky quantity input
          this.stickyQuantityInput = quantityClone.querySelector(".quantity-input-field");

          // Sync quantity changes
          this.setupQuantitySync(quantityClone);
        }
      }

      cloneAddToCartButton() {
        if (!this.buttonSlot || !this.mainAddToCartButton) return;

        const buttonClone = document.createElement("button");
        buttonClone.type = "button";
        buttonClone.className = this.mainAddToCartButton.className;
        buttonClone.innerHTML = this.mainAddToCartButton.innerHTML;

        // Remove any IDs
        buttonClone.removeAttribute("id");

        // Sync initial disabled state
        if (
          this.mainAddToCartButton.disabled ||
          this.mainAddToCartButton.hasAttribute("disabled")
        ) {
          buttonClone.disabled = true;
          buttonClone.setAttribute("disabled", "");
        }

        // When clicked, sync quantity first then trigger the main form submission
        buttonClone.addEventListener("click", (e) => {
          e.preventDefault();
          if (!buttonClone.disabled && this.mainAddToCartButton) {
            // Force sync quantity before submitting
            if (this.stickyQuantityInput && this.mainQuantityInput) {
              this.mainQuantityInput.value = this.stickyQuantityInput.value;
            }
            this.mainAddToCartButton.click();
            // Sync loading state periodically
            this.syncButtonLoadingState();
          }
        });

        this.buttonSlot.appendChild(buttonClone);
        this.stickyAddToCartButton = buttonClone;
      }

      syncButtonLoadingState() {
        if (!this.stickyAddToCartButton || !this.mainAddToCartButton) return;
        const stickySpinner = this.stickyAddToCartButton.querySelector(".button-overlay-spinner");
        if (!stickySpinner) return;

        if (this.mainAddToCartButton.classList.contains("loading")) {
          this.stickyAddToCartButton.classList.add("loading");
          stickySpinner.classList.remove("hidden");
        } else {
          this.stickyAddToCartButton.classList.remove("loading");
          stickySpinner.classList.add("hidden");
        }
      }

      createSelectOptionsButton() {
        if (!this.buttonSlot) return;
        const selectButton = document.createElement("button");
        selectButton.type = "button";
        selectButton.className = "button button-secondary button-select-options";
        selectButton.textContent = this.selectOptionsText;

        selectButton.addEventListener("click", () => {
          this.scrollToProductForm();
        });

        this.buttonSlot.appendChild(selectButton);

        // Hide quantity slot since we're showing select options
        if (this.quantitySlot) {
          this.quantitySlot.style.display = "none";
        }
      }

      scrollToProductForm() {
        const productInfo = document.querySelector(".product-info");
        if (productInfo) {
          const headerOffset = this.getHeaderOffset();
          const elementPosition = productInfo.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - headerOffset - 20;

          window.scrollTo({
            top: offsetPosition,
            behavior: "smooth",
          });
        }
      }

      getHeaderOffset() {
        const header = document.querySelector('[id^="shopify-section-"][class*="section-header"]');
        if (
          header &&
          (header.classList.contains("section-header-sticky-always") ||
            header.classList.contains("section-header-sticky"))
        ) {
          return header.offsetHeight;
        }
        return 0;
      }

      setupQuantitySync(stickyQuantity) {
        if (!this.mainQuantityInput || !this.stickyQuantityInput) return;

        let isSyncing = false;

        // Sync function to avoid duplication
        const syncStickyToMain = () => {
          if (isSyncing) return;
          isSyncing = true;
          this.mainQuantityInput.value = this.stickyQuantityInput.value;
          this.mainQuantityInput.dispatchEvent(new Event("change", { bubbles: true }));
          setTimeout(() => {
            isSyncing = false;
          }, 10);
        };

        const syncMainToSticky = () => {
          if (isSyncing) return;
          isSyncing = true;
          this.stickyQuantityInput.value = this.mainQuantityInput.value;
          setTimeout(() => {
            isSyncing = false;
          }, 10);
        };

        // Sync sticky to main on input and change
        this.stickyQuantityInput.addEventListener("input", syncStickyToMain);
        this.stickyQuantityInput.addEventListener("change", syncStickyToMain);

        // Sync main to sticky on input and change
        this.mainQuantityInput.addEventListener("input", syncMainToSticky);
        this.mainQuantityInput.addEventListener("change", syncMainToSticky);

        // Watch for attribute changes (some quantity inputs update via setAttribute)
        const stickyObserver = new MutationObserver(() => {
          syncStickyToMain();
        });

        stickyObserver.observe(this.stickyQuantityInput, {
          attributes: true,
          attributeFilter: ["value"],
        });

        const mainObserver = new MutationObserver(() => {
          syncMainToSticky();
        });

        mainObserver.observe(this.mainQuantityInput, {
          attributes: true,
          attributeFilter: ["value"],
        });
      }

      setupScrollDetection() {
        if (this.triggerType === "scroll_past_button") {
          this.setupIntersectionObserver();
        } else {
          this.setupScrollListener();
        }
      }

      setupIntersectionObserver() {
        if (!this.mainAddToCartButton && !this.buttonSlot.querySelector(".button-select-options"))
          return;
        const targetButton = this.mainAddToCartButton || this.mainProductForm;
        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                this.hide();
              } else if (entry.boundingClientRect.top < 0) {
                this.show();
              }
            });
          },
          {
            threshold: 0,
            rootMargin: "0px",
          },
        );
        observer.observe(targetButton);
      }

      setupScrollListener() {
        let ticking = false;
        window.addEventListener("scroll", () => {
          if (!ticking) {
            window.requestAnimationFrame(() => {
              if (window.scrollY > this.triggerOffset) {
                this.show();
              } else {
                this.hide();
              }
              ticking = false;
            });
            ticking = true;
          }
        });
      }

      setupEventListeners() {
        // Listen for cart additions to sync button state
        document.addEventListener("cart:item-add", () => {
          // Reset button state after successful add to cart
          this.resetButtonState();
        });

        // Sync button loading state during submission
        if (this.mainProductForm) {
          this.mainProductForm.addEventListener("submit", () => {
            const loadingSync = setInterval(() => {
              this.syncButtonLoadingState();
              // Stop syncing after button is no longer loading
              if (!this.mainAddToCartButton.classList.contains("loading")) {
                clearInterval(loadingSync);
              }
            }, 50);
          });
        }
      }

      reinitializeAfterVariantChange() {
        // Refresh element references (DOM gets replaced via AJAX)
        this.findProductElements();

        // Update the variant image and refresh error sync
        this.updateVariantImage();
        this.setupErrorMessageSync();

        //Setup scroll detection to watch the new button after AJAX
        this.setupScrollDetection();
      }

      updateVariantImage() {
        if (!this.showImage || !this.imageSlot) return;

        const mainImage = this.mainProductSection.querySelector(
          ".product-media-main.is-active img",
        );
        const currentImg = this.imageSlot.querySelector("img");

        if (mainImage && currentImg) {
          currentImg.src = mainImage.src;
          currentImg.alt = mainImage.alt || "";
        }
      }

      updatePrice() {
        const mainPrice = this.mainProductSection.querySelector('[id^="price-"]');
        if (mainPrice && this.priceSlot) {
          const priceClone = mainPrice.cloneNode(true);
          priceClone.removeAttribute("id");
          this.priceSlot.innerHTML = "";
          this.priceSlot.appendChild(priceClone);
        }
      }

      updateButtonState() {
        if (!this.stickyAddToCartButton || !this.mainAddToCartButton) return;
        const mainButton = this.mainAddToCartButton;

        // Sync disabled state and attribute
        if (mainButton.disabled || mainButton.hasAttribute("disabled")) {
          this.stickyAddToCartButton.disabled = true;
          this.stickyAddToCartButton.setAttribute("disabled", "");
        } else {
          this.stickyAddToCartButton.disabled = false;
          this.stickyAddToCartButton.removeAttribute("disabled");
        }

        // Sync button text
        const mainButtonText = mainButton.querySelector("span");
        const stickyButtonText = this.stickyAddToCartButton.querySelector("span");
        if (mainButtonText && stickyButtonText) {
          stickyButtonText.textContent = mainButtonText.textContent;
        }
      }

      updateImage(media) {
        if (!this.imageSlot) return;
        const img = this.imageSlot.querySelector("img");
        if (img && media.preview_image) {
          img.src = media.preview_image.src;
          img.alt = media.alt || "";
        }
      }

      resetButtonState() {
        if (this.stickyAddToCartButton) {
          const spinner = this.stickyAddToCartButton.querySelector(".button-overlay-spinner");
          if (spinner) {
            spinner.classList.add("hidden");
          }
          this.stickyAddToCartButton.classList.remove("loading");
          this.stickyAddToCartButton.removeAttribute("aria-disabled");
        }
      }

      show() {
        this.classList.add("is-visible");
        this.adjustBodyPadding();
        this.adjustButtonTopPosition();
      }

      hide() {
        this.classList.remove("is-visible");
        this.adjustBodyPadding();
        this.adjustButtonTopPosition();
      }

      adjustButtonTopPosition() {
        const buttonTop = document.querySelector(".button-top");
        if (!buttonTop) return;

        if (this.classList.contains("is-visible")) {
          const stickyCartHeight = this.offsetHeight;
          buttonTop.style.bottom = `${stickyCartHeight + 20}px`;
        } else {
          buttonTop.style.bottom = "20px";
        }
      }

      adjustBodyPadding() {
        if (this.classList.contains("is-visible")) {
          const stickyCartHeight = this.offsetHeight;
          document.body.style.paddingBottom = `${stickyCartHeight}px`;
        } else {
          document.body.style.paddingBottom = "";
        }
      }

      setupResizeListener() {
        let resizeTimeout;
        window.addEventListener("resize", () => {
          clearTimeout(resizeTimeout);
          resizeTimeout = setTimeout(() => {
            this.adjustBodyPadding();
            this.adjustButtonTopPosition();
          }, 150);
        });

        // Handle sticky cart height changes (error messages, content updates)
        const stickyCartResizeObserver = new ResizeObserver(() => {
          if (this.classList.contains("is-visible")) {
            this.adjustBodyPadding();
            this.adjustButtonTopPosition();
          }
        });
        stickyCartResizeObserver.observe(this);
      }

      setupErrorMessageSync() {
        if (!this.mainProductForm || !this.errorSlot) return;
        const mainErrorWrapper = this.mainProductForm.querySelector(
          ".product-form-error-message-wrapper",
        );
        if (!mainErrorWrapper) return;

        // Watch for error message changes
        const observer = new MutationObserver(() => {
          this.syncErrorMessage(mainErrorWrapper);
        });

        observer.observe(mainErrorWrapper, {
          attributes: true,
          attributeFilter: ["hidden"],
          childList: true,
          subtree: true,
        });

        // Initial sync
        this.syncErrorMessage(mainErrorWrapper);
      }

      syncErrorMessage(mainErrorWrapper) {
        if (!this.errorSlot) return;

        // Clear previous timeout
        clearTimeout(this.errorFadeTimeout);
        const isHidden = mainErrorWrapper.hasAttribute("hidden");
        this.errorSlot.style.transition = "opacity 0.3s ease";

        if (isHidden) {
          this.errorSlot.innerHTML = "";
          this.errorSlot.style.opacity = "1";
          return;
        }

        // Insert fresh error content
        const errorClone = mainErrorWrapper.cloneNode(true);
        this.errorSlot.innerHTML = "";
        this.errorSlot.appendChild(errorClone);
        this.errorSlot.style.opacity = "1";

        // Schedule fade out
        this.errorFadeTimeout = setTimeout(() => {
          this.errorSlot.style.opacity = "0";
          const onTransitionEnd = () => {
            this.errorSlot.innerHTML = "";
            this.errorSlot.style.opacity = "1";
            this.errorSlot.removeEventListener("transitionend", onTransitionEnd);
          };
          this.errorSlot.addEventListener("transitionend", onTransitionEnd);
        }, 5000);
      }

      disconnectedCallback() {
        if (this.unsubscribeVariantChange) {
          this.unsubscribeVariantChange();
        }
      }
    },
  );
}
