import { createFileRoute, Link } from "@tanstack/react-router";

import { pageSeo } from "@/lib/seo";

const CONTACT_EMAIL = "muhammadahmar032@gmail.com";

const privacySeo = pageSeo({
  title: "Privacy Policy | The Question",
  description:
    "How The Question handles your data: what is collected, who can see it, and how to delete your account.",
  path: "/privacy",
});

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: privacySeo.meta, links: privacySeo.links }),
  component: Privacy,
});

function Mail() {
  return (
    <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-4">
      {CONTACT_EMAIL}
    </a>
  );
}

function Privacy() {
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
          <Link to="/about" className="quiet-link h-auto">
            About
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-2xl px-6 pt-16 pb-24 md:pt-24">
        <p className="eyebrow mb-7">Privacy</p>
        <h1 className="editorial-title">Privacy Policy</h1>
        <p className="mt-3 text-xs text-muted-foreground">Last updated: October 14, 2026</p>
        <p className="editorial-subtitle mt-8">
          This page explains what The Question collects about you, what I do with it, and what you
          can do about it. I've tried to keep it plain. If anything is unclear, write to me at{" "}
          <Mail />.
        </p>

        <h2 className="font-serif text-2xl mt-14 mb-4">Who runs this site</h2>
        <p className="font-serif text-[16px] leading-7 text-muted-foreground">
          The Question is run by one person. In this policy, "I" means me, the person who runs the
          site. For any question about your data, the contact is <Mail />.
        </p>

        <h2 className="font-serif text-2xl mt-14 mb-4">What I collect</h2>
        <p className="font-serif text-[16px] leading-7 text-muted-foreground">
          Things you give me:
        </p>
        <ul className="mt-4 space-y-3 font-serif text-[16px] leading-7 text-muted-foreground">
          <li>
            Your username and password. Your password is stored in scrambled (hashed) form by my
            sign-in provider, so I can't see or read it. There's no email address, so the site uses
            an internal made-up address built from your username to run your login. It isn't a real
            email address and nothing is ever sent to it.
          </li>
          <li>Your real name, only if you choose to add one in Settings.</li>
          <li>
            Everything you write: your questions, stories and comments, along with the name option
            you picked for each one (username, real name or "Anonymous"). Each post and comment
            stays linked to your account inside the database, even when it shows as Anonymous. Other
            members can't see that link. I can.
          </li>
          <li>
            Reports you file about other people's posts or comments, including the category and note
            you choose and which account filed them.
          </li>
          <li>
            Moderation records. If I restrict an account, I keep the reason I wrote down and the
            date. I also keep a short log of moderation actions that holds the action taken and
            internal ID numbers, never the text of anyone's posts.
          </li>
        </ul>

        <p className="mt-6 font-serif text-[16px] leading-7 text-muted-foreground">
          Things collected automatically:
        </p>
        <ul className="mt-4 space-y-3 font-serif text-[16px] leading-7 text-muted-foreground">
          <li>
            Like any website, the services that run this one record basic technical details when you
            visit or sign in, such as your IP address, browser and device type, and what was
            requested. These logs are kept by my hosting providers. I don't use them for advertising
            or tracking people, and I may look at them if I'm fixing a bug or looking into abuse.
          </li>
          <li>
            Your browser stores a login token (in local storage) so you stay signed in. The site has
            no analytics, no ad networks and no tracking cookies.
          </li>
          <li>
            A short-lived record of when your account posts or comments, used to enforce posting
            limits. It holds a timestamp, not any text, and is deleted after a few days or when you
            delete your account.
          </li>
        </ul>

        <h2 className="font-serif text-2xl mt-14 mb-4">How I use it</h2>
        <ul className="mt-4 space-y-3 font-serif text-[16px] leading-7 text-muted-foreground">
          <li>To run the site: log you in, show your posts, and let you edit and delete them.</li>
          <li>To keep it safe: look at reports, restrict accounts that cause harm, and limit abuse.</li>
        </ul>
        <p className="mt-4 font-serif text-[16px] leading-7 text-muted-foreground">
          I don't sell your data, I don't run ads, and I don't build profiles about you.
        </p>

        <h2 className="font-serif text-2xl mt-14 mb-4">Who can see what</h2>
        <ul className="mt-4 space-y-3 font-serif text-[16px] leading-7 text-muted-foreground">
          <li>
            Stories and comments are only visible to people with an account. They aren't public and
            search engines can't read them.
          </li>
          <li>Your username is visible to other signed-in members.</li>
          <li>
            Your real name is only shown next to a post or comment when you choose "Use my real
            name" for it.
          </li>
          <li>
            Who wrote an anonymous post is hidden from other members. I can see it, as can anyone
            with access to the database.
          </li>
          <li>
            I may share information if the law requires it, for example a valid legal request.
          </li>
        </ul>

        <h2 className="font-serif text-2xl mt-14 mb-4">Who else handles your data</h2>
        <p className="font-serif text-[16px] leading-7 text-muted-foreground">
          Two services help me run the site. Supabase hosts the database and handles sign-in. Vercel
          serves the website. They process data on my behalf and have their own privacy policies.
          They may store and process data in other countries, including the United States.
        </p>

        <h2 className="font-serif text-2xl mt-14 mb-4">How long I keep it</h2>
        <p className="font-serif text-[16px] leading-7 text-muted-foreground">
          I keep your data for as long as your account exists. When you delete your account, your
          data is removed, as described below. Technical logs held by my providers follow their own
          schedules. My database provider may also keep backups for a limited time, so deleted data
          can stay in a backup for a while before it's overwritten.
        </p>

        <h2 className="font-serif text-2xl mt-14 mb-4">Your choices</h2>
        <ul className="mt-4 space-y-3 font-serif text-[16px] leading-7 text-muted-foreground">
          <li>
            You can edit or delete any of your posts and comments, and change or remove your real
            name, in the app.
          </li>
          <li>
            You can delete your whole account from Settings. This removes your username and real
            name, all your posts and comments, any reports you filed, and any restriction on the
            account. Comments other people left on your posts disappear along with those posts, and
            reports about your content are removed. Your username becomes available to someone else.
            What stays: the short moderation log (an action and an internal ID, never post text),
            and backups until they're overwritten.
          </li>
          <li>
            Depending on where you live, you may have legal rights over your data, such as access,
            correction and deletion. I'll respond to reasonable requests wherever you are. Because
            there's no email on accounts, the easiest way to act on your data is Settings. For
            anything else, write to <Mail />.
          </li>
        </ul>

        <h2 className="font-serif text-2xl mt-14 mb-4">Children</h2>
        <p className="font-serif text-[16px] leading-7 text-muted-foreground">
          The Question isn't meant for anyone under 16. If you think someone under 16 has an
          account, write to <Mail /> and I'll remove it.
        </p>

        <h2 className="font-serif text-2xl mt-14 mb-4">Security</h2>
        <p className="font-serif text-[16px] leading-7 text-muted-foreground">
          Your data is held by established providers, and member-only content is protected by access
          rules in the database. No system is perfectly secure, so please don't post anything you
          couldn't bear being seen. Because there's no email, I can't recover a lost password.
        </p>

        <h2 className="font-serif text-2xl mt-14 mb-4">Changes</h2>
        <p className="font-serif text-[16px] leading-7 text-muted-foreground">
          If I change this policy, I'll update the date at the top. For significant changes, I'll
          also put a notice on the site.
        </p>

        <h2 className="font-serif text-2xl mt-14 mb-4">Contact</h2>
        <p className="font-serif text-[16px] leading-7 text-muted-foreground">
          <Mail />
        </p>

        <Link to="/" className="quiet-link mt-14 inline-block underline underline-offset-4">
          Back to The Question
        </Link>
      </main>
    </div>
  );
}
