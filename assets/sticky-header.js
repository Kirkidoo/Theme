if (!customElements.get("sticky-header")) {
  customElements.define(
    "sticky-header",
    class StickyHeader extends HTMLElement {
      constructor() {
        super();
      }

      connectedCallback() {
        this.stickyDisabled = this.getAttribute("disabled") === "true";
        this.header = document.querySelector(".section-header");
        this.headerElement = this.querySelector(".header");
        this.alwaysSticky = this.dataset.alwaysOn === "true";
        this.headerBounds = {};
        this.currentScrollTop = 0;
        this.preventReveal = false;
        this.mainNavToggle = this.querySelector("main-nav-toggle");
        this.predictiveSearch = this.querySelector("predictive-search");

        if (!this.stickyDisabled && this.alwaysSticky) {
          this.header.classList.add("section-header-sticky-always");
        }

        this.onScrollHandler = this.onScroll.bind(this);
        this.hideHeaderOnScrollUp = () => {
          this.preventReveal = true;
        };

        this.addEventListener("preventHeaderReveal", this.hideHeaderOnScrollUp);
        window.addEventListener("scroll", this.onScrollHandler, false);

        this.createObserver();
      }

      disconnectedCallback() {
        this.removeEventListener("preventHeaderReveal", this.hideHeaderOnScrollUp);
        window.removeEventListener("scroll", this.onScrollHandler);
      }

      createObserver() {
        let observer = new IntersectionObserver((entries, observer) => {
          this.headerBounds = entries[0].intersectionRect;
          observer.disconnect();
        });

        observer.observe(this.header);
      }

      onScroll() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

        if (this.predictiveSearch && this.predictiveSearch.isOpen) {
          return;
        }

        const navigationWrapper = document.querySelector(".navigation-wrapper");
        if (navigationWrapper && navigationWrapper.classList.contains("is-animating")) {
          return;
        }

        if (scrollTop > this.currentScrollTop && scrollTop > this.headerBounds.bottom) {
          if (this.alwaysSticky && this.mainNavToggle) {
            this.mainNavToggle.enable();
          }
          requestAnimationFrame(this.hide.bind(this));
        } else if (scrollTop < this.currentScrollTop && scrollTop > this.headerBounds.bottom) {
          if (!this.preventReveal && !this.stickyDisabled) {
            requestAnimationFrame(this.reveal.bind(this));
          } else {
            window.clearTimeout(this.isScrolling);

            this.isScrolling = setTimeout(() => {
              this.preventReveal = false;
            }, 66);

            requestAnimationFrame(this.hide.bind(this));
          }
        } else if (!this.stickyDisabled && scrollTop <= this.headerBounds.top) {
          requestAnimationFrame(this.reset.bind(this));
        } else if (this.stickyDisabled && scrollTop <= this.headerBounds.bottom) {
          requestAnimationFrame(this.reset.bind(this));
        }

        this.currentScrollTop = scrollTop;
      }

      hide() {
        if (this.alwaysSticky) {
          return;
        }
        this.header.classList.add("section-header-hidden", "section-header-sticky");

        // Enable nav collapse mode and pre-collapse it without animation
        if (this.mainNavToggle) {
          this.mainNavToggle.enable();
        }

        this.closeHeaderDropdowns();
      }

      reveal() {
        if (this.alwaysSticky) {
          return;
        }
        this.header.classList.add("section-header-sticky", "animate");
        this.header.classList.remove("section-header-hidden");
      }

      reset() {
        this.header.classList.remove("section-header-hidden", "section-header-sticky", "animate");

        // If the navigation is collapsible, make sure it's always
        // expanded when we reach the top (when we reset).
        if (this.mainNavToggle) {
          this.mainNavToggle.disable();
        }
      }

      closeHeaderDropdowns() {
        const headerDropdowns = this.header.querySelectorAll("localization-form");

        headerDropdowns.forEach((dropdown) => {
          dropdown.hidePanel();
        });
      }
    },
  );
}

if (!customElements.get("main-nav-toggle")) {
  customElements.define(
    "main-nav-toggle",
    class MainNavToggle extends HTMLElement {
      constructor() {
        super();
        this.header = document.querySelector("#header");
        this.stickyHeader = document.querySelector("sticky-header");
        this.button = this.querySelector(".button-main-nav-toggle");
        this.navigationWrapper = document.querySelector(".navigation-wrapper");

        if (!this.navigationWrapper) {
          return;
        }

        this.navigationWrapper.style.setProperty(
          "--navigation-height",
          this.navigationWrapper.clientHeight + 2 + "px",
        );

        this.button.addEventListener("click", () => this.onToggle());
      }

      onToggle(state) {
        if (this.navigationWrapper.classList.contains("is-animating") || !this.stickyHeader) {
          return;
        }

        this.navigationWrapper.classList.add("is-animating");

        if (state != null) {
          if (state === "collapse") {
            this.collapse();
          } else if (state === "expand") {
            this.expand();
          }
        } else {
          this.isCollapsed() ? this.expand() : this.collapse();
        }

        setTimeout(() => {
          this.navigationWrapper.classList.remove("is-animating");
        }, 300);
      }

      enable() {
        if (!this.header.classList.contains("header-nav-collapse-enabled")) {
          this.header.classList.add("header-nav-collapse-enabled");
          this.collapse();
        }
      }

      disable() {
        if (this.header.classList.contains("header-nav-collapse-enabled")) {
          this.header.classList.remove("header-nav-collapse-enabled");
          this.expand();
        }
      }

      expand() {
        this.header.classList.remove("navigation-collapsed");
      }

      collapse() {
        this.classList.add("is-visible");
        this.header.classList.add("navigation-collapsed");
      }

      isCollapsed() {
        return this.header.classList.contains("navigation-collapsed");
      }
    },
  );
}
