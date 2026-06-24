import Link from '@tiptap/extension-link';

/**
 * Link extension configured so that typing immediately after a link does not
 * extend the link mark. By default TipTap's Link mark is "inclusive" (it
 * returns `this.options.autolink`, which is `true`), meaning text typed at the
 * end of a link becomes part of the hyperlink. When pasting a URL and then
 * finishing a sentence, that is almost never what you want, so we force the
 * mark to be non-inclusive while keeping autolink detection enabled.
 */
export const EntryLink = Link.extend({
  inclusive() {
    return false;
  },
}).configure({ openOnClick: false });
