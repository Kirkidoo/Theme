if (!customElements.get("product-request-information")) {
  customElements.define(
    "product-request-information",
    class ProductRequestInformation extends HTMLElement {
      constructor() {
        super();
      }

      connectedCallback() {
        this.collapsed = this.getAttribute("expanded") === "false";
        this.toggleElement = this.querySelector(".product-request-information-toggle");
        this.onToggle = this.onToggle.bind(this);
        this.toggleElement.addEventListener("click", this.onToggle);
      }

      onToggle(event) {
        event.preventDefault();
        this.handleToggle();
      }

      collapse() {
        this.setAttribute("expanded", "false");
        this.toggleElement.setAttribute("aria-expanded", "false");
        this.collapsed = true;
      }

      expand() {
        this.setAttribute("expanded", "true");
        this.toggleElement.setAttribute("aria-expanded", "true");
        this.collapsed = false;
        this.querySelector('input[name="contact[name]"]')?.focus();
      }

      handleToggle() {
        if (this.collapsed) {
          this.expand();
        } else {
          this.collapse();
        }
      }
    },
  );
}
