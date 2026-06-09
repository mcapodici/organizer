<script setup>
import DefaultTheme from 'vitepress/theme';
const { Layout } = DefaultTheme;
</script>

<template>
  <!--
    Replace the home hero's logo image with the autoplaying product demo.
    VitePress only renders the hero image area when the page sets `hero.image`
    in frontmatter, so index.md keeps `image: /logo.svg` purely to switch the
    area on — this slot overrides what actually renders inside it.
  -->
  <Layout>
    <template #home-hero-image>
      <video
        class="hero-demo"
        autoplay
        muted
        loop
        playsinline
        preload="auto"
      >
        <source src="/video/organizer-demo.webm" type="video/webm" />
        <source src="/video/organizer-demo.mp4" type="video/mp4" />
      </video>
    </template>
  </Layout>
</template>

<style>
/* The hero now shows the demo video instead of the animated "O", so suppress
   the logo's blinking eyes and background glow that would otherwise sit over it. */
.VPHero .image-container::before,
.VPHero .image-container::after,
.VPHero .image-bg {
  display: none !important;
}

/* The default hero absolutely-centers the logo inside the image column, which
   left the video floating at center-top. Drop that and let the video flow as a
   normal centered block, so it sits to the RIGHT of the hero text on desktop
   (and stacks above it on narrow screens, per VitePress's column layout). */
.VPHero .image {
  display: flex;
  align-items: center;
  justify-content: center;
}
.VPHero .image-container {
  position: relative;
  transform: none;
  margin: 0;
  width: auto;
  height: auto;
  max-width: 100%;
  animation: none;
}

.hero-demo {
  display: block;
  width: 480px;
  max-width: 100%;
  height: auto;
  border-radius: 14px;
  box-shadow: 0 14px 44px rgba(79, 70, 229, 0.22);
}

@media (max-width: 959px) {
  /* On mobile the hero stacks (video above the text). VitePress applies large
     negative margins here (designed to overlap a logo), which made the video
     bleed to the edges and crowd the nav. Cancel them and inset the video. */
  .VPHero .image {
    margin: 0 0 40px;
    min-height: 0;
  }
  .hero-demo {
    width: 100%;
    max-width: 440px;
  }
}
</style>
