// GA4 loads only when VITE_GA_MEASUREMENT_ID is set at build time (e.g. in .env.production).
// GA4 records utm_* query parameters on the landing page automatically, so QR campaign links need no extra code.
const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;

if (MEASUREMENT_ID) {
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", MEASUREMENT_ID);

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(script);
}

export function track(event, params) {
  window.gtag?.("event", event, params);
}
