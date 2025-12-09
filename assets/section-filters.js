if (!customElements.get("collections-filtering")) {
  class CollectionsFiltering extends HTMLElement {
    constructor() {
      super();

      this.form = this.querySelector("form");
      this.button = this.querySelector('button[type="submit"]');
      this.select = this.querySelector("select.dropdown-collection");
      this.input = this.querySelector("input.input-collection");
      this.selects = this.querySelectorAll("select.dropdown-filter");

      this.setupEventListeners();

      // There's no collection dropdown so we either need to populate
      // the filters of the entire store or the single collection chosen
      // (if only one collection has been chosen).
      if (!this.select) {
        this.populateCollectionFilters(true);
      }
    }

    setupEventListeners() {
      this.form.addEventListener("submit", (event) => {
        event.preventDefault();
        window.location = this.form.getAttribute("action");
      });
      this.select?.addEventListener("change", this.onCollectionChange.bind(this));
      this.selects.forEach((event) => {
        event.addEventListener("change", this.onFilterChange.bind(this));
      });
    }

    constructURL() {
      const collectionUrl =
        this.select?.value ?? this.input?.value ?? window.routes.all_products_url;
      const url = new URL(collectionUrl, window.requestShopUrl);

      this.querySelectorAll("select.dropdown-filter:enabled").forEach((select) => {
        if (select.value === "") {
          return;
        }

        Array.from(select.selectedOptions).forEach((option) => {
          url.searchParams.set(option.dataset.paramName, option.value);
        });
      });

      return url.toString();
    }

    setFormUrl(url, background) {
      this.form.setAttribute("action", url);

      // This operation happens on the background
      // where the user should not be notified of loading with spinners
      // etc.
      if (!background) {
        this.button.disabled = false;
      }
    }

    selectRemoveOptions(select) {
      const options = select.querySelectorAll("option:not(.default)");

      options.forEach((option) => {
        select.removeChild(option);
      });

      select.querySelector("option").selected = true;
    }

    onFilterChange(event) {
      const selectedIndex = event.target.dataset.index;

      this.selects.forEach((select) => {
        if (Number(select.dataset.index) <= Number(selectedIndex)) {
          return;
        }

        this.selectRemoveOptions(select);
        select.disabled = true;
        select.closest(".form-group").classList.add("disabled");
      });

      this.setFormUrl(this.constructURL());

      const url = new URL(this.constructURL());
      url.searchParams.set("view", "do_not_use");
      this.toggleLoading();

      fetch(url)
        .then((response) => {
          if (!response.ok) {
            throw new Error(response.status);
          }

          return response.text();
        })
        .then((text) => {
          this.toggleLoading();
          const resultsMarkup = new DOMParser().parseFromString(text, "text/html");

          this.selects.forEach((select) => {
            if (Number(select.dataset.index) <= Number(selectedIndex)) {
              return;
            }

            const options = resultsMarkup.querySelectorAll(
              `select[data-label="${select.dataset.label}"] option`,
            );
            if (options.length > 0) {
              const availableOptions = Array.from(options).filter(
                (option) => Number(option.dataset.count) > 0,
              );
              select.append(...availableOptions);
              select.querySelector("option.default").selected = true;
            }

            if (Number(select.dataset.index) === Number(selectedIndex) + 1) {
              select.disabled = false;
              select.closest(".form-group").classList.remove("disabled");
            }
          });
        })
        .catch((error) => {
          throw error;
        });
    }

    populateCollectionFilters(background = false) {
      this.setFormUrl(this.constructURL(), background);

      const url = new URL(this.constructURL());
      url.searchParams.set("view", "do_not_use");

      // When we initially populate the filters we don't want
      // to show a loading spinner.
      if (!background) {
        this.toggleLoading();
      }

      fetch(url)
        .then((response) => {
          if (!response.ok) {
            throw new Error(response.status);
          }

          return response.text();
        })
        .then((text) => {
          if (!background) {
            this.toggleLoading();
          }

          const resultsMarkup = new DOMParser().parseFromString(text, "text/html");

          this.selects.forEach((select) => {
            const options = resultsMarkup.querySelectorAll(
              `select[data-label="${select.dataset.label}"] option`,
            );
            if (options.length > 0) {
              select.append(...options);
              select.querySelector("option.default").selected = true;
            }

            if (Number(select.dataset.index) === 1) {
              select.disabled = false;
              select.closest(".form-group").classList.remove("disabled");
            }
          });
        })
        .catch((error) => {
          throw error;
        });
    }

    onCollectionChange() {
      this.selects.forEach((select) => {
        this.selectRemoveOptions(select);
        select.disabled = true;
        select.closest(".form-group").classList.add("disabled");
      });

      this.populateCollectionFilters();
    }

    toggleLoading() {
      this.classList.toggle("is-loading");
      this.button.classList.toggle("loading");
    }
  }

  customElements.define("collections-filtering", CollectionsFiltering);
}
