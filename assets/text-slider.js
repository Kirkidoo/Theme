if (!customElements.get("text-slider")) {
  customElements.define(
    "text-slider",
    class TextSlider extends HTMLElement {
      constructor() {
        super();
      }

      connectedCallback() {
        this.slideshowSelector = this.dataset.slideshowSelector;
        this.carousel = this.slideshowSelector
          ? this.querySelector(this.slideshowSelector)
          : this.querySelector(".media-icon-items-grid");
        this.initialize();
      }

      disconnectedCallback() {
        if (this.autoHeight) {
          window.removeEventListener("resize", this.handleResize);
        }
      }

      initialize() {
        const autoplayEnabled = this.getAttribute("data-autoplay") === "true";
        const autoPlaySpeed = parseInt(this.getAttribute("data-speed"), 10) * 1000;
        this.animationType = this.getAttribute("data-animation-type") ?? "slide";
        this.autoPlayEnabled = autoplayEnabled && autoPlaySpeed > 0;
        this.autoHeight = this.getAttribute("data-auto-height") === "true";

        const cellSelector = this.dataset.cellSelector ?? ".media-icon-item";

        if (this.dataset.setDisplay === "true") {
          this.carousel.style.display = "block";
        }

        this.flickity = new Flickity(this.carousel, {
          autoPlay: autoplayEnabled ? autoPlaySpeed : false,
          cellAlign: "center",
          groupCells: false,
          contain: true,
          resize: true,
          draggable: true,
          prevNextButtons: false,
          cellSelector: cellSelector,
          initialIndex: 0,
          pageDots: false,
          wrapAround: true,
          accessibility: false,
          watchCSS: true,
        });

        if (this.autoHeight) {
          window.addEventListener("resize", this.handleResize);
        }
      }

      handleResize = debounce(() => {
        this.recalculateHeight();
      }, 200);

      recalculateHeight() {
        if (!this.flickity) {
          return;
        }

        const slides = this.flickity.getCellElements();
        const maxHeight = slides.reduce((tallest, slide) => {
          return Math.max(tallest, slide.offsetHeight);
        }, 0);

        const viewport = this.querySelector(".flickity-viewport");
        if (viewport) {
          viewport.style.height = `${maxHeight}px`;
        }
      }
    },
  );
}

if (!customElements.get("text-slider-navigation")) {
  customElements.define(
    "text-slider-navigation",
    class TextSliderNavigation extends HTMLElement {
      constructor() {
        super();
      }

      connectedCallback() {
        this.init();
      }

      init(retry = 1, maxRetry = 3) {
        if (retry === maxRetry) {
          return;
        }

        const id = this.getAttribute("for");
        this.carouselComponent = document.querySelector(`#${id}`);
        this.wrap = this.dataset.wrap === "true";

        if (!this.carouselComponent || !this.carouselComponent.flickity) {
          setTimeout(() => {
            this.init(retry + 1);
          }, 350);
          return;
        }

        this.flickity = this.carouselComponent.flickity;
        this.buttonPrev = this.querySelector(".js-prev");
        this.buttonNext = this.querySelector(".js-next");

        this.buttonPrev.addEventListener("click", (event) => {
          event.preventDefault();
          this.flickity.previous();
        });

        this.buttonNext.addEventListener("click", (event) => {
          event.preventDefault();
          this.flickity.next();
        });

        this.flickity.on("select", () => {
          if (this.wrap) {
            return;
          }

          this.enableButton(this.buttonPrev);
          this.enableButton(this.buttonNext);

          if (!this.flickity.slides[this.flickity.selectedIndex - 1]) {
            this.disableButton(this.buttonPrev);
          } else if (!this.flickity.slides[this.flickity.selectedIndex + 1]) {
            this.disableButton(this.buttonNext);
          }
        });
      }

      enableButton(button) {
        button.classList.remove("pill-nav-item-disabled");
        button.classList.remove("focus-none");
        button.setAttribute("aria-disabled", "false");
      }

      disableButton(button) {
        button.classList.add("pill-nav-item-disabled");
        button.classList.add("focus-none");
        button.setAttribute("aria-disabled", "true");
      }
    },
  );
}
