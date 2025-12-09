(() => {
  const sections = document.querySelectorAll("map-locations");
  const sectionWithApiKey = [...sections].find((section) =>
    section.getAttribute("google-maps-api-key"),
  );
  const apiKey = sectionWithApiKey?.getAttribute("google-maps-api-key");

  // No section found for some reason or maps API is already loaded/loading.
  if ((!sectionWithApiKey && !Shopify.designMode) || window.googleMapsApi) {
    return;
  }

  if (apiKey) {
    initializeGoogleMapsScript(apiKey);
    return;
  }
})();

function initializeGoogleMapsScript(apiKey) {
  if (!apiKey || window.googleMapsApi) {
    return;
  }

  window.googleMapsApi = true;
  (function (d, script) {
    script = d.createElement("script");
    script.type = "text/javascript";
    script.async = true;
    script.onload = function () {
      registerMapLocationsCustomElement();
    };
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    d.getElementsByTagName("head")[0].appendChild(script);
  })(document);
}

window.initializeGoogleMapsScript = initializeGoogleMapsScript;

function registerMapLocationsCustomElement() {
  if (!customElements.get("map-locations")) {
    customElements.define(
      "map-locations",
      class MapLocations extends HTMLElement {
        constructor() {
          super();
        }

        connectedCallback() {
          this.init();
        }

        init = async () => {
          this.zoom = parseInt(this.getAttribute("zoom"), 10) || 14;
          this.addressElements = this.querySelectorAll("[data-address]");
          this.resetButtonElement = this.querySelector(".map-card-button-reset");
          this.markerImageUrl = this.getAttribute("marker-image-url");
          this.addresses = [...this.addressElements].map((address) => {
            return address.dataset.address;
          });
          this.markers = [];
          this.infoWindows = [];
          this.geocoder = new google.maps.Geocoder();
          const colors = this.getAttribute("colors");
          this.map = new google.maps.Map(
            document.getElementById(`Map-${this.getAttribute("section-id")}`),
            {
              zoom: this.zoom,
              styles: colors ? getMapStyles(JSON.parse(colors)) : undefined,
            },
          );
          await this.populateMap();

          this.handleLocationClick = this.handleLocationClick.bind(this);
          this.querySelectorAll(".js-location-trigger").forEach((location) => {
            location.addEventListener("click", this.handleLocationClick);
          });

          this.handleReset = this.handleReset.bind(this);
          if (this.resetButtonElement) {
            this.resetButtonElement.addEventListener("click", this.handleReset);
          }
        };

        populateMap = async () => {
          // Markers / Geocoding
          const responses = [];
          for (const [index, address] of this.addresses.entries()) {
            try {
              const response = await MapLocations.codeAddress({
                address,
                geocoder: this.geocoder,
              });
              responses.push(response);
            } catch (error) {
              console.error(error);
            }
            // This artificial delay is necessary as the Geocoder has a rate limiter.
            await sleep(Math.min(50 * index, 1000));
          }

          responses.forEach((response, index) => {
            if (index === 0) {
              this.map.setCenter(response.results[0].geometry.location);
            }

            const marker = new google.maps.Marker({
              map: this.map,
              position: response.results[0].geometry.location,
              icon: this.markerImageUrl ?? undefined,
            });

            this.markers.push(marker);
          });

          // Info windows
          this.markers.forEach((marker, index) => {
            const infoWindow = new google.maps.InfoWindow({
              content: this.getInfoWindow(index),
            });
            this.infoWindows.push(infoWindow);
          });

          this.markers.forEach((marker, index) => {
            const infoWindow = this.infoWindows[index];

            marker.addListener("click", () => {
              if (this.activeInfoWindow) {
                this.activeInfoWindow.close();
              }

              infoWindow.open({
                anchor: marker,
                map: this.map,
                shouldFocus: false,
              });

              this.activeInfoWindow = infoWindow;
            });
          });

          if (this.markers.length > 1) {
            this.bounds = new google.maps.LatLngBounds();
            this.markers.forEach((marker) => {
              this.bounds.extend(marker.getPosition());
            });
            this.map.setCenter(this.bounds.getCenter());
            this.map.fitBounds(this.bounds);
          }
        };

        handleLocationClick(event) {
          event.preventDefault();
          const element = event.currentTarget.closest(".section-map-locations-location");
          const index = [...element.parentElement.children].indexOf(element);
          const marker = this.markers[index];
          this.map.setCenter(marker.getPosition());
          this.map.setZoom(this.zoom);
          this.resetButtonElement?.classList.remove("visually-hidden");
        }

        handleReset() {
          if (this.bounds) {
            this.map.setCenter(this.bounds.getCenter());
            this.map.fitBounds(this.bounds);
            this.resetButtonElement?.classList.add("visually-hidden");
          }
        }

        static codeAddress = async ({ address, geocoder }) => {
          if (!address || !geocoder) {
            return null;
          }

          return geocoder.geocode({ address });
        };

        getInfoWindow(markerIndex) {
          const addressElement = this.addressElements[markerIndex].closest(
            ".section-map-locations-location",
          );

          if (addressElement.dataset.info) {
            return `<div class="map-info-window">${addressElement.dataset.info}</div>`;
          }

          const title = addressElement.querySelector(".location-title")?.textContent || "";
          const content = addressElement.querySelector(".location-address")?.innerHTML;

          return `<div class="map-info-window"><h4>${title}</h4>${content}</div>`;
        }
      },
    );
  }
}

