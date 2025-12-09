/**
 * Main facet filtering form component
 * Handles all filter interactions, AJAX updates, and URL management
 */
class FacetFiltersForm extends HTMLElement {
  constructor() {
    super();
    this.onActiveFilterClick = this.onActiveFilterClick.bind(this);

    // Only respond to inputs within these selectors
    const inputWhitelist = [".facet", ".collection-actions-wrapper"];
    // Ignore inputs from these selectors (e.g., product compare toggle)
    const inputBlacklist = [".collection-actions-compare-toggle"];

    // Price range inputs trigger slower (500ms) to avoid excessive requests while typing
    this.debouncedOnSubmit = debounce((event) => {
      this.onSubmitHandler(event);
    }, 500);

    // Other filter inputs trigger faster (250ms) with immediate execution
    // The 'true' parameter makes it fire immediately on first call
    this.debouncedOnSubmitReduced = debounce(
      (event) => {
        this.onSubmitHandler(event);
      },
      250,
      true,
    );

    // Listen for any input changes (checkboxes, price inputs, sort dropdowns)
    this.addEventListener("input", (event) => {
      // Ignore inputs that aren't in whitelisted areas or are explicitly blacklisted
      if (
        !inputWhitelist.some((selector) => !!event.target.closest(selector)) ||
        inputBlacklist.some((selector) => !!event.target.closest(selector))
      ) {
        return false;
      }

      // Price range inputs get longer debounce, other inputs get shorter debounce
      if (event.target.closest("price-range")) {
        this.debouncedOnSubmit(event);
      } else {
        this.debouncedOnSubmitReduced(event);
      }
    });
  }

  /**
   * Set up browser back/forward button handling
   * Listens for popstate events to restore filter state when user navigates history
   */
  static setListeners() {
    const onHistoryChange = (event) => {
      // Get search params from history state, or use initial page load params
      const searchParams = event.state
        ? event.state.searchParams
        : FacetFiltersForm.searchParamsInitial;

      // Avoid re-rendering if params haven't changed
      if (searchParams === FacetFiltersForm.searchParamsPrev) {
        return;
      }

      // Re-render page with historical params, but don't update URL (it's already updated by browser)
      FacetFiltersForm.renderPage(searchParams, null, false);
    };
    window.addEventListener("popstate", onHistoryChange);
  }

  /**
   * Toggle the disabled state of active filter "remove" buttons
   * Used to prevent multiple clicks while AJAX request is in progress
   */
  static toggleActiveFacets(disable = true) {
    document.querySelectorAll(".js-facet-remove").forEach((element) => {
      element.classList.toggle("disabled", disable);
    });
  }

  /**
   * Main method to render the page with new filter/sort parameters
   * @param {string} searchParams - URL query string with filter parameters
   * @param {Event} event - The triggering event (optional)
   * @param {boolean} updateURLHash - Whether to update browser URL
   * @param {boolean} appendResults - Whether to append results (for load more pagination)
   */
  static renderPage(searchParams, event, updateURLHash = true, appendResults) {
    // Store current params for comparison on back/forward navigation
    FacetFiltersForm.searchParamsPrev = searchParams;
    const sections = FacetFiltersForm.getSections();
    const countContainer = document.getElementById("ProductCount");

    // Add loading state to product grid
    document
      .getElementById("ProductGridContainer")
      .querySelector(".collection")
      .classList.add("loading");

    // Add loading state to product count
    if (countContainer) {
      countContainer.classList.add("loading");
    }

    // For each section (usually just the product grid), fetch or use cached data
    sections.forEach((section) => {
      const url = `${window.location.pathname}?section_id=${section.section}&${searchParams}`;
      const filterDataUrl = (element) => element.url === url;

      // Check if we have this data cached, otherwise fetch it
      FacetFiltersForm.filterData.some(filterDataUrl)
        ? FacetFiltersForm.renderSectionFromCache(filterDataUrl, event)
        : FacetFiltersForm.renderSectionFromFetch(url, event, appendResults);
    });

    // Update browser URL with new filter params (unless navigating via back/forward)
    if (updateURLHash) {
      FacetFiltersForm.updateURLHash(searchParams);
    }

    // Dispatch custom event for analytics/tracking (but not for pagination)
    if (!searchParams.includes("page")) {
      const filtersEvent = new CustomEvent("collection:product-filters", {
        detail: {
          filters: deserializeSearchParams(searchParams),
        },
      });
      document.dispatchEvent(filtersEvent);
    }
  }

