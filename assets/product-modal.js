if (!customElements.get("product-modal")) {
  customElements.define(
    "product-modal",
    class ProductModal extends ModalDialog {
      constructor() {
        super();

        this.closeEvent = new CustomEvent("product:modal-close");
        this.openEvent = new CustomEvent("product:modal-open");
      }

      hide() {
        super.hide();
        document.dispatchEvent(this.closeEvent);
      }

      show(opener) {
        super.show(opener);
        this.showActiveMedia();
        document.dispatchEvent(this.openEvent);
      }

      showActiveMedia() {
        this.querySelectorAll(
          `[data-media-id]:not([data-media-id="${this.openedBy.getAttribute("data-media-id")}"])`,
        ).forEach((element) => {
          element.classList.remove("is-active");
        });
        const activeMedia = this.querySelector(
          `[data-media-id="${this.openedBy.getAttribute("data-media-id")}"]`,
        );
        const activeMediaTemplate = activeMedia.querySelector("template");
        const activeMediaContent = activeMediaTemplate ? activeMediaTemplate.content : null;
        activeMedia.classList.add("is-active");
        activeMedia.scrollIntoView();

        const container = this.querySelector('[role="document"]');
        container.scrollLeft = (activeMedia.width - container.clientWidth) / 2;

        if (
          activeMedia.nodeName == "DEFERRED-MEDIA" &&
          activeMediaContent &&
          activeMediaContent.querySelector(".js-youtube")
        ) {
          activeMedia.loadContent();
        }
      }
    },
  );
}
