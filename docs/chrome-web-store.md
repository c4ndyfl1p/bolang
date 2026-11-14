# Chrome Web Store: privacy form answers

Copy-paste answers for the **Privacy practices** tab of the Chrome Web Store developer dashboard.
Keep them in sync with [PRIVACY.md](../PRIVACY.md) and the code.

## Single purpose

> BoLang helps people learn a language while browsing: when the user clicks "Translate this page", it replaces some of the English words on that page with translations in the language they are learning.

## Permission justifications

| Permission | Justification |
|---|---|
| `activeTab` | Gives temporary access to the current tab only when the user clicks the extension, so it can read that page's text and insert the translated words. No access to other tabs or pages. |
| `scripting` | Injects the script that reads the page's visible text and replaces words with translations, only after the user clicks "Translate this page". |
| `storage` | Saves the user's settings (target language, how many words to translate, invite code) locally so they are remembered. |
| Host permission (`https://<backend>/`) | Lets the extension call the BoLang translation server. It is the only host the extension contacts. |

**Remote code:** No. All JavaScript is included in the extension package.

## Data usage

Tick only **Website content** ("text, images, sounds, videos, or hyperlinks").
Leave the others unticked: personally identifiable info, health, financial, authentication info, personal communications, location, web history, user activity.

Certify all three:
- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** link to PRIVACY.md on GitHub (or a GitHub Pages copy).

> Note on "Authentication information": the invite code is closer to an access key than a user login. If a reviewer asks, explain that it is a shared access code chosen by the developer, not a user password. Ticking the box anyway is also fine and is the more cautious choice.
