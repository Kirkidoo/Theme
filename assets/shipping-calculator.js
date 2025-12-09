"use strict";

if (!customElements.get("shipping-calculator")) {
  customElements.define(
    "shipping-calculator",
    class ShippingCalculator extends HTMLElement {
      constructor() {
        super();

        this.country = this.querySelector(".country");
        this.province = this.querySelector(".province");
        this.postcode = this.querySelector(".postcode");
        this.button = this.querySelector(".button");
        this.rates = this.querySelector(".shipping-rates");
        this.errors = this.querySelector(".errors");

        this.sortCountries();

        this.country.addEventListener("change", this.onCountryChange.bind(this));
        this.button.addEventListener("click", this.onSubmit.bind(this));

        // Trigger change to handle showing the Province dropdown if necessary.
        this.country.dispatchEvent(new Event("change"));
      }

      onSubmit(event) {
        event.preventDefault();

        this.classList.add("loading");
        this.rates.classList.add("hidden");
        this.rates.innerHTML = "";

        this.errors.classList.add("hidden");
        this.errors.innerHTML = "";

        const errors = [];

        const query = new URLSearchParams({
          "shipping_address[country]": this.country.value,
          "shipping_address[province]": this.province?.value,
          "shipping_address[zip]": this.postcode.value,
        });

        fetch(`${window.routes.cart_url}/shipping_rates.json?${query.toString()}`)
          .then((data) => data.json())
          .then((json) => {
            if (!json) {
              errors.push(window.shippingCalculator.fetchError);
            }

            json.country && json.country.forEach((error) => errors.push(error));
            json.province && json.province.forEach((error) => errors.push(error));
            json.zip && json.zip.forEach((error) => errors.push(error));

            if (errors.length > 0) {
              // Do nothing. We just want to skip the other checks.
            } else if (json.shipping_rates && json.shipping_rates.length > 0) {
              let html = "";

              json.shipping_rates.forEach((rate) => {
                // Something like "[name]: [symbol][amount] [currency]"
                let shipping = window.shippingCalculator.shippingRateTemplate;
                if (rate.description) {
                  // Something like "[name]: [symbol][amount] [currency] ([description])"
                  shipping = window.shippingCalculator.shippingRateWithDescriptionTemplate;
                }

                let symbol = "";
                if (
                  rate.currency === window.shippingCalculator.currencyCode &&
                  window.shippingCalculator.currencySymbol
                ) {
                  symbol = window.shippingCalculator.currencySymbol;
                }

                shipping = shipping.replaceAll("[name]", rate.presentment_name);
                shipping = shipping.replaceAll("[symbol]", symbol);
                shipping = shipping.replaceAll("[amount]", rate.price);
                shipping = shipping.replaceAll("[currency]", rate.currency);
                shipping = shipping.replaceAll("[description]", rate.description);

                html += `<li>${shipping}</li>`;
              });
              html = `<ul>${html}</ul>`;
              this.rates.append(this.createElement(html));
              this.rates.classList.remove("hidden");
            } else {
              errors.push(window.shippingCalculator.noRatesAvailable);
            }
          })
          .catch(() => {
            errors.push(window.shippingCalculator.responseError);
          })
          .finally(() => {
            this.classList.remove("loading");

            if (errors.length > 0) {
              let html = "";
              errors.forEach((error) => {
                html += `<li>${error}</li>`;
              });
              html = `<ul>${html}</ul>`;

              this.errors.append(this.createElement(html));
              this.errors.classList.remove("hidden");
            }
          });
      }

      onCountryChange(event) {
        const provinces = JSON.parse(
          this.country.querySelector(`option[value="${event.target.value}"]`).dataset.provinces,
        );
        this.province.innerHTML = "";

        if (provinces && provinces.length > 0) {
          let newHtml = "";
          provinces.forEach(([value, label]) => {
            newHtml += `<option value="${value}">${label}</option>`;
          });

          const newElements = Array.from(this.createElements(newHtml));
          newElements.forEach((element) => {
            this.province.append(element);
          });

          this.enableProvince();
        } else {
          this.disableProvince();
        }
      }

      enableProvince() {
        this.province.disabled = false;
        this.province.parentElement.classList.remove("hidden");
      }

      disableProvince() {
        this.province.disabled = true;
        this.province.parentElement.classList.add("hidden");
      }

      sortCountries() {
        const otherOptions = Array.from(this.country.children);
        const firstOption = otherOptions.shift();

        if (otherOptions.length >= 1) {
          // Disable the default "---" option.
          firstOption.disabled = true;

          // Sort countries alphabetically
          const comparator = new Intl.Collator().compare;
          otherOptions.sort((a, b) => {
            return comparator(a.textContent, b.textContent);
          });

          // otherOptions.sort((a, b) => a.getAttribute('value').localeCompare( b.getAttribute('value') ));
          this.country.innerHTML = "";
          this.country.append(firstOption);
          otherOptions.forEach((elem) => this.country.append(elem));
        }

        this.country.value = firstOption.getAttribute("value");
      }

      createElements(stringHtml) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(stringHtml, "text/html");
        return doc.body.children;
      }

      createElement(stringHtml) {
        return this.createElements(stringHtml)[0];
      }
    },
  );
}
