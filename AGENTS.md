<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep the journal experience on the home route with state-based screens; the reference presents a sequential writing flow rather than separate marketing pages.
- Use managed authentication with normalized username-derived internal email; this provides username-only login while password hashing stays with the auth provider, and recovery email is intentionally unavailable.
- Read public writing through sanitized database functions rather than author-id-bearing table rows; anonymous publishing must not expose ownership through normal reads.