function getMapStyles(colors) {
  if (!colors) {
    return [];
  }

  return [
    {
      elementType: "geometry",
      stylers: [
        {
          color: colors.background,
        },
      ],
    },
    {
      elementType: "labels.icon",
      stylers: [
        {
          visibility: "off",
        },
      ],
    },
    {
      elementType: "labels.text.fill",
      stylers: [
        {
          color: colors.foreground,
        },
      ],
    },
    {
      elementType: "labels.text.stroke",
      stylers: [
        {
          color: colors.background,
        },
      ],
    },
    {
      featureType: "administrative",
      elementType: "geometry",
      stylers: [
        {
          visibility: "off",
        },
      ],
    },
    {
      featureType: "administrative.country",
      stylers: [
        {
          visibility: "off",
        },
      ],
    },
    {
      featureType: "administrative.land_parcel",
      stylers: [
        {
          visibility: "off",
        },
      ],
    },
    {
      featureType: "administrative.neighborhood",
      stylers: [
        {
          visibility: "off",
        },
      ],
    },
    {
      featureType: "administrative.locality",
      stylers: [
        {
          visibility: "off",
        },
      ],
    },
    {
      featureType: "poi",
      stylers: [
        {
          visibility: "off",
        },
      ],
    },
    {
      featureType: "road",
      elementType: "geometry.fill",
      stylers: [
        {
          color: colors.fb_3,
        },
      ],
    },
    {
      featureType: "road",
      elementType: "labels.icon",
      stylers: [
        {
          visibility: "off",
        },
      ],
    },
    {
      featureType: "road.arterial",
      elementType: "geometry",
      stylers: [
        {
          color: colors.fb_2,
        },
      ],
    },
    {
      featureType: "road.highway",
      elementType: "geometry",
      stylers: [
        {
          color: colors.fb_1,
        },
      ],
    },
    {
      featureType: "road.highway.controlled_access",
      stylers: [
        {
          visibility: "off",
        },
      ],
    },
    {
      featureType: "road.local",
      elementType: "labels.text.fill",
      stylers: [
        {
          color: colors.fb_1,
        },
      ],
    },
    {
      featureType: "road.local",
      elementType: "labels.text.stroke",
      stylers: [
        {
          color: colors.background,
        },
      ],
    },
    {
      featureType: "transit",
      stylers: [
        {
          visibility: "off",
        },
      ],
    },
    {
      featureType: "water",
      elementType: "geometry",
      stylers: [
        {
          color: colors.bm,
        },
      ],
    },
  ];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
