import { createContentLoader } from 'vitepress';

// Build-time data loader. VitePress runs this during the build, reads the
// frontmatter of every post in blog/posts/, and bakes the result into the
// static bundle as `data` — no runtime fetching. The blog index imports this
// to render its list. Add a markdown file under blog/posts/ and it appears
// here automatically; no registry to maintain.

export interface Post {
  title: string;
  url: string;
  date: string;        // ISO string, for sorting/serialization
  dateDisplay: string; // pre-formatted for display
  description: string;
  author: string;
}

declare const data: Post[];
export { data };

export default createContentLoader('blog/posts/*.md', {
  excerpt: true,
  transform(raw): Post[] {
    return raw
      .map(({ url, frontmatter }) => ({
        title: frontmatter.title ?? 'Untitled',
        url,
        date: new Date(frontmatter.date).toISOString(),
        dateDisplay: new Date(frontmatter.date).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        description: frontmatter.description ?? '',
        author: frontmatter.author ?? '',
      }))
      // Newest first.
      .sort((a, b) => +new Date(b.date) - +new Date(a.date));
  },
});
