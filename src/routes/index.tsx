import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, Ellipsis, MessageCircle, PenLine, UserRound } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import nightHills from "@/assets/night-hills.jpg";

type Identity = "username" | "real_name" | "anonymous";
type Screen = "welcome" | "question" | "signup" | "login" | "story" | "identity" | "feed" | "mine" | "detail" | "settings";
type Post = { id: string; question: string; story: string; display_as: Identity; created_at: string; updated_at: string; display_name: string; is_mine: boolean; comment_count: number };
type Comment = { id: string; post_id: string; body: string; display_as: Identity; created_at: string; updated_at: string; display_name: string; is_mine: boolean };
type Profile = { id: string; username: string; real_name: string | null };
const usernameSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/, "Use 3–24 lowercase letters, numbers, or underscores.");
const passwordSchema = z.string().min(8, "Use at least 8 characters.").max(128);
const questionSchema = z.string().trim().min(10, "Write a little more about your question.").max(500);
const storySchema = z.string().trim().min(10, "Write at least a sentence.").max(10000);
const commentSchema = z.string().trim().min(1, "Write something first.").max(2000);
const emailFor = (username: string) => `${username}@the-question.local`;
function checked<T>(result: z.SafeParseReturnType<unknown, T>): T {
  if (!result.success) throw new Error(result.error.issues[0]?.message ?? "Please check your entry.");
  return result.data;
}
const exactDate = (date: string) => new Intl.DateTimeFormat(undefined, { year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(date));
const shortDate = (date: string) => new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(date));

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "The Question — Stories about what matters" },
    { name: "description", content: "A quiet space to share the question you are trying to answer most in your life right now." },
    { property: "og:title", content: "The Question — Stories about what matters" },
    { property: "og:description", content: "A quiet space to share the question you are trying to answer most in your life right now." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: App,
});

function IdentityPicker({ value, onChange, profile }: { value: Identity; onChange: (value: Identity) => void; profile: Profile | null }) {
  return <div role="radiogroup" aria-label="Public name">
    {(["username", "real_name", "anonymous"] as const).map((option) => <button type="button" role="radio" aria-checked={value === option} data-selected={value === option} className="identity-choice" key={option} onClick={() => onChange(option)}>
      <span className="identity-dot" /><span><span className="block text-[13px]">{option === "username" ? "Use my username" : option === "real_name" ? "Use my real name" : "Stay anonymous"}</span><span className="mt-1 block text-xs text-muted-foreground">{option === "username" ? `e.g. ${profile?.username ?? "your username"}` : option === "real_name" ? profile?.real_name ? `e.g. ${profile.real_name}` : "Add your real name in settings first" : "Just show “Anonymous”"}</span></span>
    </button>)}
  </div>;
}

