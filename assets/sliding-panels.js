// Sliding Panel Component
class SlidingPanel extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    this.isExpanded = this.getAttribute("expanded") === "true";
    this.panelIndex = this.getAttribute("data-panel-index");
    this.slidingPanels = this.closest("sliding-panels");

    // Add click event listener for expansion
    this.addEventListener("click", this.handleClick.bind(this));
  }

  handleClick(event) {
    // Don't trigger on internal links or buttons
    if (event.target.closest("a") || event.target.closest("button")) {
      return;
    }

    event.preventDefault();
    this.toggle();
  }

  toggle() {
    if (this.isExpanded) {
      this.collapse();
    } else {
      this.expand();
    }
  }

  expand() {
    if (this.isExpanded) {
      return;
    }

    // Collapse other panels
    if (this.slidingPanels) {
      this.slidingPanels.collapseAllPanels();
      this.slidingPanels.setLastExpandedPanel(this.panelIndex);
    }

    this.isExpanded = true;
    this.setAttribute("expanded", "true");

    // Trigger any custom animation or callback
    this.dispatchEvent(
      new CustomEvent("sliding-panel:expand", {
        bubbles: true,
        detail: { panelIndex: this.panelIndex },
      }),
    );
  }

  collapse() {
    if (!this.isExpanded) {
      return;
    }

    this.isExpanded = false;
    this.setAttribute("expanded", "false");

    this.dispatchEvent(
      new CustomEvent("sliding-panel:collapse", {
        bubbles: true,
        detail: { panelIndex: this.panelIndex },
      }),
    );
  }
}

customElements.define("sliding-panel", SlidingPanel);

// Sliding Panels Container Component
class SlidingPanels extends HTMLElement {
  constructor() {
    super();
    this.lastExpandedPanelIndex = null;
    this.isInitialized = false;
  }

  connectedCallback() {
    this.initialOpen = this.getAttribute("initial-open") || 1;
    this.panels = [];

    // Wait for all children to be defined
    setTimeout(() => {
      this.initializePanels();
    }, 0);
  }

  initializePanels() {
    this.panels = Array.from(this.querySelectorAll("sliding-panel"));

    // Determine which panel to open
    let panelToOpen = parseInt(this.initialOpen);

    // If in design mode and already initialized, keep the last expanded panel
    if (Shopify?.designMode && this.isInitialized && this.lastExpandedPanelIndex !== null) {
      panelToOpen = this.lastExpandedPanelIndex;
    }

    // Ensure only the correct panel is open
    this.panels.forEach((panel, index) => {
      const panelNumber = index + 1;
      if (panelNumber === panelToOpen) {
        panel.isExpanded = true;
        panel.setAttribute("expanded", "true");
        this.lastExpandedPanelIndex = panelNumber;
      } else {
        panel.isExpanded = false;
        panel.setAttribute("expanded", "false");
      }
    });

    this.isInitialized = true;
  }

  setLastExpandedPanel(panelIndex) {
    this.lastExpandedPanelIndex = parseInt(panelIndex);
  }

  collapseAllPanels() {
    this.panels.forEach((panel) => {
      if (panel.isExpanded) {
        panel.collapse();
      }
    });
  }

  expandPanel(panelIndex) {
    this.collapseAllPanels();
    if (this.panels[panelIndex - 1]) {
      this.panels[panelIndex - 1].expand();
    }
  }
}

customElements.define("sliding-panels", SlidingPanels);
