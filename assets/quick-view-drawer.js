if (!customElements.get("quick-view-drawer")) {
  customElements.define(
    "quick-view-drawer",
    class QuickViewDrawer extends DrawerModal {
      constructor() {
        super();
        this.fetchedUrls = {};
        this.cssAssets = [
          "section-main-product.css",
          "component-price.css",
          "component-tooltip.css",
          "component-deferred-media.css",
        ];
        this.jsAssets = ["media-gallery.js", "recipient-form.js"];
        this.selector = "quickview-drawer";
      }

      connectedCallback() {
        super.connectedCallback?.();
        this.drawerContent = this.querySelector(".drawer-content-inner");
        this.drawerFooter = this.querySelector(".drawer-footer");
      }

      open(opener) {
        super.open(opener);
        const card = opener.closest(".card-product, .product-row");
        const jsProductLink = card.querySelector(".js-product-link");
        this.productUrl = jsProductLink.getAttribute("href");
        this.loadProduct(this.productUrl);
      }

      close() {
        super.close();
        this.drawerContent.innerHTML = '<span class="spinner spinner-lg"></span>';
        this.drawerFooter.innerHTML = "";
      }

      async loadProduct(productUrl) {
        if (this.fetchedUrls[productUrl]) {
          this.renderProduct(this.fetchedUrls[productUrl]);
          return;
        }

        try {
          const response = await fetch(productUrl);
          const responseText = await response.text();
          const html = new DOMParser().parseFromString(responseText, "text/html");

          this.fetchedUrls[productUrl] = html;
          this.loadAssets(html);
          this.renderProduct(html);
        } catch (error) {
          console.error(error);
        }
      }

      renderProduct(html, variant) {
        const productPage = html.querySelector('[id^="ProductPage-template--"][id*="__main"]');
        const sectionId = productPage.dataset.sectionId;
        productPage.innerHTML = productPage.innerHTML.replaceAll(sectionId, this.selector);

        // In case of changing variations update existing elements
        // where possible, instead of re-rendering the entire page.
        if (this.querySelector("product-form") && variant) {
          this.handleUpdateProduct(productPage, sectionId, variant);
          return;
        }

        this.drawerContent.innerHTML = this.getQuickviewContentHtml(productPage, sectionId);
        this.drawerFooter.innerHTML = this.getProductFormHtml(productPage);
      }

      handleUpdateProduct(html, sectionId, variant) {
        this.drawerContent.innerHTML = this.getQuickviewContentHtml(html, sectionId);
        this.updateProductForm(html);
        this.updateVariantInput(variant);
      }

      updateProductForm(html) {
        const productFormSource = html.querySelector(`#product-form-${this.selector}`);
        const productFormDestination = document.querySelector(`#product-form-${this.selector}`);
        if (productFormSource && productFormDestination) {
          productFormDestination.outerHTML = productFormSource.outerHTML;
          // Reset opacity changed by VariantSelects.handleQuickviewUpdate()
          productFormDestination.style.opacity = "1";
        }
      }

      updateVariantInput(variant) {
        const productForms = this.querySelectorAll(
          `#product-form-${this.selector}, #product-form-installment`,
        );

        productForms.forEach((productForm) => {
          const input = productForm.querySelector('input[name="id"]');
          input.value = variant.id;
          input.dispatchEvent(new Event("change", { bubbles: true }));
        });
      }
      getQuickviewContentHtml(html, sectionId) {
        return `
          <div class="product-quick-view-header">
            ${this.getProductMediaGalleryHtml(html)}
            ${this.getProductInfoHtml(html)}
          </div>
          ${this.getProductVariantsHtml(html, sectionId)}
          ${this.getProductPriceHtml(html)}
        `;
      }

      getProductMediaGalleryHtml(html) {
        const gallery = html.querySelector(".product-media-gallery-wrap");

        if (!gallery) {
          return "";
        }

        gallery.querySelector(".product-media-gallery-message")?.remove();
        gallery.querySelector(".product-media-scroll-wrap")?.remove();
        gallery.querySelector("carousel-navigation")?.remove();
        gallery.querySelector("product-modal")?.remove();
        gallery
          .querySelectorAll(".deferred-media-poster-button")
          .forEach((button) => button.remove());
        gallery.querySelectorAll(".product-xr-button").forEach((button) => button.remove());

        // Optimize images:
        gallery.querySelectorAll("img").forEach((img) => {
          try {
            const width = 100;
            const src = img.getAttribute("src").split("&width=")[0];
            const aspectRatio = img.width / img.height;
            const newSrc1x = `${src}&width=${width}`;
            const newSrc2x = `${src}&width=${width * 2}`;
            img.setAttribute("src", newSrc1x);
            img.setAttribute("srcset", `${newSrc1x} 1x, ${newSrc2x} 2x`);
            img.removeAttribute("sizes");
            img.setAttribute("width", width * 2);
            img.setAttribute("height", Math.floor((width * 2) / aspectRatio));
          } catch (error) {
            console.error(error);
          }
        });

        return gallery.outerHTML;
      }

      getProductInfoHtml(html) {
        const productInfo = html.querySelector(".product-info-main");
        productInfo.querySelector(".product-info-meta-item.last")?.remove();
        productInfo.querySelector(".product-info-badges")?.remove();

        if (!productInfo.querySelector(".product-info-view-more")) {
          const fullDetailsButton = `
            <div class="product-info-view-more">
              <a href="${this.productUrl}" class="button-text-link">
                ${window.productsStrings.viewFullDetails}
                <span class="angle angle-right">
                  <span class="angle-icon"></span>
                </span>
              </a>
            </div>
          `;
          productInfo.insertAdjacentHTML("beforeend", fullDetailsButton);
        }

        return productInfo.outerHTML;
      }

      getProductVariantsHtml(html, sectionId) {
        const variants = html.querySelector(".product-variants");
        const variantsElement =
          variants?.querySelector("variant-radios") ||
          variants?.querySelector("variant-selects") ||
          null;
        if (variantsElement) {
          variantsElement.setAttribute("data-update-url", "false");
          // Reinstate the original section's id on the variants.
          variantsElement.setAttribute("data-section", sectionId);
        }

        if (variants) {
          return variants.outerHTML;
        } else {
          return "";
        }
      }

      getProductPriceHtml(html) {
        const productPrice = html.querySelector(".product-block-price");
        if (productPrice) {
          return productPrice.outerHTML;
        } else {
          return "";
        }
      }

      getProductFormHtml(html) {
        const productForm = html.querySelector(".product-block-product-form");
        const form = productForm?.querySelector("form");
        if (form) {
          form.setAttribute("data-event-context", "QuickViewDrawer");
        }

        if (productForm) {
          return productForm.outerHTML;
        } else {
          return "";
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
