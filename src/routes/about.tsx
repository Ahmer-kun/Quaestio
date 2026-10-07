import { createFileRoute, Link } from "@tanstack/react-router";

import { pageSeo } from "@/lib/seo";

const aboutSeo = pageSeo({
  title: "About — The Question",
  description:
    "A quiet place to write about the question you are trying to answer most in your life — under your username, your real name, or anonymously.",
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
          The Question is a quiet corner of the internet for people who are working something out.
        </p>

        <h2 className="font-serif text-2xl mt-14 mb-4">What it is</h2>
        <p className="font-serif text-[16px] leading-7 text-muted-foreground">
          The Question is a simple writing space, built around a single prompt: what is the question
          you are trying to answer most in your life right now? Not a trivia question, and not a
          headline — the one that keeps coming back to you at odd hours. You write it down, and then
          you write the story that sits behind it: why it matters, where it came from, what you have
          tried, and what you are still unsure about.
        </p>

        <h2 className="font-serif text-2xl mt-14 mb-4">Who it is for</h2>
        <p className="font-serif text-[16px] leading-7 text-muted-foreground">
          It is for anyone who thinks better in writing. If you have ever kept a private journal, or
          typed a long message to a friend and then deleted it, or lain awake turning the same
          thought over — this is a place for you. You do not need to be a writer, and no one is
          grading your sentences. You just need one honest question and a little time to answer it.
        </p>

        <h2 className="font-serif text-2xl mt-14 mb-4">How it works</h2>
        <p className="font-serif text-[16px] leading-7 text-muted-foreground">
          The flow is short and deliberate.
        </p>
        <ul className="mt-4 space-y-3 font-serif text-[16px] leading-7 text-muted-foreground">
          <li>
            <span className="text-foreground">1. Share your question.</span> Write the question you
            are trying to answer; a sentence or two is enough.
          </li>
          <li>
            <span className="text-foreground">2. Write your story.</span> Tell what lies behind the
            question, in your own words and at your own length. There is no required shape.
          </li>
          <li>
            <span className="text-foreground">3. Choose how your name appears.</span> You can
            publish under your username, under your real name (once you add it), or anonymously as
            “Anonymous.” Readers see only the name you chose for each post.
          </li>
        </ul>
        <p className="mt-4 font-serif text-[16px] leading-7 text-muted-foreground">
          Stories appear on the members' feed beside everyone else’s, and you can always edit or delete
          your own posts and comments.
        </p>

        <h2 className="font-serif text-2xl mt-14 mb-4">Accounts</h2>
        <p className="font-serif text-[16px] leading-7 text-muted-foreground">
          You sign up with just a username and a strong password — no email address. There is no
          password recovery, so keep your password somewhere safe. We make no promises beyond what
          you can see: if you post a story, assume it can be read, so share only what you are
          comfortable having other members read.
        </p>

        <Link to="/" className="quiet-link mt-14 inline-block underline underline-offset-4">
          Back to The Question
        </Link>
      </main>
    </div>
  );
}