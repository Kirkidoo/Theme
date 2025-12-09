class PredictiveSearch extends HTMLElement {
  constructor() {
    super();
    this.cachedResults = {};
    this.input = this.querySelector('input[type="search"]');
    this.predictiveSearchResults = this.querySelector("[data-predictive-search]");
    this.isOpen = false;

    this.setupEventListeners();
  }

  setupEventListeners() {
    const form = this.querySelector("form.search");

    if (!form) {
      return;
    }

    form.addEventListener("submit", this.onFormSubmit.bind(this));
    this.select = this.querySelector("select");

    this.input.addEventListener(
      "input",
      debounce((event) => {
        this.onChange(event);
      }, 300).bind(this),
    );

    if (this.select) {
      this.select.addEventListener(
        "input",
        debounce((event) => {
          this.onChange(event);
        }, 300).bind(this),
      );
    }

    this.input.addEventListener("focus", this.onFocus.bind(this));
    this.addEventListener("focusout", this.onFocusOut.bind(this));
    this.addEventListener("keyup", this.onKeyup.bind(this));
    this.addEventListener("keydown", this.onKeydown.bind(this));
  }

  getQuery() {
    return this.input.value.trim();
  }

  getSearchFilterType() {
    if (!this.select) {
      return "";
    }

    return this.select.dataset.type;
  }

  getSearchFilterTypeQuery() {
    if (!this.select) {
      return "";
    }

    return this.select.value.trim();
  }

  onChange() {
    const searchTerm = this.getQuery();

    if (!searchTerm.length) {
      this.close(true);
      return;
    }

    this.getSearchResults(searchTerm);
  }

  onFormSubmit(event) {
    if (!this.getQuery().length || this.querySelector('[aria-selected="true"] a')) {
      event.preventDefault();
    }
  }

  onFocus() {
    const searchTerm = this.getQuery();

    if (!searchTerm.length) {
      return;
    }

    if (this.getAttribute("results") === "true") {
      this.open();
    } else {
      this.getSearchResults(searchTerm);
    }
  }

  onFocusOut() {
    setTimeout(() => {
      if (!this.contains(document.activeElement)) {
        this.close();
      }
    });
  }

  onKeyup(event) {
    if (!this.getQuery().length) {
      this.close(true);
    }

    event.preventDefault();

    switch (event.code) {
      case "ArrowUp":
        this.switchOption("up");
        break;
      case "ArrowDown":
        this.switchOption("down");
        break;
      case "Enter":
        this.selectOption();
        break;
    }
  }

  onKeydown(event) {
    // Prevent the cursor from moving in the input when using the up and down arrow keys
    if (event.code === "ArrowUp" || event.code === "ArrowDown") {
      event.preventDefault();
    }
  }

  switchOption(direction) {
    if (!this.getAttribute("open")) {
      return;
    }

    const moveUp = direction === "up";
    const selectedElement = this.querySelector('[aria-selected="true"]');

    // Filter out hidden elements (duplicated page and article resources) thanks
    // to this https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/offsetParent
    const allVisibleElements = Array.from(
      this.querySelectorAll("li, button.predictive-search-item-button"),
    ).filter((element) => element.offsetParent !== null);
    let activeElementIndex = 0;

    if (moveUp && !selectedElement) return;

    let selectedElementIndex = -1;
    let i = 0;

    while (selectedElementIndex === -1 && i <= allVisibleElements.length) {
      if (allVisibleElements[i] === selectedElement) {
        selectedElementIndex = i;
      }
      i++;
    }

    this.statusElement.textContent = "";

    if (!moveUp && selectedElement) {
      activeElementIndex =
        selectedElementIndex === allVisibleElements.length - 1 ? 0 : selectedElementIndex + 1;
    } else if (moveUp) {
      activeElementIndex =
        selectedElementIndex === 0 ? allVisibleElements.length - 1 : selectedElementIndex - 1;
    }

    if (activeElementIndex === selectedElementIndex) return;

    const activeElement = allVisibleElements[activeElementIndex];

    activeElement.setAttribute("aria-selected", true);
    if (selectedElement) selectedElement.setAttribute("aria-selected", false);

    this.input.setAttribute("aria-activedescendant", activeElement.id);
  }

  selectOption() {
    const selectedProduct = this.querySelector(
      '[aria-selected="true"] a, [aria-selected="true"] button',
    );

    if (selectedProduct) {
      selectedProduct.click();
    }
  }

  getSearchResults(searchTerm) {
    const filterType = this.getSearchFilterType();
    const filterTypeQuery = this.getSearchFilterTypeQuery();
    const queryKey =
      searchTerm.replaceAll(" ", "-").toLowerCase() +
      "-" +
      filterType +
      "-" +
      filterTypeQuery.replaceAll(" ", "-").toLowerCase();

    this.setLiveRegionLoadingState();

    if (this.cachedResults[queryKey]) {
      this.renderSearchResults(this.cachedResults[queryKey]);
      return;
    }

    const limit = this.dataset.limit;
    const limitScope = this.dataset.limitScope;
    const query = filterTypeQuery
      ? encodeURIComponent(`${filterType}:${filterTypeQuery}+* ${searchTerm}`)
      : encodeURIComponent(searchTerm);

    fetch(
      `${routes.predictive_search_url}?q=${query}&resources[limit_scope]=${limitScope}&resources[limit]=${limit}&options[prefix]=last&section_id=predictive-search&resources[options][fields]=title,product_type,variants.title,variants.sku,vendor`,
    )
      .then((response) => {
        if (!response.ok) {
          var error = new Error(response.status);
          this.close();
          throw error;
        }

        return response.text();
      })
      .then((text) => {
        const resultsMarkup = new DOMParser()
          .parseFromString(text, "text/html")
          .querySelector("#shopify-section-predictive-search").innerHTML;
        this.cachedResults[queryKey] = resultsMarkup;
        this.renderSearchResults(resultsMarkup);
      })
      .catch((error) => {
        this.close();
        throw error;
      });
  }

  setLiveRegionLoadingState() {
    this.statusElement = this.statusElement || this.querySelector(".predictive-search-status");
    this.loadingText = this.loadingText || this.getAttribute("data-loading-text");

    this.setLiveRegionText(this.loadingText);
    this.setAttribute("loading", true);
  }

  setLiveRegionText(statusText) {
    this.statusElement.setAttribute("aria-hidden", "false");
    this.statusElement.textContent = statusText;

    setTimeout(() => {
      this.statusElement.setAttribute("aria-hidden", "true");
    }, 1000);
  }

  renderSearchResults(resultsMarkup) {
    this.predictiveSearchResults.innerHTML = resultsMarkup;
    this.setAttribute("results", true);

    this.setLiveRegionResults();
    this.open();
  }

  setLiveRegionResults() {
    this.removeAttribute("loading");
    this.setLiveRegionText(
      this.querySelector("[data-predictive-search-live-region-count-value]").textContent,
    );
  }

  getResultsMaxHeight() {
    this.resultsMaxHeight =
      window.innerHeight - document.querySelector(".section-header").getBoundingClientRect().bottom;
    return this.resultsMaxHeight;
  }

  open() {
    this.predictiveSearchResults.style.maxHeight =
      this.resultsMaxHeight || `${this.getResultsMaxHeight()}px`;
    this.setAttribute("open", true);
    this.input.setAttribute("aria-expanded", true);

    if (!this.isOpen) {
      const event = new CustomEvent("search:open");
      document.dispatchEvent(event);
    }

    this.isOpen = true;
  }

  close(clearSearchTerm = false) {
    if (clearSearchTerm) {
      this.input.value = "";
      this.removeAttribute("results");
    }

    const selected = this.querySelector('[aria-selected="true"]');

    if (selected) {
      selected.setAttribute("aria-selected", false);
    }

    this.input.setAttribute("aria-activedescendant", "");
    this.removeAttribute("open");
    this.input.setAttribute("aria-expanded", false);
    this.resultsMaxHeight = false;
    this.predictiveSearchResults.removeAttribute("style");

    if (this.isOpen) {
      const event = new CustomEvent("search:close");
      document.dispatchEvent(event);
    }

    this.isOpen = false;
  }
}

customElements.define("predictive-search", PredictiveSearch);