  /**
   * Fetch section HTML from server via AJAX
   * @param {string} url - URL to fetch (includes section_id and filter params)
   * @param {Event} event - The triggering event
   * @param {boolean} appendResults - Whether to append results (load more pagination)
   */
  static renderSectionFromFetch(url, event, appendResults) {
    fetch(url)
      .then((response) => response.text())
      .then((responseText) => {
        const html = responseText;
        // Cache the response for potential back/forward navigation
        FacetFiltersForm.filterData = [...FacetFiltersForm.filterData, { html, url }];

        // Update all relevant parts of the page
        FacetFiltersForm.renderCollectionActions(html);
        FacetFiltersForm.renderFilters(html, event);
        FacetFiltersForm.renderProductGridContainer(html, appendResults);
        FacetFiltersForm.renderProductCount(html);
      });
  }

  /**
   * Render section from cached HTML (used for back/forward navigation)
   * @param {Function} filterDataUrl - Function to find cached data by URL
   * @param {Event} event - The triggering event
   */
  static renderSectionFromCache(filterDataUrl, event) {
    const html = FacetFiltersForm.filterData.find(filterDataUrl).html;

    // Update all relevant parts of the page from cache
    FacetFiltersForm.renderCollectionActions(html);
    FacetFiltersForm.renderFilters(html, event);
    FacetFiltersForm.renderProductGridContainer(html);
    FacetFiltersForm.renderProductCount(html);
  }

  /**
   * Update the product grid with new products
   * @param {string} html - Full HTML response from server
   * @param {boolean} appendResults - If true, prepend existing products (load more pagination)
   */
  static renderProductGridContainer(html, appendResults) {
    const container = document.getElementById("ProductGridContainer");
    const parsedDom = new DOMParser().parseFromString(html, "text/html");

    // For "load more" pagination, keep existing products and add new ones
    if (appendResults) {
      parsedDom
        .getElementById("product-grid")
        .prepend(...[...document.getElementById("product-grid").childNodes]);
    }

    // Replace the entire container with new HTML
    container.innerHTML = parsedDom.getElementById("ProductGridContainer").innerHTML;
  }

  /**
   * Update the product count display (e.g., "Showing 24 of 156 products")
   * @param {string} html - Full HTML response from server
   */
  static renderProductCount(html) {
    const count = new DOMParser()
      .parseFromString(html, "text/html")
      .getElementById("ProductCount")?.innerHTML;
    const container = document.getElementById("ProductCount");

    if (!container) {
      return;
    }

    container.innerHTML = count;
    container.classList.remove("loading");
  }

  /**
   * Update the collection actions bar (sort dropdown, product count, active filters)
   * @param {string} html - Full HTML response from server
   */
  static renderCollectionActions(html) {
    const container = document.getElementById("CollectionActions");
    const parsedDom = new DOMParser().parseFromString(html, "text/html");

    if (!container) {
      return;
    }

    const parsedContainerActions = parsedDom.getElementById("CollectionActions");

    // Preserve sticky state if the bar is currently stuck
    if (container.classList.contains("is-stuck")) {
      parsedContainerActions.classList.add("is-stuck");
    }

    // Update classes from new HTML
    container.classList = parsedContainerActions.classList;

    // Update the main content (sort dropdown, product count)
    const parsedCollectionActionsMain = parsedContainerActions.querySelector(
      ".collection-actions-main, .section-main-search",
    );
    const collectionActionsMain = container.querySelector(".collection-actions-main");

    if (parsedCollectionActionsMain && collectionActionsMain) {
      collectionActionsMain.classList = parsedCollectionActionsMain.classList;
      collectionActionsMain.innerHTML = parsedCollectionActionsMain.innerHTML;
    }
  }

