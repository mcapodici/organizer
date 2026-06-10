---
title: Blog
description: News, tips, and updates from the Organizer team.
---

<script setup>
import { data as posts } from './posts.data.ts';
</script>

# Blog

News, tips, and updates from the Organizer team.

<ul class="blog-list">
  <li v-for="post of posts" :key="post.url" class="blog-list-item">
    <a :href="post.url" class="blog-list-title">{{ post.title }}</a>
    <p class="blog-list-meta">{{ post.dateDisplay }}<template v-if="post.author"> · {{ post.author }}</template></p>
    <p v-if="post.description" class="blog-list-desc">{{ post.description }}</p>
  </li>
</ul>
