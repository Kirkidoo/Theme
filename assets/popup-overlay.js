if (!customElements.get("popup-overlay")) {
  customElements.define(
    "popup-overlay",
    class PopupOverlay extends ModalDialog {
      constructor() {
        super();
        this.delay = parseInt(this.dataset.delay, 10) * 1000;
        this.id = this.getAttribute("id");
        this.moved = true;
      }

      connectedCallback() {
        if (localStorage.getItem(this.id) !== "dismissed" && !Shopify.designMode) {
          setTimeout(() => {
            this.show();
          }, this.delay);
        }

        return super.connectedCallback();
      }

      show() {
        super.show();
        document.body.classList.remove("overflow-hidden");
        const event = new CustomEvent("popup-overlay:open", {
          detail: {
            id: this.id,
          },
        });
        document.dispatchEvent(event);
      }

      hide() {
        super.hide();
        const event = new CustomEvent("popup-overlay:close", {
          detail: {
            id: this.id,
          },
        });
        document.dispatchEvent(event);

        if (!Shopify.designMode) {
          localStorage.setItem(this.id, "dismissed");
        }
      }
    },
  );
}
