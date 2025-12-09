if (!customElements.get("button-top")) {
  customElements.define(
    "button-top",
    class ButtonScrollTop extends HTMLElement {
      constructor() {
        super();
        this.button = this.querySelector(".button-top");

        if (!this.button) {
          return;
        }

        this.timeout = null;
        window.addEventListener("scroll", () => {
          clearTimeout(this.timeout);

          this.timeout = setTimeout(() => {
            if (window.scrollY > 400) {
              this.button.classList.add("button-top-visible");
            } else {
              this.button.classList.remove("button-top-visible");
            }
          }, 250);
        });

        this.button.addEventListener("click", (event) => {
          event.preventDefault();
          this.handleClick();
        });
      }

      handleClick() {
        document.documentElement.scrollTo({
          top: 0,
          behavior: "smooth",
        });
      }
    },
  );
}
