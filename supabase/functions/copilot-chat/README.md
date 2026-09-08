# AP CoPilot — live AI backend

This function is what makes AP CoPilot answer real questions with a real
model instead of the static keyword list. It does nothing until you deploy
it and add an API key — until then, the site keeps using the static
fallback automatically, so nothing breaks in the meantime.

## One-time setup (do this from your own computer, not this repo's CI)

1. **Install the Supabase CLI** if you don't have it:
   `npm install -g supabase` (or see supabase.com/docs/guides/cli)

2. **Log in and link this project:**
   ```
   supabase login
   supabase link --project-ref uejlrooupfcrqimffgsn
   ```
   (`uejlrooupfcrqimffgsn` is your project ref, taken from the Supabase URL
   already used throughout this site.)

3. **Get an Anthropic API key:**
   Sign up at console.anthropic.com → API Keys → Create Key. This is a
   real account with a real per-message cost — Claude Haiku (the model
   this function uses) is the cheapest tier, but it isn't free.

4. **Store the key as a Supabase secret** (never commit it, never put it
   in this repo — this is the whole point of having a backend):
   ```
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...your-key...
   ```

5. **Deploy the function:**
   ```
   supabase functions deploy copilot-chat
   ```
   Leave JWT verification on (the default) — this function checks for a
   signed-in AP Workspace session itself, which is what keeps random
   internet visitors from running up your API bill.

6. **Test it** — sign in to app.anjanpatel.ca, open AP CoPilot, and ask it
   something outside the static knowledge base (e.g. "hi", or a real
   question). If it replies with a generated answer instead of the canned
   fallback text, it's live.

## Changing or rotating the key later

```
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...new-key...
```
No redeploy needed — secrets are read at request time.

## Cost control already built in

- Only signed-in users can call this function (anonymous visitors on the
  public login page get the static fallback instead).
- Messages are capped at 500 characters, conversation history at 6 turns,
  and replies at 400 tokens.
- If you want a hard spending cap, set one in your Anthropic console
  under Settings → Limits — this function doesn't track spend itself.
