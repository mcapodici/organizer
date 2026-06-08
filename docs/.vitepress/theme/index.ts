import DefaultTheme from 'vitepress/theme';
import { onMounted, watch, nextTick } from 'vue';
import { useRoute } from 'vitepress';
import './custom.css';

// Extend the default VitePress theme. custom.css adds the animated hero logo.
//
// The hero logo's rendered size is responsive and not a simple function of its
// container (VitePress sizes it in a way that doesn't match its own source CSS,
// growing well past the documented max-width at wide viewports). The blinking
// eyes are CSS pseudo-elements sized as a fraction of `--logo`, so to keep them
// locked to the logo at every width we measure the logo's actual width with a
// ResizeObserver and write it to `--logo` on the `.image-container`.
export default {
  extends: DefaultTheme,
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
