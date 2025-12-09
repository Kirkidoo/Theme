if (!customElements.get("slideshow-video")) {
  customElements.define(
    "slideshow-video",
    class SlideshowVideo extends HTMLElement {
      constructor() {
        super();
        this.player = null;
        this.videoLoaded = false;
        this.isPlaying = false;
        this.wantsToPlay = false;
      }

      connectedCallback() {
        this.player = this.querySelector("video");

        if (!this.player) {
          return;
        }

        // Attach event listeners
        this.player.addEventListener("canplay", () => {
          if (this.wantsToPlay) {
            this.wantsToPlay = false;
            this.player.play().catch((error) => {
              console.warn("Slideshow video play failed:", error);
            });
          }
        });

        this.player.addEventListener("playing", () => {
          this.isPlaying = true;
          this.classList.add("is-playing");
        });

        this.player.addEventListener("pause", () => {
          this.isPlaying = false;
          this.classList.remove("is-playing");
        });

        this.player.addEventListener("loadeddata", () => {
          this.videoLoaded = true;
        });
      }

      play() {
        if (!this.player) {
          return;
        }

        // Load sources if not loaded
        if (this.player.readyState === 0) {
          this.loadSources();
          this.wantsToPlay = true;
          return;
        }

        // If video is ready, play immediately
        if (this.player.readyState >= 3) {
          this.player.play().catch((error) => {
            console.warn("Slideshow video play failed:", error);
          });
        } else {
          // Video is loading (readyState 1-2), wait for canplay event
          this.wantsToPlay = true;
        }
      }

      pause() {
        if (this.player && !this.player.paused) {
          this.player.pause();
        }
        this.wantsToPlay = false;
      }

      loadSources() {
        if (this.videoLoaded) {
          return;
        }

        const sources = this.player.querySelectorAll("source[data-src]");

        if (sources.length === 0) {
          this.videoLoaded = true;
          return;
        }

        sources.forEach((source) => {
          source.src = source.dataset.src;
          source.removeAttribute("data-src");
        });

        this.player.load();
        this.videoLoaded = true;
      }
    },
  );
}
