if (!customElements.get("content-drawer")) {
  class ContentDrawer extends DrawerModal {
    constructor() {
      super();
    }

    connectedCallback() {
      const existingDrawerInBody = document.body.querySelector(`content-drawer[id="${this.id}"]`);

      if (existingDrawerInBody && existingDrawerInBody !== this) {
        existingDrawerInBody.remove();
      }

      if (this.parentElement !== document.body) {
        document.body.appendChild(this);
      }
    }

    open(opener) {
      requestAnimationFrame(() => {
        super.open(opener);
      });
    }
  }

  customElements.define("content-drawer", ContentDrawer);
}
