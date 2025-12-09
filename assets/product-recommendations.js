if (!customElements.get("product-recommendations")) {
  class ProductRecommendations extends HTMLElement {
    constructor() {
      super();
    }

    connectedCallback() {
      this.initializeRecommendations();
    }

    initializeRecommendations() {
      const handleIntersection = (entries, observer) => {
        if (!entries[0].isIntersecting) {
          return;
        }

        observer.unobserve(this);

        fetch(this.dataset.url)
          .then((response) => response.text())
          .then((text) => {
            const html = document.createElement("div");
            html.innerHTML = text;
            const recommendations = html.querySelector("product-recommendations");

            if (recommendations && recommendations.innerHTML.trim().length) {
              this.innerHTML = recommendations.innerHTML;
            }

            if (html.querySelector(".card")) {
              this.classList.add("product-recommendations-loaded");
            }
          })
          .catch((error) => {
            console.error(error);
          });
      };

      new IntersectionObserver(handleIntersection.bind(this), {
        rootMargin: "0px 0px 200px 0px",
      }).observe(this);
    }
  }

  customElements.define("product-recommendations", ProductRecommendations);
}