  /**
   * Update the filter sidebar with new facet options
   * This is the KEY method that preserves facet expanded/collapsed state
   * @param {string} html - Full HTML response from server
   * @param {Event} event - The triggering event (used to determine scroll behavior)
   */
  static renderFilters(html, event) {
    const parsedHTML = new DOMParser().parseFromString(html, "text/html");

    const oldFacetElements = document.querySelectorAll("#FacetFiltersForm .js-filter");
    const newFacetElements = parsedHTML.querySelectorAll("#FacetFiltersForm .js-filter");

    // STEP 1: Save which facets are currently expanded BEFORE removing them from DOM
    // This preserves user's expanded state through the AJAX update
    const expandedFacets = [];
    document
      .querySelectorAll('#FacetFiltersForm .js-filter collapsible-expandable[expanded="true"]')
      ?.forEach((node) => {
        const parent = node.closest(".js-filter");
        if (node.getAttribute("expanded")) {
          // Save the filter name (e.g., "filter.v.option.color")
          expandedFacets.push(parent.dataset.name);
        }
      });

    // STEP 2: Save currently focused element to restore focus after update
    const facetsContainer = document.querySelector(
      "#FacetFiltersForm .page-layout-sidebar-inner-content",
    );
    const focusedElement = document.activeElement;
    let focusedFilterId = null;
    if (facetsContainer?.contains(focusedElement)) {
      focusedFilterId = focusedElement.id;
    }

    // STEP 3: Set min-height to prevent layout shift during replacement
    if (facetsContainer) {
      const previousHeight = facetsContainer?.getBoundingClientRect().height;
      facetsContainer.style.minHeight = `${previousHeight}px`;
    }

    // STEP 4: Remove old facets and add new ones, restoring expanded state
    oldFacetElements.forEach((facet) => facet.remove());
    newFacetElements.forEach((element) => {
      // Check if this facet was previously expanded
      const isExpanded = expandedFacets.includes(element.dataset.name);
      // Apply the expanded state to the new element
      element.querySelector(".facet-toggle").setAttribute("aria-expanded", isExpanded);
      element.querySelector("collapsible-expandable").setAttribute("expanded", isExpanded);
      facetsContainer.append(element);
    });

    // STEP 5: Restore keyboard focus to the element user was interacting with
    if (focusedFilterId) {
      document.getElementById(focusedFilterId)?.focus({ preventScroll: true });
    }

    // STEP 6: Remove min-height constraint after DOM update completes
    if (facetsContainer) {
      requestAnimationFrame(() => {
        facetsContainer.style.minHeight = "";
      });
    }

    // STEP 7: Optional scroll to top behavior (if enabled in theme settings)
    // Scrolls user back to top of products when they change filters (desktop only)
    const scrollTop = document.querySelector("facet-filters-form").dataset.scrollTop === "true";
    const container = document.getElementById("CollectionActions");
    if (
      scrollTop &&
      container &&
      window.innerWidth >= 990 && // Desktop only
      !event?.target.name.includes(".price.") // Don't scroll for price range changes
    ) {
      const offset = document.querySelector("sticky-header:not([disabled])")?.offsetHeight ?? 0;
      const rect = container.getBoundingClientRect();
      const scrollPosition = window.scrollY + rect.top - offset;
      // Only scroll if collection actions bar is above viewport
      if (rect.top < 0) {
        window.scrollTo({
          top: scrollPosition,
          behavior: "smooth",
        });
      }
    }

    // STEP 8: Update the active filters display (the chips showing selected filters)
    FacetFiltersForm.renderActiveFacets(parsedHTML);
  }

