"use strict";
if (window.lastViewedProductId) {
  let recentlyViewedProducts = getRecentlyViewedProducts();

  // Remove any entries of the same product. We only care about the latest (current) view.
  recentlyViewedProducts = recentlyViewedProducts.filter(
    (viewedProduct) => viewedProduct.id !== lastViewedProductId,
  );

  recentlyViewedProducts.push({
    timestamp: Date.now(),
    id: window.lastViewedProductId,
  });

  recentlyViewedProducts = saveRecentlyViewedProducts(recentlyViewedProducts);
}

function getRecentlyViewedProducts() {
  let recentlyViewedProducts = localStorage.getItem("recentlyViewedProducts");
  try {
    recentlyViewedProducts = JSON.parse(recentlyViewedProducts);
  } catch (error) {
    recentlyViewedProducts = [];
  }

  if (!recentlyViewedProducts) {
    recentlyViewedProducts = [];
  }

  return recentlyViewedProducts;
}

function saveRecentlyViewedProducts(recentlyViewedProducts) {
  // Keep twice the amount of the max number (12) of recently viewed products that can be displayed, in case some were removed.
  recentlyViewedProducts = recentlyViewedProducts.slice(-24);

  localStorage.setItem("recentlyViewedProducts", JSON.stringify(recentlyViewedProducts));

  return recentlyViewedProducts;
}

if (!customElements.get("recently-viewed-products")) {
  class RecentlyViewedProducts extends HTMLElement {
    constructor() {
      super();

      this.recentlyViewedProducts = getRecentlyViewedProducts();
      this.columns = parseInt(this.getAttribute("data-columns"), 10);
      this.fetched = false;
    }

    connectedCallback() {
      if (this.recentlyViewedProducts && !this.fetched) {
        this.fetch();
      }
    }

    fetch() {
      if (this.recentlyViewedProducts) {
        // Remove currently viewed product from array.
        const foundIndex = this.recentlyViewedProducts.findIndex(
          (product) => product.id === window.lastViewedProductId,
        );
        if (foundIndex > -1) {
          this.recentlyViewedProducts.splice(foundIndex, 1);
        }
      }

      // recentlyViewedProducts is a stack, so newer items are at the bottom. Reverse.
      const searchString = this.recentlyViewedProducts
        .toReversed()
        .map((product) => `id:${product.id}`)
        .join(" OR ");

      const url = `${window.routes.search_url}?section_id=${
        this.dataset.sectionId
      }&type=product&q=${encodeURIComponent(searchString)}`;

      fetch(url)
        .then((response) => response.text())
        .then((content) => {
          const html = document.createElement("div");

          html.innerHTML = content;

          this.innerHTML = html.querySelector("recently-viewed-products").innerHTML;
          this.fetched = true;

          this.querySelectorAll("product-card").forEach((product) => {
            const slider = product.closest("carousel-slider .grid-carousel");
            const productId = product.dataset.productId;
            const viewEntry = this.recentlyViewedProducts.find(
              (productEntry) => productEntry.id === productId,
            );
            if (!viewEntry) {
              return;
            }

            const rtf = new Intl.RelativeTimeFormat(window.recentlyViewedStrings.currentLanguage, {
              numeric: "auto",
            });
            const now = Date.now();

            const diffSec = (now - viewEntry.timestamp) / 1000;
            const diffMin = Math.trunc(diffSec / 60);
            const diffHours = Math.trunc(diffMin / 60);
            const diffDays = Math.trunc(diffHours / 24);
            const diffMonths = Math.trunc(diffDays / 30);
            const diffYears = Math.trunc(diffMonths / 12);

            let relativeTime = window.recentlyViewedStrings.justNow;
            if (diffYears >= 1) {
              relativeTime = rtf.format(-diffYears, "years");
            } else if (diffMonths >= 1) {
              relativeTime = rtf.format(-diffMonths, "months");
            } else if (diffDays >= 1) {
              relativeTime = rtf.format(-diffDays, "days");
            } else if (diffHours >= 1) {
              relativeTime = rtf.format(-diffHours, "hours");
            } else if (diffMin >= 1) {
              relativeTime = rtf.format(-diffMin, "minutes");
            } else {
              relativeTime = window.recentlyViewedStrings.lessThanMinute;
            }

            const textElement = document.createElement("div");
            textElement.classList.add("card-product-recently-viewed-time");
            textElement.innerHTML = `<span>${relativeTime}</span> <button type="button" class="button-text-link card-product-recently-viewed-dismiss">${window.recentlyViewedStrings.remove}</button>`;

            textElement.querySelector("button").addEventListener("click", (e) => {
              let items = getRecentlyViewedProducts();
              items = items.filter((item) => item.id.toString() !== productId.toString());
              saveRecentlyViewedProducts(items);

              const visibleItems = product.closest(".flickity-slider")?.children;
              product.parentElement.remove();

              if (items.length < 2) {
                this.style.display = "none";
              }

              if (slider) {
                const flickity = Flickity.data(slider);
                flickity.resize();

                this.sliderNav = this.querySelector("carousel-navigation");
                if (visibleItems?.length <= this.columns) {
                  this.sliderNav ? (this.sliderNav.style.display = "none") : null;
                }
              }
            });

            product.querySelector(".card-footer")?.append?.(textElement);
            if (slider) {
              const flickity = Flickity.data(slider);
              flickity?.resize();
              this.sliderNav = this.querySelector("carousel-navigation");

              if (this.recentlyViewedProducts.length <= this.columns) {
                this.sliderNav ? (this.sliderNav.style.display = "none") : null;
              }
            }
          });
        });
    }
  }

  customElements.define("recently-viewed-products", RecentlyViewedProducts);
}
