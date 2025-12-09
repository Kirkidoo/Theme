if (!customElements.get("video-background")) {
  customElements.define(
    "video-background",
    class VideoBackground extends HTMLElement {
      constructor() {
        super();
        this.observer = null;
        this.intersecting = false;
        this.videoLoaded = false;
      }

      connectedCallback() {
        this.videoType = this.dataset.type;
        this.videoId = this.dataset.videoId;
        this.sectionId = this.dataset.sectionId;
        this.videoElement = this.querySelector(`#${this.sectionId}-video-player`);
        this.videoLoaderElement = this.querySelector(".video-background-loader");
        this.videoPlayerWrapper = this.querySelector(".video-background-player");

        this.observer = new IntersectionObserver(
          (entries, observer) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting && !this.intersecting) {
                this.intersecting = true;
                this.initializeVideo();
                observer.unobserve(this);
              }
            });
          },
          {
            rootMargin: "200px",
          },
        );

        this.observer.observe(this);
      }

      initializeVideo() {
        switch (this.videoType) {
          case "self-hosted":
            this.initializeSelfHostedVideo();
            break;
          case "youtube":
            VideoBackground.loadYouTube();
            this.initializeYouTube();
            break;
          case "vimeo":
            VideoBackground.loadVimeo();
            this.initializeVimeo();
            break;
        }
      }

      initializeSelfHostedVideo() {
        const player = this.querySelector("video");

        if (!player) {
          return;
        }

        if (!this.videoLoaded) {
          this.loadVideoSources(player);
        }

        const isVideoPlaying = !!(
          player.currentTime > 0 &&
          !player.paused &&
          !player.ended &&
          player.readyState > 2
        );

        if (isVideoPlaying) {
          this.showPlayer();
        }

        player.addEventListener("loadstart", () => {
          this.videoLoaderElement.classList.remove("is-hidden");
        });

        player.addEventListener("canplay", () => {
          if (!isVideoPlaying) {
            player.play().catch((error) => {
              console.warn("Video autoplay failed:", error);
            });
          }
        });

        player.addEventListener("playing", () => {
          this.showPlayer();
        });

        player.addEventListener("error", () => {
          console.error("Video failed to load");
          this.videoLoaderElement.classList.add("is-hidden");
          this.setAttribute("data-loaded", "error");
        });
      }

      loadVideoSources(player) {
        const sources = player.querySelectorAll("source[data-src]");

        sources.forEach((source) => {
          source.src = source.dataset.src;
          source.removeAttribute("data-src");
        });

        player.load();
        this.videoLoaded = true;
      }

      initializeYouTube() {
        if (typeof YT === "undefined" || typeof YT.Player === "undefined") {
          return setTimeout(() => {
            this.initializeYouTube();
          }, 333);
        }

        new YT.Player(`${this.sectionId}-video-player`, {
          videoId: this.videoId,
          playerVars: {
            autoplay: 1,
            controls: 0,
            showinfo: 0,
            modestbranding: 0,
            loop: 1,
            playlist: this.videoId,
            fs: 0,
            autohide: 0,
            mute: 1,
            playsinline: 1,
          },
          events: {
            onReady: (event) => {
              event.target.mute();
              event.target.playVideo();

              setTimeout(() => {
                this.showPlayer();
              }, 1000);
            },
            onStateChange: (event) => {
              if (event.data === YT.PlayerState.PLAYING) {
                this.showPlayer();
              }
            },
          },
        });
      }

      initializeVimeo() {
        if (typeof Vimeo === "undefined" || typeof Vimeo.Player === "undefined") {
          return setTimeout(() => {
            this.initializeVimeo();
          }, 333);
        }

        const player = new Vimeo.Player(this.videoElement, {
          id: this.videoId,
          loop: true,
          autoplay: true,
          byline: false,
          title: false,
          autopause: false,
          muted: true,
          playsinline: true,
          controls: false,
          background: true,
        });

        player.setVolume(0);
        player.on("play", () => {
          this.showPlayer();
        });
      }

      showPlayer() {
        this.videoPlayerWrapper.classList.add("visible");
        this.videoLoaderElement.classList.add("is-hidden");
        this.setAttribute("data-loaded", "true");
      }

      static loadYouTube() {
        if (window.TFP_YOUTUBE_LOADED) {
          return;
        }

        window.TFP_YOUTUBE_LOADED = true;
        const tag = document.createElement("script");
        const [firstScriptTag] = document.getElementsByTagName("script");
        tag.src = "https://www.youtube.com/player_api";
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      }

      static loadVimeo() {
        if (window.TFP_VIMEO_LOADED) {
          return;
        }

        window.TFP_VIMEO_LOADED = true;
        const tag = document.createElement("script");
        const [firstScriptTag] = document.getElementsByTagName("script");
        tag.src = "https://player.vimeo.com/api/player.js";
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      }
    },
  );
}
