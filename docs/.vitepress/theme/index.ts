import DefaultTheme from 'vitepress/theme';
import { onMounted, watch, nextTick } from 'vue';
import { useRoute } from 'vitepress';
import Layout from './Layout.vue';
import './custom.css';

// Extend the default VitePress theme. Layout.vue swaps the home hero's logo for
// the autoplaying product demo; custom.css still styles the hero wordmark.
//
// The ResizeObserver below dates from the animated logo (now replaced by the
// video). It no-ops on the home page because there's no `.image-src` to measure,
// and is kept only so the logo can be restored without re-deriving it.
//
// The hero logo's rendered size is responsive and not a simple function of its
// container (VitePress sizes it in a way that doesn't match its own source CSS,
// growing well past the documented max-width at wide viewports). The blinking
// eyes are CSS pseudo-elements sized as a fraction of `--logo`, so to keep them
// locked to the logo at every width we measure the logo's actual width with a
// ResizeObserver and write it to `--logo` on the `.image-container`.
export default {
  extends: DefaultTheme,
  Layout,
  setup() {
    if (typeof window === 'undefined') return; // SSR: nothing to measure

    const route = useRoute();
    let observer: ResizeObserver | null = null;

    const sync = () => {
      observer?.disconnect();
      const img = document.querySelector<HTMLElement>('.VPHero .image-src');
      const container = img?.closest<HTMLElement>('.image-container');
      if (!img || !container) return; // not on the home page

      const apply = () => {
        container.style.setProperty('--logo', `${img.getBoundingClientRect().width}px`);
      };
      observer = new ResizeObserver(apply);
      observer.observe(img);
      apply();
    };

    onMounted(() => nextTick(sync));
    // The hero only exists on the home page; re-bind after client-side nav.
    watch(() => route.path, () => nextTick(sync));
  },
};
