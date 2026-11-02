<!-- Please don't delete this template -->

<!-- PULL REQUEST TEMPLATE -->
<!-- (Update "[ ]" to "[x]" to check a box) -->

**Summary**

**What kind of change does this PR introduce?** (check at least one)

- [ ] Bugfix
- [ ] Feature
- [ ] Code style update
- [ ] Refactor
- [ ] Docs
- [ ] Build-related changes
- [ ] Other, please describe:

If changing the local playground or browser examples, please provide desktop/mobile **before/after** screenshots:

**Does this PR introduce a breaking change?** (check one)

- [ ] Yes
- [ ] No

If yes, please describe the impact and migration path for existing applications:

**The PR fulfills these requirements:**

- [ ] When resolving a specific issue, it's referenced in the PR's title (e.g. `fix #xxx[,#xxx]`, where "xxx" is the issue number)

You have tested in the following browsers: (Providing a detailed version will be better.)

- [ ] Chrome
- [ ] Firefox
- [ ] Safari
- [ ] Edge

Automated Chrome checks are separate from manual testing in the browsers above.

**Validation performed** (include failures or checks not run):

- [ ] `npm run lint`
- [ ] `npm test` — callback and Promise/target-size browser coverage
- [ ] `npm run test:types` — build first; ESM/CommonJS/bundler declarations and imports
- [ ] `npm run test:server` — conversion and local/static demo routes
- [ ] `npm run test:demo` — browser targets, local uploads, cancellation, and downloads
- [ ] `npm pack --dry-run --ignore-scripts` — when changing exports or packaged files

`npm run release` runs the complete local validation sequence without publishing or deploying.

If adding a **new feature**, the PR's description includes:

- [ ] A convincing reason for adding this feature
- [ ] Related documents have been updated
- [ ] Related tests have been updated
- [ ] Public types and result fields match the implementation
- [ ] Target limits and server-conversion/cancellation behavior are documented when affected

To avoid wasting your time, it's best to open a **feature request issue** first and wait for approval before working on it.

**Other information:**