  /**
   * Update the active filters display (the filter chips/tags showing current selections)
   * @param {HTMLDocument} html - Parsed HTML document from server
   */
  static renderActiveFacets(html) {
    const activeFacetElementSelectors = [".collection-actions-filters"];

    activeFacetElementSelectors.forEach((selector) => {
      const activeFacetsElement = html.querySelector(selector);
      if (!activeFacetsElement) {
        return;
      }

      // Replace the active filters HTML
      document.querySelector(selector).innerHTML = activeFacetsElement.innerHTML;
    });

    // Re-enable the remove buttons (they were disabled at the start of the request)
    FacetFiltersForm.toggleActiveFacets(false);
  }

  /**
   * Update the browser URL with filter parameters
   * @param {string} searchParams - URL query string to set
   * @param {boolean} replace - If true, replace current history entry instead of pushing new one
   */
  static updateURLHash(searchParams, replace) {
    if (replace) {
      // Replace current URL without adding to history (used for page load initialization)
      history.replaceState(
        { searchParams },
        "",
        `${window.location.pathname}${searchParams && "?".concat(searchParams)}`,
      );
    } else {
      // Push new URL to history (allows back/forward navigation)
      history.pushState(
        { searchParams },
        "",
        `${window.location.pathname}${searchParams && "?".concat(searchParams)}`,
      );
    }
  }

  /**
   * Get the sections that need to be fetched via AJAX
   * @returns {Array} Array of section objects with section IDs
   */
  static getSections() {
    return [
      {
        section: document.querySelector("#product-grid, #product-rows").dataset.id,
      },
    ];
  }

  /**
   * Handle form submission (triggered by debounced input events)
   * @param {Event} event - The form submit event
   */
  onSubmitHandler(event) {
    event.preventDefault();
    // Collect all form data (checked filters, sort option, price range)
    const formData = new FormData(document.getElementById("FacetsFilterForm"));
    const searchParams = new URLSearchParams(formData).toString();
    // Trigger page re-render with new parameters
    FacetFiltersForm.renderPage(searchParams, event);
  }

  /**
   * Handle clicks on active filter remove buttons (the X on filter chips)
   * @param {Event} event - The click event
   */
  onActiveFilterClick(event) {
    event.preventDefault();
    // Disable all remove buttons to prevent multiple clicks
    FacetFiltersForm.toggleActiveFacets();

    // Extract search params from the removal link's href
    const url =
      event.currentTarget.href.indexOf("?") == -1
        ? ""
        : event.currentTarget.href.slice(event.currentTarget.href.indexOf("?") + 1);

    // Re-render with the filter removed
    FacetFiltersForm.renderPage(url);
  }

  /**
   * Handle AJAX pagination (clicking page numbers)
   * @param {Event} event - The click event on pagination link
   */
  onAjaxPagination(event) {
    event.preventDefault();
    const next = event.currentTarget;

    // Extract search params from pagination link
    const url = next.href.indexOf("?") == -1 ? "" : next.href.slice(next.href.indexOf("?") + 1);

    // Render new page
    FacetFiltersForm.renderPage(url, event, true);

    // Scroll to top of main content
    document.getElementById("MainContent").scrollIntoView(true);

    // Dispatch custom event for analytics/tracking
    const params = new URLSearchParams(url);
    const customEvent = new CustomEvent("pagination:page-change", {
      detail: {
        page: Number(params.get("page")),
      },
    });
    document.dispatchEvent(customEvent);
  }
}

// Initialize static properties for caching and history management
FacetFiltersForm.filterData = []; // Cache of fetched HTML responses
FacetFiltersForm.searchParamsInitial = window.location.search.slice(1); // Initial page load params
FacetFiltersForm.searchParamsPrev = window.location.search.slice(1); // Previous params for comparison

// Register the custom element
customElements.define("facet-filters-form", FacetFiltersForm);

// Set up browser back/forward button listeners
FacetFiltersForm.setListeners();

/**
 * Price range filter component
 * Handles the min/max price input fields and ensures valid ranges
 */
