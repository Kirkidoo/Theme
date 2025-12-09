document.addEventListener("shopify:block:select", function (event) {
  // Slideshow
  const blockSelectedIsSlide = event.target.classList.contains("slideshow-slide");
  if (blockSelectedIsSlide) {
    const parentSlideshowComponent = event.target.closest("slideshow-component");
    parentSlideshowComponent.flickity.stopPlayer();

    const slideIndex = [...event.target.parentElement.childNodes].indexOf(event.target);

    setTimeout(function () {
      parentSlideshowComponent.flickity.select(slideIndex);
    }, 200);

    return;
  }

  // Sliding Panels
  const blockSelectedIsPanel = event.target.closest("sliding-panel");
  if (blockSelectedIsPanel) {
    setTimeout(function () {
      blockSelectedIsPanel.expand();
    }, 200);
    return;
  }

  // Tabbed content
  const blockSelectedIsTabs = !!event.target.closest("tabs-navigation");
  if (blockSelectedIsTabs) {
    const parentTabsNavigation = event.target.closest("tabs-navigation");

    if (parentTabsNavigation) {
      parentTabsNavigation?.setActiveTab?.(event.target);
    }

    return;
  }

  // Live notifications
  const liveNotifications = event.target.closest("live-notifications");
  if (!!liveNotifications) {
    liveNotifications.querySelectorAll(".live-notification-message").forEach((liveNotification) => {
      liveNotification.style.display = "none";
      liveNotification.classList.remove("editor-visible");
    });
    event.target.style.display = "block";
    event.target.classList.add("editor-visible");
    return;
  }

  const hotspot = event.target.closest(".hotspot");
  if (hotspot) {
    hotspot.querySelector(".hotspot-toggle")?.click();
    return;
  }
});

document.addEventListener("shopify:block:deselect", function (event) {
  const blockDeselectedIsSlide = event.target.classList.contains("slideshow-slide");
  if (!blockDeselectedIsSlide) {
    return;
  }

  const parentSlideshowComponent = event.target.closest("slideshow-component");

  if (parentSlideshowComponent.autoPlayEnabled) {
    parentSlideshowComponent.flickity.playPlayer();
  }
});

document.addEventListener("shopify:section:load", function (event) {
  if (event.target.nodeType === Node.TEXT_NODE) {
    return;
  }

  const mapLocations = event.target.querySelector("map-locations");
  const apiKey = mapLocations?.getAttribute("google-maps-api-key");

  if (event.target.querySelector(".rte")) {
    createResponsiveWrappers();
  }

  if (event.target.querySelector("popup-overlay")) {
    event.target.querySelector("popup-overlay").show();
  }

  if (event.target.querySelector("age-verification")) {
    event.target.querySelector("age-verification").show();
  }

  const liveNotifications = event.target.querySelector("live-notifications");
  if (!!liveNotifications) {
    liveNotifications.style.display = "block";
    initializeLiveNotificationsVisibility(liveNotifications);
  }

  if (!mapLocations || !apiKey) {
    return;
  }

  initializeGoogleMapsScript(apiKey);
});

document.addEventListener("shopify:section:select", (event) => {
  if (event.target.querySelector("popup-overlay")) {
    event.target.querySelector("popup-overlay").show();
  }

  if (event.target.querySelector("age-verification")) {
    event.target.querySelector("age-verification").show();
  }

  const liveNotifications = event.target.querySelector("live-notifications");
  if (liveNotifications) {
    liveNotifications.style.display = "block";
    initializeLiveNotificationsVisibility(liveNotifications);
  }
});

document.addEventListener("shopify:section:deselect", (event) => {
  if (event.target.querySelector("popup-overlay")) {
    event.target.querySelector("popup-overlay").hide();
  }

  if (event.target.querySelector("age-verification")) {
    event.target.querySelector("age-verification").hide();
  }

  if (event.target.querySelector("live-notifications")) {
    event.target.querySelector("live-notifications").style.display = "none";
  }
});

function createResponsiveWrappers() {
  // We wrap each RTE table by a specific class to allow wrapping
  document.querySelectorAll(".rte table").forEach(function (table) {
    table.outerHTML = '<div class="table-wrapper">' + table.outerHTML + "</div>";
  });
  document.querySelectorAll(".rte iframe").forEach(function (iframe) {
    // We scope the wrapping only for YouTube and Vimeo
    if (
      iframe.src.indexOf("youtube") !== -1 ||
      iframe.src.indexOf("youtu.be") !== -1 ||
      iframe.src.indexOf("vimeo") !== -1
    ) {
      iframe.outerHTML = '<div class="video-wrapper">' + iframe.outerHTML + "</div>"; // Re-set the src attribute on each iframe after page load for Chrome's "incorrect iFrame content on 'back'" bug.
      // https://code.google.com/p/chromium/issues/detail?id=395791. Need to specifically target video and admin bar

      iframe.src = iframe.src;
    }
  });
}

function initializeLiveNotificationsVisibility(container) {
  const liveNotificationMessages = container.querySelectorAll(".live-notification-message");
  const hasVisible = [...liveNotificationMessages].reduce((acc, liveNotification) => {
    if (liveNotification.classList.contains("editor-visible")) {
      return true;
    }

    return acc;
  }, false);

  if (!hasVisible) {
    liveNotificationMessages[0].style.display = "block";
    liveNotificationMessages[0].classList.add("editor-visible");
  }
}
