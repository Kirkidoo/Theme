if (!customElements.get("age-verification")) {
  customElements.define(
    "age-verification",
    class AgeVerification extends ModalDialog {
      constructor() {
        super();

        this.delay = parseInt(this.dataset.delay, 10) * 1000;
        this.id = this.getAttribute("id");
        this.storageName = this.dataset.storageName;
        this.storageExpiration = parseInt(this.dataset.storageExpiration, 10) || 30;
        this.dialogWrap = this.querySelector(".modal-dialog-wrap");

        this.yesButton = this.querySelector(".age-verification-button-yes");
        this.noButton = this.querySelector(".age-verification-button-no");
        this.rejectionMessage = this.querySelector(".age-verification-rejection-message");

        if (this.yesButton) {
          this.yesButton.addEventListener("click", this.handleYesClick.bind(this));
        }

        if (this.noButton) {
          this.noButton.addEventListener("click", this.handleNoClick.bind(this));
        }

        // Replace the close button to remove any existing event listeners
        this.setupCloseButton();
      }

      // Set up the close button with our custom behavior
      setupCloseButton() {
        const closeButton = this.querySelector('[id^="ModalClose-"]');
        if (closeButton) {
          // Clone the button to remove all existing event listeners
          const newCloseButton = closeButton.cloneNode(true);
          closeButton.parentNode.replaceChild(newCloseButton, closeButton);

          // Add our event listener to the new button
          newCloseButton.addEventListener("click", (e) => {
            e.preventDefault();
            this.hide();
          });
        }
      }

      connectedCallback() {
        if (this.storageName && this.isVerified() && !Shopify.designMode) {
          return;
        }

        // Show the age verification after the specified delay
        if (!Shopify.designMode) {
          setTimeout(() => {
            this.show();
          }, this.delay);
        }

        return super.connectedCallback();
      }

      handleYesClick() {
        // Save verification to localStorage
        if (this.storageName) {
          this.saveVerification();
        }
        this.hide();

        const event = new CustomEvent("age-verification:verified", {
          detail: {
            id: this.id,
          },
        });
        document.dispatchEvent(event);
      }

      handleNoClick() {
        if (this.rejectionMessage) {
          this.rejectionMessage.style.display = "block";
        }

        const event = new CustomEvent("age-verification:rejected", {
          detail: {
            id: this.id,
          },
        });
        document.dispatchEvent(event);
      }

      show() {
        super.show();
        const event = new CustomEvent("age-verification:open", {
          detail: {
            id: this.id,
          },
        });
        document.dispatchEvent(event);
      }

      hide() {
        if (!this.dialogWrap) {
          // Fallback if dialogWrap is not available
          super.hide();
          return;
        }

        setTimeout(() => {
          ModalDialog.prototype.hide.call(this);
          const event = new CustomEvent("age-verification:close", {
            detail: {
              id: this.id,
            },
          });
          document.dispatchEvent(event);
        }, 200);
      }

      // Save verification to localStorage with expiration
      saveVerification() {
        try {
          const now = new Date();
          const expirationDate = new Date(now);
          expirationDate.setDate(now.getDate() + this.storageExpiration);

          const data = {
            verified: true,
            expires: expirationDate.getTime(),
          };

          localStorage.setItem(this.storageName, JSON.stringify(data));
        } catch (e) {
          console.error("Error saving to localStorage:", e);
        }
      }

      // Check if user is verified and verification hasn't expired
      isVerified() {
        try {
          const storedData = localStorage.getItem(this.storageName);
          if (!storedData) return false;

          const data = JSON.parse(storedData);
          const now = new Date().getTime();

          // Check if verification has expired
          if (data.expires && data.expires < now) {
            // Clear expired verification
            localStorage.removeItem(this.storageName);
            return false;
          }

          return data.verified === true;
        } catch (e) {
          console.error("Error reading from localStorage:", e);
          return false;
        }
      }
    },
  );
}
