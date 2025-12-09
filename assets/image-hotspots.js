if (!customElements.get("image-hotspots")) {
  customElements.define(
    "image-hotspots",
    class ImageHotspots extends HTMLElement {
      constructor() {
        super();
        this.elements = {
          wrapper: this.querySelector(".image-hotspots"),
          hotspots: this.querySelectorAll(".hotspot"),
        };

        this.elements.hotspots.forEach((hotspot) => {
          this.positionHotspotContent(hotspot);
          hotspot.addEventListener("click", (event) => {
            event.stopPropagation();
            this.toggle(hotspot);
          });
        });

        this.recalculatePositions = debounce(() => {
          this.elements.hotspots.forEach((hotspot) => {
            this.positionHotspotContent(hotspot);
          });
        }, 250);

        document.addEventListener("click", () => this.closeAll());
        document.addEventListener("keydown", (event) => {
          if (event.key === "Escape") {
            this.closeAll();
          }
        });

        this.elements.wrapper.classList.add("loaded");
        window.addEventListener("resize", this.recalculatePositions);
      }

      disconnectedCallback() {
        window.removeEventListener("resize", this.recalculatePositions);
      }

      toggle(hotspot) {
        if (hotspot.classList.contains("is-active")) {
          this.close(hotspot);
        } else {
          this.open(hotspot);
        }
      }

      open(hotspot) {
        this.positionHotspotContent(hotspot);
        this.closeAll();
        hotspot.classList.add("is-active");
      }

      close(hotspot) {
        hotspot.classList.remove("is-active");
      }

      closeAll() {
        this.elements.hotspots.forEach((hotspot) => {
          this.close(hotspot);
        });
      }

      positionHotspotContent(hotspot) {
        const viewportWidth = document.documentElement.clientWidth;
        const viewportHeight = document.documentElement.clientHeight;
        const hotspotRect = hotspot.getBoundingClientRect();
        const content = hotspot.querySelector(".hotspot-card-wrap");
        const toggle = hotspot.querySelector(".hotspot-toggle");

        if (!content) {
          return;
        }

        // Vertical positioning
        const contentHeight = content.offsetHeight;
        const spaceAbove = hotspotRect.top;
        const spaceBelow = viewportHeight - hotspotRect.bottom;

        if (spaceBelow >= contentHeight) {
          content.style.bottom = "auto";
          content.style.top = `calc(${hotspotRect.height}px - 3rem)`;
        } else if (spaceAbove >= contentHeight) {
          content.style.top = "auto";
          content.style.bottom = `calc(${hotspotRect.height}px + 1rem)`;
        } else {
          content.style.bottom = "auto";
          content.style.top = `calc(${hotspotRect.height}px - 3rem)`;
        }

        // Horizontal positioning
        content.style.left = "0px";
        const contentWidth = content.offsetWidth;
        const contentRect = content.getBoundingClientRect();
        const toggleRect = toggle.getBoundingClientRect();
        const toggleCenter = toggleRect.left + toggle.offsetWidth / 2 + toggle.offsetWidth / 4;
        const centerDiff = contentRect.left + contentWidth / 2 - toggleCenter;

        content.style.left = `calc(${centerDiff}px * -1)`;

        const contentCenterRect = content.getBoundingClientRect();

        if (contentCenterRect.left < 5) {
          content.style.left = "-20px";
        } else if (contentCenterRect.left + content.offsetWidth > viewportWidth) {
          content.style.left = `-${
            centerDiff + (contentCenterRect.left + content.offsetWidth - viewportWidth)
          }px`;
        }
      }
    },
  );
}
