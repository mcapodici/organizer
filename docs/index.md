---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: Organizer
  text: Timelines for everything you want to remember.
  tagline: A local-first app for notes, events, and follow-ups — kept in chronological order, stored on your own device.
  image:
    src: /logo.svg
    alt: Organizer
  actions:
    # target: _self forces a real navigation into the app at /app/ rather than
    # VitePress's client router trying to resolve it as a docs page.
    - theme: brand
      text: Open App Now (No Login)
      link: /app/
      target: _self
    - theme: alt
      text: Read the guide
      link: /guide/getting-started
    - theme: alt
      text: What is Organizer?
      link: /guide/introduction

features:
  - icon:
      src: /feature-icons/timelines.svg
      width: 24
      height: 24
    title: Timelines, not folders
    details: Every topic is a timeline you add to over time. Each entry is timestamped, so you always see how things unfolded.
  - icon:
      src: /feature-icons/rich-text.svg
      width: 24
      height: 24
    title: Rich-text entries
    details: Bold, lists, tables, code, highlights, links, and more. Back-date or future-date any entry with a custom timestamp.
  - icon:
      src: /feature-icons/attach.svg
      width: 24
      height: 24
    title: Attach anything
    details: Drop files onto an entry. Images and MP4 videos preview inline; everything else becomes a tidy download link.
  - icon:
      src: /feature-icons/todos.svg
      width: 24
      height: 24
    title: Due dates & todos
    details: Turn any entry into a follow-up with a due date, then track everything outstanding on the Todos page.
  - icon:
      src: /feature-icons/tags.svg
      width: 24
      height: 24
    title: Tags & instant search
    details: Tag timelines to group and filter them, and jump to anything with full-text search across all your entries.
  - icon:
      src: /feature-icons/private.svg
      width: 24
      height: 24
    title: Local-first & private
    details: Your data lives in your browser or a folder you choose — no account, no server. Export to JSON any time.
---
