// Fluent UI's Dialog/Drawer/Popover open-close animations (the dim/fade of the modal
// backdrop) are driven by the Web Animations API and gated by
// `window.matchMedia("(prefers-reduced-motion: reduce)")` internally
// (@fluentui/react-motion's useIsReducedMotion) — there's no per-component prop to make
// a single Dialog instant instead. The fade was reported as distracting, so this forces
// that one query to always report "reduced motion" for Fluent's own animations, without
// touching any other matchMedia query (dark mode, print, etc. still work natively) and
// without touching the app's own CSS `@media (prefers-reduced-motion: reduce)` rules,
// which stay tied to the user's real OS setting.
export function forceInstantFluentMotion() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

  const nativeMatchMedia = window.matchMedia.bind(window);

  window.matchMedia = (query: string): MediaQueryList => {
    if (!query.includes("prefers-reduced-motion")) {
      return nativeMatchMedia(query);
    }

    return {
      matches: query.includes("reduce"),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    };
  };
}
