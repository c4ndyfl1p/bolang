# Publishing BoLang on Firefox (unlisted)

BoLang is distributed as an **unlisted** add-on: Mozilla checks and signs it, but it doesn't appear in search on addons.mozilla.org (AMO). You share the signed `.xpi` file with friends yourself. Publishing is free.

## 1. Test it locally first

1. Open `about:debugging#/runtime/this-firefox` and click **Load Temporary Add-on…**.
2. Pick `chrome-extention/manifest.json`.
3. Open an English page, click the BoLang toolbar icon, enter your invite code and click **Translate this page**.

A temporary add-on is removed when Firefox closes. To see errors, click **Inspect** next to BoLang on the about:debugging page (for the popup), or open the web page's console (for the content script).

## 2. Build the zip

```bash
scripts/package-firefox.sh        # -> dist/bolang-<version>.zip
```

`manifest.json` must be at the top level of the zip. The script handles that.

## 3. Submit

1. Sign in at <https://addons.mozilla.org/developers/> with a Firefox account (free).
2. Click **Submit a New Add-on**, then choose **On your own** (this is the unlisted / self-distribution option).
3. Upload `dist/bolang-<version>.zip`. Mozilla runs automatic checks. Warnings are fine to read through. Errors must be fixed.
4. **"Do you need to submit source code?"** Answer **No**: the code isn't minified, bundled or generated, so what's in the zip is the source.
5. Fill in the short details:
   - **Name:** BoLang
   - **Summary:** Learn a language while you browse: swaps some words on the page for translations.
   - **Privacy policy:** paste the contents of `PRIVACY.md`, or link to it on GitHub.
6. Submit. Unlisted add-ons are usually signed automatically within minutes. Then download the signed **`.xpi`** from the version page.

## 4. Share with friends

Send the `.xpi` together with their invite code (make one with `backend/make_invite.py`). To install, they drag the file onto a Firefox window or open it with **File → Open File**, then click **Add**.

The first time they click Translate, Firefox may ask to allow BoLang on that site. That's the `activeTab` permission: access to the current tab only, only when they click.

## 5. Updating

1. Bump `"version"` in `manifest.json` (e.g. `1.3` → `1.4`). AMO rejects a version number it has already seen.
2. Run `scripts/package-firefox.sh` again.
3. On AMO, go to your add-on and choose **Upload New Version**.
4. Send friends the new `.xpi`. Unlisted add-ons don't auto-update unless you host an update manifest (`update_url`), which you can add later if it becomes annoying.

## Notes on the manifest

- `browser_specific_settings.gecko.id` (`bolang@c4ndyfl1p.github.io`) permanently identifies the add-on. **Never change it**, or Firefox treats it as a different add-on.
- `data_collection_permissions` declares what leaves the browser: `websiteContent` (page text sent for translation) and `authenticationInfo` (the invite code). Firefox shows this when installing. Keep it in sync with `PRIVACY.md`.
- `strict_min_version: 140.0` is the first Firefox version that supports `data_collection_permissions`.
