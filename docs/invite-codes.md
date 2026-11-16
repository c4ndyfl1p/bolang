# Invite codes

The hosted backend only translates for people with a valid invite code, so strangers can't use up the shared DeepL allowance (500,000 characters a month on the free plan).

Each code belongs to a **name**. The name appears in the server logs ("replacements for maria: ...") and gets its own rate limit (20 requests a minute, 300 a day). It is never shown to the person using the code.

## Making codes

From the repo root:

```bash
.hcai/bin/python backend/make_invite.py maria jonas
```

Output:

```
maria: K7PX-29QD
jonas: M3RT-8WHA

Add to INVITE_CODES (comma-separated, keep any existing entries):
maria:K7PX-29QD,jonas:M3RT-8WHA
```

Codes are 8 random characters from the `secrets` module, without look-alike characters (0/O, 1/I/L). Lowercase or uppercase both work when typed.

## Adding codes to the server

1. Render dashboard → **bolang-backend** → **Environment**.
2. Edit `INVITE_CODES` and **add** the new entries to the end of the existing value, separated by a comma. Don't replace what's there, or everyone else's codes stop working.

   ```
   aakanksha:XXXX-XXXX,maria:K7PX-29QD,jonas:M3RT-8WHA
   ```

3. Save. Render redeploys, which takes a few minutes. **Wait until the status says Live** before testing; during a redeploy the extension may show "Can't reach the BoLang server".
4. To check it worked: Render → **Logs** should show `invite codes enabled for N people` after the restart.

## Spare codes (recommended)

Instead of changing Render every time someone asks for access, make a batch of spare codes in advance:

```bash
.hcai/bin/python backend/make_invite.py spare01 spare02 spare03 spare04 spare05
```

Add them all to `INVITE_CODES` once. When someone emails you, give them the next unused code. No redeploy, no waiting.

Keep a **private** list of who got which code. **Not in this repo, since it's public.** A password manager or a personal note works:

| Code name | Given to | Date |
|---|---|---|
| spare01 | Maria (from the blog) | 2026-11-20 |
| spare02 | | |

That way, when the logs say `replacements for spare01`, you know who it is. When you run low, make the next batch (`spare06 spare07 ...`).

## Giving a code to someone

Send them the code (just the `XXXX-XXXX` part; the name isn't needed) and these instructions:

1. Install BoLang: <https://github.com/c4ndyfl1p/bolang/releases/latest/download/bolang.xpi> (open in Firefox, click **Add**).
2. Click the BoLang icon → **Invite code** → paste the code.
3. Open any English page → **Translate this page**.

If they paste the whole `name:CODE` line by mistake, that works too.

## Revoking a code

Remove that `name:CODE` entry from `INVITE_CODES` on Render and save. After the redeploy, that code gets "That invite code isn't valid." Nobody else is affected.

Revoke a code if it was shared publicly (posted somewhere, pasted in a chat log), if someone is using far more than their share, or if you just want to tidy up unused spares.

## Seeing who uses it

Render → **Logs**, then search for a code's name (e.g. `spare01`). Each translation logs one line with the name and how many words were translated, never the page text. Render keeps logs for about a week on the free plan. For longer-term usage stats, see the "usage tracking" idea in the README roadmap.

## Locally

Leave `INVITE_CODES` out of `backend/.env` and the local server doesn't ask for a code at all (it logs a warning at startup).