class PriceRange extends HTMLElement {
  constructor() {
    super();
    // Listen for changes to both min and max inputs
    this.querySelectorAll("input").forEach((element) =>
      element.addEventListener("change", this.onRangeChange.bind(this)),
    );

    // Set initial constraints
    this.setMinAndMaxValues();
  }

  /**
   * Handle changes to price inputs
   * @param {Event} event - The input change event
   */
  onRangeChange(event) {
    this.adjustToValidValues(event.currentTarget);
    this.setMinAndMaxValues();
  }

  /**
   * Update min/max constraints on both inputs to prevent invalid ranges
   * E.g., if max is set to 100, min can't be more than 100
   */
  setMinAndMaxValues() {
    const inputs = this.querySelectorAll("input");
    const minInput = inputs[0];
    const maxInput = inputs[1];

    // Max input value becomes the ceiling for min input
    if (maxInput.value) minInput.setAttribute("max", maxInput.value);
    // Min input value becomes the floor for max input
    if (minInput.value) maxInput.setAttribute("min", minInput.value);
    // Reset to defaults if cleared
    if (minInput.value === "") maxInput.setAttribute("min", 0);
    if (maxInput.value === "") minInput.setAttribute("max", maxInput.getAttribute("max"));
  }

  /**
   * Clamp input value to valid range
   * @param {HTMLInputElement} input - The input to validate
   */
  adjustToValidValues(input) {
    const value = Number(input.value);
    const min = Number(input.getAttribute("min"));
    const max = Number(input.getAttribute("max"));

    if (value < min) input.value = min;
    if (value > max) input.value = max;
  }
}

customElements.define("price-range", PriceRange);

/**
 * Facet remove button component
 * Wraps individual filter removal links (X buttons on filter chips)
 */
class FacetRemove extends HTMLElement {
  constructor() {
    super();
    // When clicked, trigger the parent form's filter removal handler
    this.querySelector("a").addEventListener("click", (event) => {
      event.preventDefault();
      const form =
        this.closest("facet-filters-form") || document.querySelector("facet-filters-form");
      form.onActiveFilterClick(event);
    });
  }
}

customElements.define("facet-remove", FacetRemove);

/**
 * AJAX pagination component
 * Handles pagination links to load new pages without full page refresh
 */
class AjaxPaginate extends HTMLElement {
  constructor() {
    super();
    const form = this.closest("facet-filters-form") || document.querySelector("facet-filters-form");
    const buttons = this.querySelectorAll("a");

    // Make all pagination links trigger AJAX instead of full page load
    buttons.forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        form.onAjaxPagination(event);
      });
    });
  }
}

customElements.define("ajax-paginate", AjaxPaginate);

/**
 * Sticky collection actions bar component
 * Makes the filter/sort bar stick to top of page when scrolling
 */
class StickyCollectionActions extends HTMLElement {
  constructor() {
    super();

    this.sticky = this.children[0];
    this.createObserver();
  }

  /**
   * Use IntersectionObserver to detect when bar should be stuck
   */
  createObserver() {
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Add 'is-stuck' class when the element scrolls above viewport
        entry.target.classList.toggle("is-stuck", entry.boundingClientRect.top < 0);
      },
      { threshold: 1 },
    );

    observer.observe(this.sticky);
  }
}

customElements.define("sticky-collection-actions", StickyCollectionActions);

/**
 * Utility function: Convert URL query string to object
 * Handles multiple values for the same key by joining them with commas
 *
 * Example input: "filter.v.option.color=Blue&filter.v.option.color=Red&sort_by=price-asc"
 * Example output: { "filter.v.option.color": "Blue,Red", "sort_by": "price-asc" }
 *
 * @param {string} queryString - The query string to parse
 * @returns {Object} Deserialized parameters object
 */
const deserializeSearchParams = (queryString) => {
  const params = new URLSearchParams(queryString);
  const result = {};

  for (const [key, value] of params.entries()) {
    // If key already exists, append the new value with a comma
    if (result[key]) {
      result[key] = `${result[key]},${value}`;
    } else if (value) {
      result[key] = value;
    }
  }

  return result;
};
