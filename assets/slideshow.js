if (!customElements.get("slideshow-component")) {
  customElements.define(
    "slideshow-component",
    class SlideshowComponent extends HTMLElement {
      constructor() {
        super();
        this.slideshow = this.querySelector(".slideshow");
        this.isTransitioning = false;
        this.contentAnimationDelay = 400;
        this.contentExitDelay = 400;
        this.flickity = null;
        this.isAutoTransition = false;
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
      }

      connectedCallback() {
        const autoplayEnabled = this.getAttribute("data-autoplay") === "true";
        const autoPlaySpeed = parseInt(this.getAttribute("data-speed"), 10) * 1000;
        this.animationType = this.getAttribute("data-animation-type") ?? "slide";
        this.autoPlayEnabled = autoplayEnabled && autoPlaySpeed > 0;

        if (!this.slideshow) {
          return;
        }

        this.slideshow.style.display = "block";

        // Initialize all content as hidden
        this.initializeContentStates();

        // Performance: Use IntersectionObserver to delay initialization if slideshow is below fold
        if ("IntersectionObserver" in window && this.shouldDeferInitialization()) {
          const rect = this.getBoundingClientRect();
          const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
          if (rect.top < viewportHeight && rect.bottom > 0) {
            this.initializeFlickity(autoPlaySpeed);
          } else {
            this.deferredInit(autoPlaySpeed);
          }
          return;
        }

        this.initializeFlickity(autoPlaySpeed);
      }

      shouldDeferInitialization() {
        const rect = this.getBoundingClientRect();
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
        // If slideshow is more than 1.5 viewports below, defer initialization
        return rect.top > viewportHeight * 1.5;
      }

      deferredInit(autoPlaySpeed) {
        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                this.initializeFlickity(autoPlaySpeed);
                observer.unobserve(this);
              }
            });
          },
          {
            rootMargin: "500px", // Start loading when within 500px of viewport
          },
        );
        observer.observe(this);
      }

      initializeFlickity(autoPlaySpeed) {
        this.flickity = new Flickity(this.slideshow, {
          autoPlay: false,
          cellAlign: "left",
          percentPosition: true,
          fullscreen: true,
          contain: true,
          resize: true,
          draggable: true,
          prevNextButtons: false,
          fade: this.animationType === "fade",
          cellSelector: ".slideshow-slide",
          initialIndex: 0,
          pageDots: false,
          wrapAround: true,
          accessibility: false,
          on: {
            ready: () => {
              // Show first slide content immediately
              this.showSlideContent(0);

              // Wait a tick for custom elements to be fully defined
              setTimeout(() => {
                // Play first slide video if it exists
                this.playSlideVideo(0);
              }, 50);

              if (this.autoPlayEnabled) {
                this.startAutoplay(autoPlaySpeed);
                document.addEventListener("visibilitychange", this.handleVisibilityChange);
              }

              // Preload next slide (including video) after a delay
              setTimeout(() => {
                this.preloadSlide(1);
              }, 3000);
            },
          },
        });

        this.flickity.on("change", (index) => {
          // Check if this was a user-initiated change (swipe/drag, not programmatic)
          if (!this.isAutoTransition && this.autoPlayEnabled && this.autoplayInterval) {
            this.resetAutoplay();
          }

          this.handleSlideChange(index);

          const event = new CustomEvent("slideshow:slide-change", {
            detail: {
              id: this.getAttribute("id"),
              index,
            },
          });
          document.dispatchEvent(event);
        });
      }

      disconnectedCallback() {
        if (this.autoplayInterval) {
          clearInterval(this.autoplayInterval);
        }
        if (this.tickerInterval) {
          clearInterval(this.tickerInterval);
        }
        document.removeEventListener("visibilitychange", this.handleVisibilityChange);

        // Cleanup
        this.pauseAllVideos();
      }

      handleVisibilityChange() {
        if (!this.autoPlayEnabled) {
          return;
        }

        if (document.hidden) {
          this.pauseAutoplay();
        } else {
          this.resumeAutoplay();
        }
      }

      pauseAutoplay() {
        if (this.autoplayInterval) {
          clearInterval(this.autoplayInterval);
          this.autoplayInterval = null;
        }
        if (this.tickerInterval) {
          clearInterval(this.tickerInterval);
          this.tickerInterval = null;
        }
        // Pause videos when tab is hidden to save resources
        this.pauseAllVideos();
      }

      resumeAutoplay() {
        if (this.autoPlayEnabled && this.autoplaySpeed && !this.autoplayInterval) {
          this.startAutoplay(this.autoplaySpeed);
        }
        // Resume current slide's video when tab becomes visible again
        if (this.flickity && typeof this.flickity.selectedIndex !== "undefined") {
          this.playSlideVideo(this.flickity.selectedIndex);
        }
      }

      initializeContentStates() {
        const allContent = this.querySelectorAll(".slideshow-content-wrap");
        allContent.forEach((content, index) => {
          // Reset all content to hidden state
          content.classList.remove("content-visible", "content-exit");
          content.classList.add("content-enter");
        });
      }

      resetAllContentStates() {
        const allContent = this.querySelectorAll(".slideshow-content-wrap");
        allContent.forEach((content) => {
          content.classList.remove("content-visible", "content-exit");
          content.classList.add("content-enter");
        });
      }

      showSlideContent(index) {
        // First hide all other content
        this.resetAllContentStates();

        const slide = this.querySelectorAll(".slideshow-slide")[index];
        if (slide) {
          const content = slide.querySelector(".slideshow-content-wrap");
          if (content) {
            // Small delay to ensure proper animation
            setTimeout(() => {
              content.classList.remove("content-enter", "content-exit");
              content.classList.add("content-visible");
            }, this.contentAnimationDelay);
          }
        }
      }

      hideSlideContent(index) {
        const slide = this.querySelectorAll(".slideshow-slide")[index];
        if (slide) {
          const content = slide.querySelector(".slideshow-content-wrap");
          if (content) {
            content.classList.remove("content-visible");
            content.classList.add("content-exit");
          }
        }
      }

      hideCurrentSlideContent() {
        if (this.flickity && typeof this.flickity.selectedIndex !== "undefined") {
          this.hideSlideContent(this.flickity.selectedIndex);
        }
      }

      handleSlideChange(index) {
        // Pause all videos first (performance optimization)
        this.pauseAllVideos();

        // Preload next slide (including video sources)
        this.preloadSlide(index + 1);

        // Show content for current slide
        this.showSlideContent(index);

        // Play video for current slide
        this.playSlideVideo(index);

        if (typeof publish !== "undefined") {
          publish(PUB_SUB_EVENTS.slideshowSlideChange, {
            id: this.getAttribute("id"),
            index,
          });
        }
      }

      startAutoplay(speed) {
        this.autoplaySpeed = speed;

        if (this.tickerInterval) {
          clearInterval(this.tickerInterval);
        }

        if (this.autoplayInterval) {
          clearInterval(this.autoplayInterval);
        }

        this.autoplayInterval = setInterval(() => {
          this.isAutoTransition = true;
          this.transitionToNext();
        }, speed);
      }

      resetAutoplay() {
        if (this.autoplayInterval) {
          clearInterval(this.autoplayInterval);
        }

        if (this.tickerInterval) {
          clearInterval(this.tickerInterval);
        }

        if (this.autoPlayEnabled && this.autoplaySpeed) {
          this.startAutoplay(this.autoplaySpeed);
        }
      }

      transitionToNext() {
        if (this.isTransitioning || !this.flickity) {
          return;
        }

        this.isTransitioning = true;

        // Reset autoplay timer when manually navigating
        if (this.autoPlayEnabled && this.autoplayInterval) {
          this.resetAutoplay();
        }

        // Hide current content first
        this.hideCurrentSlideContent();

        // Then change slide
        setTimeout(() => {
          this.flickity.next();
          this.isTransitioning = false;
          this.isAutoTransition = false;
        }, this.contentExitDelay);
      }

      transitionToPrev() {
        if (this.isTransitioning || !this.flickity) {
          return;
        }

        this.isTransitioning = true;

        // Reset autoplay timer when manually navigating
        if (this.autoPlayEnabled && this.autoplayInterval) {
          this.resetAutoplay();
        }

        this.hideCurrentSlideContent();

        setTimeout(() => {
          this.flickity.previous();
          this.isTransitioning = false;
          this.isAutoTransition = false;
        }, this.contentExitDelay);
      }

      goToSlide(index) {
        if (this.isTransitioning || !this.flickity) {
          return;
        }

        this.isTransitioning = true;

        // Reset autoplay timer when manually navigating
        if (this.autoPlayEnabled && this.autoplayInterval) {
          this.resetAutoplay();
        }

        this.hideCurrentSlideContent();

        setTimeout(() => {
          this.flickity.select(index);
          this.isTransitioning = false;
          this.isAutoTransition = false;
        }, this.contentExitDelay);
      }

      preloadSlide(index) {
        const slide = this.querySelectorAll(".slideshow-slide")[index];

        if (slide) {
          const media = slide.querySelector(".slideshow-media");
          if (media) {
            media.style.display = "block";
          }

          const images = slide.querySelectorAll("img");
          [...images].forEach((image) => {
            image.loading = "";
          });

          // Performance: Preload video sources for next slide
          const video = this.getSlideVideo(index);
          if (video && !video.videoLoaded && typeof video.loadSources === "function") {
            video.loadSources();
          }
        }
      }

      getSlideVideo(index) {
        const slides = this.querySelectorAll(".slideshow-slide");
        const slide = slides[index];
        if (!slide) {
          return null;
        }
        return slide.querySelector("slideshow-video");
      }

      playSlideVideo(index) {
        const video = this.getSlideVideo(index);
        if (!video) {
          return;
        }

        // Check if video is disabled on mobile
        if (
          window.innerWidth < 750 &&
          video.classList.contains("slideshow-video-mobile-disabled")
        ) {
          return;
        }

        // Check if methods exist (custom element is defined)
        if (typeof video.play !== "function") {
          return;
        }

        video.play();
      }

      pauseAllVideos() {
        const allVideos = this.querySelectorAll("slideshow-video");
        allVideos.forEach((video) => {
          if (video && video.isPlaying && typeof video.pause === "function") {
            video.pause();
          }
        });
      }

      pauseVideoAtIndex(index) {
        const video = this.getSlideVideo(index);
        if (video && video.isPlaying && typeof video.pause === "function") {
          video.pause();
        }
      }
    },
  );
}