function App() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [realName, setRealName] = useState("");
  const [question, setQuestion] = useState("");
  const [story, setStory] = useState("");
  const [identity, setIdentity] = useState<Identity>("username");
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [selected, setSelected] = useState<Post | null>(null);
  const [commentText, setCommentText] = useState("");
  const [commentIdentity, setCommentIdentity] = useState<Identity>("username");
  const [editingPost, setEditingPost] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [showCommentIdentity, setShowCommentIdentity] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  async function loadProfile(id: string) {
    const { data, error: err } = await supabase.from("profiles").select("id,username,real_name").eq("id", id).maybeSingle();
    if (err || !data) { setError("Your profile could not be loaded. Please try again."); return; }
    setProfile(data); setRealName(data.real_name ?? "");
  }
  async function loadPosts() {
    const { data, error: err } = await supabase.rpc("feed_posts");
    if (err) { setError("Stories could not be loaded. Please try again."); return; }
    setPosts((data ?? []) as Post[]);
  }
  async function loadComments(id: string) {
    const { data, error: err } = await supabase.rpc("post_comments", { target_post: id });
    if (err) { setError("Comments could not be loaded. Please try again."); return; }
    setComments((data ?? []) as Comment[]);
  }
  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(async ({ data }) => {
      if (!active) return;
      if (data.user) { setUserId(data.user.id); await loadProfile(data.user.id); await loadPosts(); if (active) setScreen("feed"); }
      if (active) setReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") { setUserId(null); setProfile(null); setPosts([]); setSelected(null); setScreen("welcome"); }
      if (event === "SIGNED_IN" && session?.user) setUserId(session.user.id);
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);
  const go = (next: Screen) => { setError(""); setScreen(next); window.scrollTo(0, 0); };
  const work = async (action: () => Promise<void>) => { setError(""); setBusy(true); try { await action(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); } finally { setBusy(false); } };
  const requireSuccess = (err: { message: string } | null) => { if (err) throw new Error(err.message); };
  const account = (mode: "signup" | "login") => work(async () => {
    const handle = checked(usernameSchema.safeParse(username));
    const secret = checked(passwordSchema.safeParse(password));
    if (mode === "signup") {
      const { data, error: err } = await supabase.auth.signUp({ email: emailFor(handle), password: secret });
      requireSuccess(err);
      if (!data.session || !data.user) throw new Error("Account creation did not complete. Please try logging in.");
      const { error: profileError } = await supabase.from("profiles").insert({ id: data.user.id, username: handle });
      if (profileError) throw new Error(profileError.code === "23505" ? "That username is already taken." : "Your profile could not be created. Please try again.");
      setUserId(data.user.id); setProfile({ id: data.user.id, username: handle, real_name: null }); go("story");
    } else {
      const { data, error: err } = await supabase.auth.signInWithPassword({ email: emailFor(handle), password: secret });
      if (err || !data.user) throw new Error("Username or password is incorrect.");
      setUserId(data.user.id); await loadProfile(data.user.id); await loadPosts(); go("feed");
    }
    setPassword("");
  });
  const publish = () => work(async () => {
    if (!userId) throw new Error("Log in to publish your story.");
    const q = checked(questionSchema.safeParse(question)), s = checked(storySchema.safeParse(story));
    if (identity === "real_name" && !profile?.real_name) throw new Error("Add your real name in settings first, or choose another option.");
    if (editingPost) {
      const { data, error: err } = await supabase.rpc("edit_own_post", { target_id: editingPost, new_question: q, new_story: s, new_display_as: identity }); requireSuccess(err); if (!data) throw new Error("This story is no longer available to edit.");
    } else {
      const { error: err } = await supabase.from("posts").insert({ author_id: userId, question: q, story: s, display_as: identity }); requireSuccess(err);
    }
    setEditingPost(null); setQuestion(""); setStory(""); await loadPosts(); go("feed");
  });
  const openPost = async (post: Post) => { setSelected(post); setComments([]); go("detail"); await loadComments(post.id); };
  const removePost = (post: Post) => { if (!window.confirm("Delete this story and its comments? This cannot be undone.")) return; work(async () => { const { data, error: err } = await supabase.rpc("delete_own_post", { target_id: post.id }); requireSuccess(err); if (!data) throw new Error("This story is no longer available to delete."); await loadPosts(); setSelected(null); go("mine"); }); };
  const submitComment = () => work(async () => {
    if (!selected || !userId) return;
    const body = checked(commentSchema.safeParse(commentText));
    if (commentIdentity === "real_name" && !profile?.real_name) throw new Error("Add your real name in settings first, or choose another option.");
    if (editingComment) { const { data, error: err } = await supabase.rpc("edit_own_comment", { target_id: editingComment, new_body: body, new_display_as: commentIdentity }); requireSuccess(err); if (!data) throw new Error("This comment is no longer available to edit."); }
    else { const { error: err } = await supabase.from("comments").insert({ post_id: selected.id, author_id: userId, body, display_as: commentIdentity }); requireSuccess(err); }
    setCommentText(""); setEditingComment(null); setShowCommentIdentity(false); await loadComments(selected.id); await loadPosts();
  });
  const removeComment = (id: string) => { if (!selected || !window.confirm("Delete this comment?")) return; work(async () => { const { data, error: err } = await supabase.rpc("delete_own_comment", { target_id: id }); requireSuccess(err); if (!data) throw new Error("This comment is no longer available to delete."); await loadComments(selected.id); await loadPosts(); }); };
  const saveName = () => work(async () => { if (!userId) return; const name = realName.trim(); if (name.length > 80) throw new Error("Your name must be 80 characters or fewer."); const { error: err } = await supabase.from("profiles").update({ real_name: name || null }).eq("id", userId); requireSuccess(err); setProfile((p) => p ? { ...p, real_name: name || null } : p); await loadPosts(); go("feed"); });
  const signOut = () => work(async () => { const { error: err } = await supabase.auth.signOut(); requireSuccess(err); go("welcome"); });

  const nav = <header className={`editorial-header ${screen === "welcome" ? "welcome-header" : ""}`}><Button variant="link" className="p-0 h-auto text-foreground no-underline hover:no-underline" onClick={() => go(userId ? "feed" : "welcome")}><span className="wordmark">The Question</span></Button><nav className="flex items-center gap-6">{userId ? <><Button variant="link" className="quiet-link h-auto p-0" onClick={() => go("feed")}>Home</Button><Button variant="link" className="quiet-link h-auto p-0" onClick={() => { setQuestion(""); setStory(""); setEditingPost(null); go("question"); }}>New Post</Button><Button variant="ghost" size="icon" aria-label="Settings" title="Settings" onClick={() => go("settings")}><UserRound size={16} /></Button></> : <><Button variant="link" className="quiet-link h-auto p-0" onClick={() => go("login")}>Log in</Button><Button variant="link" className="quiet-link h-auto p-0" onClick={() => go("signup")}>Sign up</Button></>}</nav></header>;
  const smallButton = (label: string, onClick: () => void, disabled = false) => <Button onClick={onClick} disabled={disabled} className="rounded-[2px] px-5 h-9 text-xs">{label} <ArrowRight size={12} /></Button>;
  const formError = error && <p role="alert" className="mt-5 text-sm text-destructive">{error}</p>;
  const back = (to: Screen, label = "Back") => <Button variant="link" onClick={() => go(to)} className="quiet-link p-0 h-auto"><ArrowLeft size={13} /> {label}</Button>;
  const feedCard = (post: Post) => <article key={post.id} className="story-card"><div className="mb-5 flex items-start gap-3"><div className="h-8 w-8 shrink-0 rounded-full border border-border flex items-center justify-center text-muted-foreground"><UserRound size={15} /></div><div className="min-w-0"><div className="text-xs">{post.display_name}</div><time className="text-[11px] text-muted-foreground" dateTime={post.created_at} title={exactDate(post.created_at)}>{shortDate(post.created_at)}</time></div></div><Button variant="link" className="h-auto p-0 text-left whitespace-normal text-foreground hover:text-primary justify-start" onClick={() => openPost(post)}><h2 className="story-heading">{post.question}</h2></Button><p className="mt-4 font-serif text-[15px] leading-7 text-muted-foreground line-clamp-3 whitespace-pre-wrap">{post.story}</p><div className="mt-6 flex items-center gap-5 text-xs text-muted-foreground"><Button variant="link" onClick={() => openPost(post)} className="quiet-link h-auto p-0"><MessageCircle size={14} /> {post.comment_count}</Button><time dateTime={post.created_at} title={exactDate(post.created_at)}>{exactDate(post.created_at)}</time></div></article>;

  return <div className="editorial-shell">{nav}<main key={screen} className="page-enter">
    {!ready ? <div className="mx-auto max-w-xl px-6 pt-24 text-sm text-muted-foreground">Opening…</div> : screen === "welcome" ? <section className="welcome-scene relative flex min-h-[calc(100svh-72px)] flex-col justify-between px-6 py-12 md:px-[9vw] md:py-20"><img src={nightHills} alt="A crescent moon above a quiet hillside at dusk" width={1536} height={1024} className="welcome-landscape" /><div className="relative z-10 mt-[10vh] max-w-2xl"><p className="eyebrow mb-8">01 / 06</p><h1 className="editorial-title max-w-xl">There is probably<br />one question you keep<br />coming back to.</h1><p className="editorial-subtitle mt-10 max-w-xs">Maybe you don’t know how to answer it yet.<br />That’s okay.</p></div><Button variant="link" className="quiet-link relative z-10 w-fit h-auto p-0 mb-4" onClick={() => go("question")}><span className="w-5 h-px bg-muted-foreground" /> Scroll to continue <ArrowDown size={14} /></Button></section>
    : screen === "question" ? <section className="mx-auto max-w-2xl px-6 pt-20 pb-20 md:pt-28"><p className="eyebrow mb-7">02 / 06</p><h1 className="editorial-title max-w-xl">What question are you<br className="hidden sm:block" /> trying to answer most<br className="hidden sm:block" /> in your life right now?</h1><textarea className="quiet-input mt-10 min-h-36 resize-y" placeholder="Write it here…" aria-label="Your question" maxLength={500} value={question} onChange={(e) => setQuestion(e.target.value)} /><p className="text-right text-[11px] text-muted-foreground mt-2">{question.length}/500</p>{formError}<div className="mt-5">{smallButton("Next", () => { const check = questionSchema.safeParse(question); if (!check.success) { setError(check.error.issues[0]?.message ?? "Write your question."); return; } go(userId ? "story" : "signup"); })}</div></section>
    : screen === "signup" || screen === "login" ? <section className="mx-auto max-w-xl px-6 pt-20 pb-20 md:pt-28"><p className="eyebrow mb-7">{screen === "signup" ? "03" : "04"} / 06</p><h1 className="editorial-title">{screen === "signup" ? "Create your account" : "Log in to your account"}</h1>{screen === "signup" && <p className="editorial-subtitle mt-3">Choose a unique username and a strong password.</p>}<form className="mt-9 space-y-5" onSubmit={(e) => { e.preventDefault(); account(screen === "signup" ? "signup" : "login"); }}><label className="block text-xs">Username<input className="quiet-input mt-2" autoComplete="username" placeholder="e.g. nightowl" value={username} maxLength={24} onChange={(e) => setUsername(e.target.value)} required /></label><label className="block text-xs">Password<input className="quiet-input mt-2" type="password" autoComplete={screen === "signup" ? "new-password" : "current-password"} placeholder="At least 8 characters" value={password} minLength={8} onChange={(e) => setPassword(e.target.value)} required /></label>{formError}<Button type="submit" disabled={busy} className="rounded-[2px] h-9 px-5 text-xs">{busy ? "Please wait…" : screen === "signup" ? "Create account" : "Log in"}</Button></form><p className="mt-6 text-xs text-muted-foreground">{screen === "signup" ? "Already have an account?" : "New here?"} <Button variant="link" className="quiet-link h-auto p-0 underline" onClick={() => go(screen === "signup" ? "login" : "signup")}>{screen === "signup" ? "Log in" : "Create account"}</Button></p></section>
    : screen === "story" ? <section className="mx-auto max-w-2xl px-6 pt-16 pb-20 md:pt-24"><div className="flex justify-between items-center mb-9"><p className="eyebrow">05 / 06</p>{back(editingPost ? "mine" : "feed", "Cancel")}</div><h1 className="editorial-title">{editingPost ? "Edit your story" : "Write your story"}</h1><p className="editorial-subtitle mt-3">Tell us what you’re thinking about. It can be a short or long story — there’s no right or wrong way to share.</p><p className="mt-8 text-xs text-muted-foreground">{question}</p><textarea className="quiet-input mt-5 min-h-64 resize-y" placeholder="Start writing here…" aria-label="Your story" maxLength={10000} value={story} onChange={(e) => setStory(e.target.value)} /><p className="text-right text-[11px] text-muted-foreground mt-2">{story.length}/10000</p>{formError}<div className="mt-6 text-right">{smallButton("Next", () => { const check = storySchema.safeParse(story); if (!check.success) { setError(check.error.issues[0]?.message ?? "Write your story."); return; } go("identity"); })}</div></section>
    : screen === "identity" ? <section className="mx-auto max-w-xl px-6 pt-20 pb-20 md:pt-28"><div className="flex justify-between items-center mb-8"><p className="eyebrow">06 / 06</p>{back("story", "Back")}</div><h1 className="editorial-title">How should your name appear?</h1><p className="editorial-subtitle mt-3 mb-9">You can choose how you’d like to be identified in your post.</p><IdentityPicker value={identity} onChange={setIdentity} profile={profile} />{formError}<div className="mt-8 text-right">{smallButton(busy ? "Publishing…" : editingPost ? "Save changes" : "Publish", publish, busy)}</div></section>
    : screen === "feed" || screen === "mine" ? <section className="mx-auto max-w-[760px] px-6 pt-16 pb-24 md:pt-20"><div className="flex items-end justify-between gap-4 border-b border-border pb-7"><div><p className="eyebrow mb-4">The Question</p><h1 className="font-serif text-3xl md:text-4xl">{screen === "mine" ? "My Posts" : "Recent Stories"}</h1></div><Button size="sm" onClick={() => { setQuestion(""); setStory(""); setEditingPost(null); go("question"); }} className="rounded-[2px] text-xs shrink-0"><PenLine size={13} /> New Post</Button></div><div className="mt-5 mb-8 flex gap-6"><Button variant="link" className={`h-auto p-0 text-xs ${screen === "feed" ? "text-foreground" : "text-muted-foreground"}`} onClick={() => go("feed")}>All stories</Button><Button variant="link" className={`h-auto p-0 text-xs ${screen === "mine" ? "text-foreground" : "text-muted-foreground"}`} onClick={() => go("mine")}>My posts</Button></div>{formError}<div className="space-y-3">{posts.filter((p) => screen === "feed" || p.is_mine).map(feedCard)}{posts.filter((p) => screen === "feed" || p.is_mine).length === 0 && <p className="font-serif text-xl text-muted-foreground py-16">{screen === "mine" ? "You haven’t shared a story yet." : "No stories yet. Yours could be the first."}</p>}</div></section>
    : screen === "detail" && selected ? <section className="mx-auto max-w-[760px] px-6 pt-12 pb-24 md:pt-16">{back("feed", "Back to feed")}<article className="mt-12"><div className="flex items-center justify-between gap-4"><div className="flex items-center gap-3"><div className="h-9 w-9 rounded-full border border-border flex items-center justify-center text-muted-foreground"><UserRound size={16} /></div><div><p className="text-xs">{selected.display_name}</p><time className="text-[11px] text-muted-foreground" dateTime={selected.created_at}>{exactDate(selected.created_at)}</time></div></div>{selected.is_mine && <div className="flex gap-3"><Button variant="link" className="quiet-link h-auto p-0" onClick={() => { setEditingPost(selected.id); setQuestion(selected.question); setStory(selected.story); setIdentity(selected.display_as); go("story"); }}>Edit</Button><Button variant="link" className="quiet-link h-auto p-0" onClick={() => removePost(selected)}>Delete</Button></div>}</div><h1 className="editorial-title mt-10">{selected.question}</h1><p className="story-body mt-9">{selected.story}</p>{selected.updated_at !== selected.created_at && <p className="text-xs text-muted-foreground mt-6">Edited {exactDate(selected.updated_at)}</p>}</article><section className="mt-20 border-t border-border pt-8"><h2 className="font-serif text-2xl mb-8">Comments <span className="text-muted-foreground">{comments.length}</span></h2><div className="divide-y divide-border">{comments.map((comment) => <article key={comment.id} className="py-6"><div className="flex justify-between gap-3"><div className="flex gap-3"><div className="h-8 w-8 rounded-full border border-border flex items-center justify-center text-muted-foreground"><UserRound size={14} /></div><div><p className="text-xs">{comment.display_name}</p><time className="text-[11px] text-muted-foreground" dateTime={comment.created_at}>{exactDate(comment.created_at)}</time></div></div>{comment.is_mine && <div className="flex gap-3"><Button variant="link" className="quiet-link h-auto p-0" onClick={() => { setEditingComment(comment.id); setCommentText(comment.body); setCommentIdentity(comment.display_as); setShowCommentIdentity(true); }}>Edit</Button><Button variant="link" className="quiet-link h-auto p-0" onClick={() => removeComment(comment.id)}>Delete</Button></div>}</div><p className="story-body mt-4 ml-11 text-[15px]">{comment.body}</p>{comment.updated_at !== comment.created_at && <p className="ml-11 mt-2 text-[11px] text-muted-foreground">Edited {exactDate(comment.updated_at)}</p>}</article>)}</div><div className="mt-9"><textarea className="quiet-input min-h-24 resize-y" aria-label="Write a comment" placeholder="Write a comment…" maxLength={2000} value={commentText} onChange={(e) => setCommentText(e.target.value)} /><div className="mt-3 flex justify-between items-center"><Button variant="link" className="quiet-link h-auto p-0" onClick={() => setShowCommentIdentity(!showCommentIdentity)}>Posting as: {commentIdentity === "anonymous" ? "Anonymous" : commentIdentity === "real_name" ? profile?.real_name ?? "Real name" : profile?.username} <Ellipsis size={13} /></Button><Button className="rounded-[2px] text-xs h-8" disabled={busy} onClick={submitComment}>{editingComment ? "Save" : "Post"}</Button></div>{showCommentIdentity && <div className="mt-5"><IdentityPicker value={commentIdentity} onChange={setCommentIdentity} profile={profile} /></div>}{editingComment && <Button variant="link" className="quiet-link h-auto p-0 mt-3" onClick={() => { setEditingComment(null); setCommentText(""); }}>Cancel edit</Button>}{formError}</div></section></section>
    : screen === "settings" ? <section className="mx-auto max-w-xl px-6 pt-16 pb-24 md:pt-24">{back("feed", "Back to feed")}<h1 className="editorial-title mt-10">Settings</h1><div className="mt-10"><h2 className="text-sm border-b border-border pb-3">Profile information</h2><p className="text-xs text-muted-foreground mt-6 mb-2">Username</p><p className="text-sm">{profile?.username}</p><label className="block text-xs mt-7">Real name (optional)<input className="quiet-input mt-2" value={realName} maxLength={80} placeholder="How you’d like your name to appear" onChange={(e) => setRealName(e.target.value)} /></label><p className="text-xs text-muted-foreground mt-3">Only shown when you choose “Use my real name.”</p>{formError}<Button className="rounded-[2px] text-xs mt-6" disabled={busy} onClick={saveName}>Save changes</Button></div><div className="border-t border-border mt-14 pt-7 flex justify-between"><Button variant="link" className="quiet-link h-auto p-0" onClick={() => go("mine")}>My Posts <ArrowRight size={13} /></Button><Button variant="link" className="quiet-link h-auto p-0" onClick={signOut}>Log out</Button></div></section> : null}
  </main></div>;
}
