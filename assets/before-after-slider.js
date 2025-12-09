(function () {
  class BeforeAfterSliderBase {
    constructor(element, options = {}) {
      this.element = element;
      this.options = options;
      this.slider = this.element.querySelector(".before-after-slider-handler");
      this.overlay = this.element.querySelector(".before-after-slider-overlay");
      this.beforeImg = this.overlay.querySelector("img") ?? this.overlay.querySelector("svg");

      if (this.options.orientation === "vertical") {
        this.element.classList.add("before-after-slider-vertical");
      }

      this.updatePosition = this.updatePosition.bind(this);
      this.setInitialState = this.setInitialState.bind(this);

      this.setInitialState();
      this.addEventListeners();
    }

    setInitialState() {
      const rect = this.element.getBoundingClientRect();
      const dimension =
        this.options.orientation === "vertical"
          ? { width: "auto", height: `${rect.height}px` }
          : { width: `${rect.width}px`, height: "auto" };
      this.element.classList.add("is-loaded");

      Object.assign(this.beforeImg.style, dimension);
    }

    updatePosition(e) {
      const rect = this.element.getBoundingClientRect();
      const clientX = e.clientX || e.touches?.[0]?.clientX;
      const clientY = e.clientY || e.touches?.[0]?.clientY;

      if (this.options.orientation === "vertical") {
        const y = Math.max(0, Math.min(clientY - rect.top, rect.height));
        const percent = (y / rect.height) * 100;
        this.slider.style.top = `${percent}%`;
        this.overlay.style.height = `${percent}%`;
      } else {
        const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
        const percent = (x / rect.width) * 100;
        this.slider.style.left = `${percent}%`;
        this.overlay.style.width = `${percent}%`;
      }
      this.setInitialState();
    }

    addEventListeners() {
      let isMouseDown = false;

      const stopDrag = () => {
        isMouseDown = false;
        document.removeEventListener("mousemove", this.updatePosition);
        document.removeEventListener("mouseup", stopDrag);
        document.removeEventListener("touchmove", this.updatePosition);
        document.removeEventListener("touchend", stopDrag);
      };

      const startDrag = (e) => {
        e.preventDefault();
        isMouseDown = true;
        document.addEventListener("mousemove", this.updatePosition);
        document.addEventListener("mouseup", stopDrag);
        document.addEventListener("touchmove", this.updatePosition);
        document.addEventListener("touchend", stopDrag);
      };

      this.slider.addEventListener("mousedown", startDrag);
      this.slider.addEventListener("touchstart", startDrag);

      this.element.addEventListener("click", this.updatePosition);
      this.element.addEventListener("touchend", (e) => {
        if (!isMouseDown) {
          this.updatePosition(e);
        }
      });

      this.element.addEventListener("dragstart", (e) => e.preventDefault());

      window.addEventListener("load", this.setInitialState);
      window.addEventListener("resize", this.setInitialState);
    }
  }

  if (!window.BeforeAfterSliderBase) {
    window.BeforeAfterSliderBase = BeforeAfterSliderBase;
  }

  if (!customElements.get("before-after-slider")) {
    customElements.define(
      "before-after-slider",
      class BeforeAfterSlider extends HTMLElement {
        constructor() {
          super();
        }

        connectedCallback() {
          setTimeout(() => {
            const orientation = this.getAttribute("data-orientation");
            const element = this.querySelector(".before-after-slider-media-container");

            new BeforeAfterSliderBase(element, { orientation });
          }, 0);
        }
      },
    );
  }
})();
