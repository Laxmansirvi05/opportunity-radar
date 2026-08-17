import { useSyncExternalStore } from "react";

const MOBILE_BREAKPOINT = 768;
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

/**
 * Subscribes to the media query itself rather than mirroring it into state.
 *
 * useSyncExternalStore is the API built for exactly this shape — an external
 * source React does not own — so there is no effect, no synchronous setState
 * on mount, and no window where the value is `undefined` before the first
 * effect flushes (the old version returned false for that frame, which read
 * as "desktop" on a phone until hydration completed).
 *
 * The server snapshot is false: there is no viewport during SSR, so the
 * desktop layout is rendered and corrected on hydration — the same behaviour
 * as before, but now stated explicitly instead of falling out of `undefined`.
 */
function subscribe(onChange: () => void) {
	const mql = window.matchMedia(MOBILE_QUERY);
	mql.addEventListener("change", onChange);
	return () => mql.removeEventListener("change", onChange);
}

export function useIsMobile() {
	return useSyncExternalStore(
		subscribe,
		() => window.matchMedia(MOBILE_QUERY).matches,
		() => false,
	);
}
