if (!customElements.get("scrolling-elements")) {
  customElements.define(
    "scrolling-elements",
    class ScrollingElements extends HTMLElement {
      constructor() {
        super();
      }

      connectedCallback() {
        if (this.offsetParent === null) {
          // Don't run if the element is not visible
          return;
        }

        const container = this.querySelector(".scrolling-elements-wrap");
        let groups = Array.from(container.querySelectorAll(".scrolling-elements-group"));

        if (!groups.length) {
          return;
        }

        const totalGroupWidth = groups.reduce((acc, group) => acc + group.offsetWidth, 0);
        let totalWidth = totalGroupWidth;

        while (totalWidth < window.innerWidth) {
          const newGroups = groups.map((group) => group.cloneNode(true));
          container.append(...newGroups);
          totalWidth += totalGroupWidth;
        }
      }
    },
  );
}
