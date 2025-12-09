if (!customElements.get("quantity-popover")) {
  customElements.define(
    "quantity-popover",
    class QuantityPopover extends HTMLElement {
      constructor() {
        super();

        this.infoButton = this.querySelector(".quantity-popover-info-button");
        this.popoverInfo = this.querySelector(".quantity-popover-info");
        this.closeButton = this.querySelector(".quantity-popover-button-dismiss");
        this.eventMouseEnterHappened = false;

        if (this.closeButton) {
          this.closeButton.addEventListener("click", this.closePopover.bind(this));
        }

        if (this.infoButton) {
          this.infoButton.addEventListener("click", this.togglePopover.bind(this));
          this.infoButton.addEventListener("focusout", this.closePopover.bind(this));
        }
      }

      togglePopover(event) {
        event.preventDefault();
        if (event.type === "mouseenter") {
          this.eventMouseEnterHappened = true;
        }

        if (event.type === "click" && this.eventMouseEnterHappened) {
          return;
        }

        const button = this.infoButton;
        const isExpanded = button.getAttribute("aria-expanded") === "true";

        if (!isExpanded || event.type === "click") {
          button.setAttribute("aria-expanded", !isExpanded);

          this.popoverInfo.toggleAttribute("hidden");
        }

        const isOpen = button.getAttribute("aria-expanded") === "true";

        if (isOpen && event.type !== "mouseenter") {
          button.focus();
          button.addEventListener("keyup", (e) => {
            if (e.key === "Escape") {
              this.closePopover(e);
            }
          });
        }
      }

      closePopover(event) {
        event.preventDefault();
        const isButtonChild = this.infoButton.contains(event.relatedTarget);
        const isPopoverChild = this.popoverInfo.contains(event.relatedTarget);

        const button = this.infoButton;

        if (!isButtonChild && !isPopoverChild) {
          button.setAttribute("aria-expanded", "false");
          this.popoverInfo.setAttribute("hidden", "");
        }

        this.eventMouseEnterHappened = false;
      }
    },
  );
}
