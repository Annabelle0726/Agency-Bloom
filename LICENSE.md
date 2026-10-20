# Agency Bloom Source-Available License

**Version 1.0 — 2026-10-19**

Copyright (c) 2026 Annabelle (git author: `3141330934@qq.com`). All rights reserved.

This repository is **source-available, not open source**. You may read, learn from, and run this code under the conditions below. Commercial use and redistribution require separate written permission.

## 1. Definitions

- **"The Software"** means this repository's contents: the Agency Bloom WeChat Mini Program frontend (`apps/miniprogram`), the FastAPI backend (`apps/api`), database migrations, tooling, documentation, and bundled visual assets.
- **"You"** means any person or organization obtaining a copy of the Software.
- **"Licensor"** means the copyright holder named above.
- **"Commercial Use"** means any use intended to generate revenue or business advantage, including but not limited to: selling the Software or derivatives, offering it as a paid service, using it inside a commercial product or workplace deployment, or using its output to operate a business.
- **"Personal Learning"** means individual, non-commercial study of the source code, its architecture, algorithms, and implementation techniques.

## 2. Grants — what You may do

Subject to the conditions in Section 3, the Licensor grants You a worldwide, non-exclusive, non-transferable, revocable license to:

1. **Read and study** the Software for Personal Learning.
2. **Run the Software locally** on Your own devices for personal, non-commercial use, including using a locally configured AI provider key under that provider's own terms.
3. **Modify the Software** for Your own personal, local, non-commercial use.
4. **Quote short excerpts** (≤50 lines per excerpt) in technical writing such as blog posts, articles, or talks, provided the quote is clearly attributed to this repository and accompanied by a link to it.

## 3. Conditions — what You may NOT do

1. **No Commercial Use.** You may not use the Software or any substantial portion of it for Commercial Use without prior written permission from the Licensor.
2. **No Redistribution.** You may not publish, upload, mirror, sublicense, sell, or otherwise distribute the Software or derivatives, in whole or in substantial part, to any third party, except for the short-excerpt quotation right in Section 2.4.
3. **No removal of notices.** You must retain this license file and all copyright notices in any copy or modification You make for Your own use.
4. **No misleading presentation.** You may not present the Software, or derivatives shown publicly, as official Agency Bloom products, nor use the name "Agency Bloom" or its brand assets to imply endorsement.
5. **No deployment as a public service.** Operating a publicly accessible instance of the Software is Commercial Use unless the Licensor grants written permission.
6. **No use of bundled brand assets.** The logos (`brand-sprout`, `brand-app-icon`), theme artwork, and product copy may not be reused outside the Software without separate permission (see Section 6 for the one asset with unresolved sourcing).

## 4. Third-party components

The Software depends on third-party open-source components that remain under their own licenses, which are not changed by this file. Key components include (non-exhaustive):

- Vue 3 — MIT License
- uni-app / @dcloudio packages — Apache-2.0
- Vite, Vitest, vue-i18n — MIT
- TypeScript — Apache-2.0
- FastAPI, SQLAlchemy, pydantic — MIT
- uvicorn — BSD-3-Clause
- psycopg — LGPL-3.0
- httpx — BSD-3-Clause
- sharp — Apache-2.0

Nothing in this license modifies those components' terms. This file applies only to code and assets authored in this repository.

## 5. AI provider terms are separate

Running the backend in `deepseek` mode uses DeepSeek's API service under DeepSeek's own commercial terms and your own API key. This license neither grants nor covers any rights to that service.

## 6. Unresolved third-party material — do not reuse

The Morning Mist theme reference image (`design/themes/references/mist.png` and its compressed derivatives) is a **user-selected library image** whose original licensing terms have not been confirmed. It is included for the Software's own operation only. **Do not copy or reuse this image outside this project** until its sourcing is resolved. Other theme references were generated via image-generation prompts recorded in `design/themes/prompts.json`; generated-output rights depend on the tool's terms and are likewise not re-granted here.

## 7. No warranty

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE LICENSOR BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## 8. Termination

Your license terminates automatically if You breach Section 3. Sections 4–7 survive termination.

## 9. Contact and permission requests

For commercial licensing, redistribution, or public-deployment permission, contact the repository owner via the email in the copyright header or through GitHub (`Annabelle0726`).

---

*The authoritative text of this license is the English version in this file. A Chinese translation is provided at [LICENSE_zh.md](LICENSE_zh.md) for reference only; in any conflict, this English version prevails.*
