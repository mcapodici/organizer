---
title: I built this entirely with AI. It has no AI features.
description: Pretty much every line of Organizer was written by AI. But there's no AI inside the app, and that's on purpose - the whole point is to run your own stuff through your own head.
date: 2026-06-13
author: The Organizer team
---

# {{ $frontmatter.title }}

<p class="blog-post-meta">{{ new Date($frontmatter.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) }} · {{ $frontmatter.author }}</p>

Two things about Organizer surprise people when I say them one after the other.

First: I didn't really write it. Pretty much all the code came out of an AI. Ok that is no so suprising I'd admit!

Second: there are no AI features in it. No "summarise my week", no "draft this
for me", no little chat box in the corner. None of it.

Those two feel like they should clash. The fact that they don't is basically the
whole reason I wanted to write this.

## The AI wrote the code. It didn't decide what to build.

When I say AI wrote the code I mean it pretty literally - call it 99% of the
lines. But "I typed at a chatbot and shipped whatever came out" is not what
happened.

The guidance came from a developer who knew what they were doing: which
framework to reach for, how to lay things out so they stay testable, when a
shortcut is going to bite you later, what "done" actually means for a given
change. The model is genuinely incredible at producing code. It's a lot worse at
working out *which* code is worth producing, and at not quietly cutting a corner
when there's an easier path sitting right there. That judgement is still a human
job. It also happens to be the bit that doesn't show up in a flashy screen
recording of an AI writing a function in four seconds.

So I'm not going to tell you "AI built an app". What actually happened is that AI
took the cost of the typing, the boilerplate, the test scaffolding, the third
rewrite - all the grinding stuff that normally eats your evenings - and dropped it
to almost nothing. And that changed what I got to spend *my* time on.

## So what did I spend the time on? Using my own app.

I'm not a UX person. Never claimed to be. What I am is someone who uses this exact
tool constantly, because I built it for myself first and I actually live in it.

Because changes were so cheap, I could treat
my own irritation as the bug tracker. Every time the app annoyed me, for example, a click that
should've been no clicks, a default that was wrong, some flow that made me stop and
think when I shouldn't have had to. I'd just go get Claude to fix it. Usually while brushing my teeth.
I've lost count of how many of these there were. None of them are impressive on
their own. Together they're the whole difference between an app you put up with and
an app you stop noticing because it just gets out of the way.

It does make me wonder whether I've just built the perfect app *for me* and nobody
else cares. I genuinely don't know yet. But that's a much nicer problem than the
usual one, which is shipping something you've barely touched yourself.

## Why there's no AI *in* the app

This is the bit that may sound odd. Why not? Why not take an app like this and bolt a model onto it.
Summarise my tasks. Tell me what to prioritise. Auto-sort this. Generate me a plan?

I didn't do that. And I don't think I'm going to.

The whole idea behind Organizer is that staying organised isn't something you can
fully hand off. It's the act of running your own
commitments through your own head, working out what actually matters, what can
slip, what you've been avoiding and why. A model doing
it for you just stops you thinking straight. You end up with a
tidy little list you don't trust because you never built the understanding it holds.

What a tool like this can do is get the
nagging stuff out of your head so it stops costing you anything. You've got a dozen
"oh I've got to do this, I've got to remember that" loops running in the background
at any given moment. The app's job is to be somewhere you trust enough to put those
down. You shove a thing in, give it a day, and on that day it tells you about it.
That's it.

The second an AI starts deciding what's important *for* you, you've cooked!

---

*If any of this lands, the app is honestly the best explanation - it's
local-first, there's no account, and your data stays
[on your own device](/blog/posts/why-organizer-is-local-first).*
