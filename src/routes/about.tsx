import { createFileRoute, Link } from "@tanstack/react-router";

import { pageSeo } from "@/lib/seo";

const aboutSeo = pageSeo({
  title: "About — The Question",
  description:
    "Write down the one question you can't stop thinking about, plus the story behind it. Post under your name or anonymously. Members only.",
  path: "/about",
});

export const Route = createFileRoute("/about")({
  head: () => ({ meta: aboutSeo.meta, links: aboutSeo.links }),
  component: About,
});

function About() {
  return (
    <div className="editorial-shell">
      <header className="editorial-header">
        <Link to="/" className="wordmark text-foreground no-underline">
          The Question
        </Link>
        <nav className="flex items-center gap-6">
          <Link to="/" className="quiet-link h-auto">
            Home
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-2xl px-6 pt-16 pb-24 md:pt-24">
        <p className="eyebrow mb-7">About</p>
        <h1 className="editorial-title">About The Question</h1>
        <p className="editorial-subtitle mt-8">
          The Question is a small site where you write down the one question you can't stop thinking
          about, and then tell the story behind it.
        </p>

        <h2 className="font-serif text-2xl mt-14 mb-4">Why I made it</h2>
        <p className="font-serif text-[16px] leading-7 text-muted-foreground">
          I noticed that the questions I cared about most were the ones I never said out loud. They'd
          go around in my head for months, and when I finally tried to explain one to someone, I'd
          realize I'd never actually put it into words. Writing it down always helped me, so I built
          a place to do that and to read what other people are working through.
        </p>

        <h2 className="font-serif text-2xl mt-14 mb-4">What you do here</h2>
        <p className="font-serif text-[16px] leading-7 text-muted-foreground">
          You get one prompt: what's the question you're trying to answer most right now? Not a
          trivia question. The one that keeps coming back to you at 3 a.m. Write it in a sentence or
          two. Then write whatever sits behind it: where it came from, what you've tried, what you
          still don't know. It can be a paragraph or five pages.
        </p>
        <p className="mt-4 font-serif text-[16px] leading-7 text-muted-foreground">
          Other members can read your story and leave a comment. That's about it. There are no likes
          and no followers.
        </p>

        <h2 className="font-serif text-2xl mt-14 mb-4">Your name</h2>
        <p className="font-serif text-[16px] leading-7 text-muted-foreground">
          When you publish, you pick how your name shows up: your username, your real name if you've
          added one, or just "Anonymous". You choose for each post, and other members only see the
          name you picked.
        </p>

        <h2 className="font-serif text-2xl mt-14 mb-4">Accounts</h2>
        <p className="font-serif text-[16px] leading-7 text-muted-foreground">
          You sign up with a username and a password. No email. The catch is that I can't reset a
          forgotten password, so write it down somewhere. If you lose it, the account is gone.
        </p>
        <p className="mt-4 font-serif text-[16px] leading-7 text-muted-foreground">
          Stories are only visible to people with an account. They aren't public and search engines
          can't read them. Still, assume other members can read what you post, and only share what
          you're comfortable with them reading. You can edit or delete your own posts and comments.
        </p>

        <h2 className="font-serif text-2xl mt-14 mb-4">If something's wrong</h2>
        <p className="font-serif text-[16px] leading-7 text-muted-foreground">
          Every post and comment has a Report button. I read the reports myself. "Anonymous" means
          other members can't tell who wrote something, but I can act on a report, and that can mean
          restricting the account behind it.
        </p>

        <Link to="/" className="quiet-link mt-14 inline-block underline underline-offset-4">
          Back to The Question
        </Link>
      </main>
    </div>
  );
}