if (!customElements.get("slideshow-navigation")) {
  customElements.define(
    "slideshow-navigation",
    class SlideshowNavigation extends HTMLElement {
      constructor() {
        super();
        this.slideshow = this.closest("slideshow-component");
        this.initAttempts = 0;
        this.maxInitAttempts = 20;
      }

      connectedCallback() {
        this.tryInitialize();
      }

      tryInitialize() {
        this.initAttempts++;

        if (!this.slideshow || !this.slideshow.flickity) {
          if (this.initAttempts < this.maxInitAttempts) {
            setTimeout(() => this.tryInitialize(), 100);
          }
          return;
        }

        this.flickity = this.slideshow.flickity;
        this.setupNavigation();
      }

      setupNavigation() {
        // Pagination
        const buttons = this.querySelectorAll(".js-page");

        if (buttons.length > 0) {
          this.flickity.on("select", () => {
            buttons.forEach((button) => {
              button.classList.remove("is-active");
            });

            if (buttons[this.flickity.selectedIndex]) {
              buttons[this.flickity.selectedIndex].classList.add("is-active");
            }
          });

          buttons.forEach((button) => {
            button.addEventListener("click", () => {
              const index = [...buttons].findIndex((x) => x === button);
              this.slideshow.goToSlide(index);
            });
          });
        }

        // Previous/Next buttons
        this.buttonPrev = this.querySelector(".js-prev");
        this.buttonNext = this.querySelector(".js-next");

        if (this.buttonPrev) {
          this.buttonPrev.addEventListener("click", (event) => {
            event.preventDefault();
            this.slideshow.transitionToPrev();
          });
        }

        if (this.buttonNext) {
          this.buttonNext.addEventListener("click", (event) => {
            event.preventDefault();
            this.slideshow.transitionToNext();
          });
        }
      }
    },
  );
}
