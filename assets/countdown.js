if (!customElements.get("countdown-timer")) {
  customElements.define(
    "countdown-timer",
    class Countdown extends HTMLElement {
      constructor() {
        super();
        const date = this.getAttribute("date");
        this.date = date ? date * 1000 : Date.parse(new Date());

        this.updateClock = this.updateClock.bind(this);
        this.getRemainingTime = this.getRemainingTime.bind(this);
        this.end = this.end.bind(this);

        // Kick off the timer
        this.updateClock();
        this.interval = setInterval(this.updateClock, 1000);
      }

      getRemainingTime() {
        const t = this.date - Date.parse(new Date());
        const seconds = Math.floor((t / 1000) % 60);
        const minutes = Math.floor((t / 1000 / 60) % 60);
        const hours = Math.floor((t / (1000 * 60 * 60)) % 24);
        const days = Math.floor(t / (1000 * 60 * 60 * 24));

        return {
          total: t,
          days: days <= 0 ? 0 : days,
          hours: hours <= 0 ? 0 : hours,
          minutes: minutes <= 0 ? 0 : minutes,
          seconds: seconds <= 0 ? 0 : seconds,
        };
      }

      updateClock() {
        const { total, days, hours, minutes, seconds } = this.getRemainingTime();
        const daysEl = this.querySelector(".countdown-days");
        const hoursEl = this.querySelector(".countdown-hours");
        const minutesEl = this.querySelector(".countdown-minutes");
        const secondsEl = this.querySelector(".countdown-seconds");

        [
          [daysEl, days],
          [hoursEl, hours],
          [minutesEl, minutes],
          [secondsEl, seconds],
        ].forEach(([element, value]) =>
          this.updateTimerValue(element, value.toString().padStart(2, "0")),
        );

        if (total <= 0) {
          this.end();
        }
      }

      updateTimerValue(element, value) {
        if (!element) {
          return;
        }

        const html = value
          .toString()
          .split("")
          .map((point) => {
            return `<span class="countdown-value">${point}</span>`;
          })
          .join("");

        element.innerHTML = html;
      }

      end() {
        window.clearInterval(this.interval);
      }
    },
  );
}
