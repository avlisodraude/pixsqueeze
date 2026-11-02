# Contributing to PixSqueeze.js

> Based on [Angular's contributing guidelines](https://github.com/angular/angular/blob/master/CONTRIBUTING.md).

We would love for you to contribute to PixSqueeze.js and help make it even better than it is today! As a contributor, here are the guidelines we would like you to follow:

- [Contributing to PixSqueeze.js](#contributing-to-pixsqueezejs)
  - [Code of Conduct](#code-of-conduct)
  - [Question or Problem](#question-or-problem)
  - [Issues and Bugs](#issues-and-bugs)
  - [Feature Requests](#feature-requests)
  - [Submission Guidelines](#submission-guidelines)
    - [Submitting an Issue](#submitting-an-issue)
    - [Submitting a Pull Request (PR)](#submitting-a-pull-request-pr)
      - [After your pull request is merged](#after-your-pull-request-is-merged)
  - [Coding Rules](#coding-rules)
  - [Development setup and verification](#development-setup-and-verification)
  - [Commit Message Guidelines](#commit-message-guidelines)
    - [Commit Message Format](#commit-message-format)
    - [Revert](#revert)
    - [Type](#type)
    - [Scope](#scope)
    - [Subject](#subject)
    - [Body](#body)
    - [Footer](#footer)

## Code of Conduct

Help us keep PixSqueeze.js open and inclusive. Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Question or Problem

Start with the [API reference](../README.md) and [local documentation guide](../docs/README.md). For usage questions, use [PixSqueeze Discussions](https://github.com/avlisodraude/pixsqueeze/discussions). For a reproducible bug, use the issue form and include the installed package version, browser/runtime, whether you used the callback or Promise API, and relevant conversion/target-size options.

## Issues and Bugs

If you find a bug in the source code, you can help us by [submitting an issue](#submitting-an-issue) to our [GitHub Repository](https://github.com/avlisodraude/pixsqueeze). Even better, you can [submit a Pull Request](#submitting-a-pull-request-pr) with a fix.

## Feature Requests

You can *request* a new feature by [submitting an issue](#submitting-an-issue) to our [GitHub Repository](https://github.com/avlisodraude/pixsqueeze). If you would like to *implement* a new feature, please submit an issue with a proposal for your work first, to be sure that we can use it.

Please consider what kind of change it is:

- For a **Major Feature**, first, open an issue and outline your proposal so that it can be discussed. This will also allow us to better coordinate our efforts, prevent duplication of work, and help you to craft the change so that it is successfully accepted into the project.
- **Small Features** can be crafted and directly [submitted as a Pull Request](#submitting-a-pull-request-pr).

## Submission Guidelines

### Submitting an Issue

Before you submit an issue, please search the [issue tracker](https://github.com/avlisodraude/pixsqueeze/issues), which may be an issue for your problem already exists and the discussion might inform you of workarounds readily available.

We want to fix all the issues as soon as possible, but before fixing a bug we need to reproduce and confirm it. To reproduce bugs, we will systematically ask you to provide a minimal reproduction scenario using [CodePen](https://codepen.io/pen). Having a live, reproducible scenario gives us a wealth of important information without going back & forth to you with additional questions like:

- version of PixSqueeze.js used
- 3rd-party libraries and their versions
- and most importantly - a use-case that fails

A minimal reproduction scenario using [CodePen](https://codepen.io/pen) allows us to quickly confirm a bug (or point out a coding problem) as well as confirm that we are fixing the right problem. If [CodePen](https://codepen.io/pen) is not a suitable way to demonstrate the problem (for example for issues related to our npm packaging), please create a standalone git repository demonstrating the problem.

We will be insisting on a minimal reproduction scenario to save maintainers time and ultimately be able to fix more bugs. Interestingly, from our experience users often find coding problems themselves while preparing a minimal reproduction scenario. We understand that sometimes it might be hard to extract essentials bits of code from a larger code-base but we need to isolate the problem before we can fix it.

Unfortunately, we are not able to investigate/fix bugs without a minimal reproduction scenario, so if we don't hear back from you we are going to close an issue that doesn't have enough info to be reproduced.

You can file new issues by filling out our [new issue form](https://github.com/avlisodraude/pixsqueeze/issues/new).

### Submitting a Pull Request (PR)

Before you submit your Pull Request (PR) consider the following guidelines:

1. Search [GitHub](https://github.com/avlisodraude/pixsqueeze/pulls) for an open or closed PR that relates to your submission. You don't want to duplicate effort.
1. Fork the **avlisodraude/pixsqueeze** repo.
1. Make your changes in a new git branch:

    ```shell
    git checkout -b my-fix-branch main
    ```

1. Create your patch, **including appropriate test cases**.
1. Follow our [Coding Rules](#coding-rules).
1. Run the full PixSqueeze.js test suite, and ensure that all tests pass.
1. Commit your changes using a descriptive commit message that follows our [Commit Message Guidelines](#commit-message-guidelines). Adherence to these guidelines is necessary because release notes are automatically generated from these messages.

    ```shell
    git commit -a
    ```

    Note: the optional commit `-a` command-line option will automatically "add" and "rm" edited files.
1. Push your branch to GitHub:

    ```shell
    git push origin my-fix-branch
    ```

1. In GitHub, send a pull request to `pixsqueeze:main`.
1. If we suggest changes then:
    - Make the required updates.
    - Re-run the PixSqueeze.js test suites to ensure tests are still passing.
    - Rebase your branch and force push to your GitHub repository (this will update your Pull Request):

    ```shell
    git rebase main -i
    git push -f
    ```

That's it! Thank you for your contribution!

#### After your pull request is merged

After your pull request is merged, you can safely delete your branch and pull the changes from the main (upstream) repository:

1. Delete the remote branch on GitHub either through the GitHub web UI or your local shell as follows:

    ```shell
    git push origin --delete my-fix-branch
    ```

1. Check out the main branch:

    ```shell
    git checkout main -f
    ```

1. Delete the local branch:

    ```shell
    git branch -D my-fix-branch
    ```

1. Update your main with the latest upstream version:

    ```shell
    git pull --ff upstream main
    ```

## Coding Rules

To ensure consistency throughout the source code, keep these rules in mind as you are working:

- All features or bug fixes **must be tested** by one or more specs (unit-tests).
- All public API methods **must be documented**.
- Follow the repository's ESLint and Stylelint configurations. `npm run lint` applies automatic fixes.

## Development setup and verification

Use Node.js 24, matching `.github/workflows/ci.yml`:

```shell
npm ci
npx puppeteer browsers install chrome
npm run build
npm run server
```

Open `http://localhost:3000`. The server root serves `docs/local.html`; `docs/index.html` remains the static-host redirect. Enable the local playground's upload checkbox only when testing HEIC/TIFF/RAW conversion. Ordinary JPEG/PNG/WebP processing stays in the browser. RAW detection does not guarantee that the installed decoder supports a particular camera format.

For source changes, run `npm run dev` in a second terminal to watch and rebuild. `npm start` starts that build watcher, not the HTTP server. Changing server source requires restarting the server.

| Area | Owning files | Verification |
| --- | --- | --- |
| Callback API and canvas encoder | `src/index.js`, `src/defaults.js`, `src/utilities.js` | `npm test` |
| Promise API and byte targets | `src/compress.js`, `test/specs/async.spec.js` | `npm test` |
| Optional conversion transport | `src/convert.js`, `src/heic.js`, `src/tiff.js`, `src/raw.js` | Browser helper specs plus `npm run test:demo` |
| Module exports and declarations | `package.json`, `rollup.config.js`, `types/`, `test/types.test.cjs` | `npm run build` then `npm run test:types` |
| Conversion server | `server/`, `server/test/` | `npm run test:server` |
| Local playground | `docs/local.html`, `docs/js/local-demo.js`, `docs/css/local-demo.css` | `npm run test:demo` |

`npm test` rebuilds before running the public UMD bundle in Puppeteer-managed Chrome. `test:types` validates declarations and native package imports for ESM, CommonJS, and bundler consumers; it expects generated files to exist. `test:demo` rebuilds, opens a temporary local server, and exercises target downloads, explicit HEIC/TIFF conversion, cancellation, unmet targets, and narrow-viewport layout. It does not use the hosted API or API keys.

Run `npm run release` for the complete local validation sequence: clean, lint, browser tests, type/runtime consumer checks, server tests, and playground tests. Despite its name, this command does not publish a package, push commits, or deploy a site. CI runs these checks on Node.js 24; local success is separate from a completed remote CI run or device/browser acceptance.

When changing the Promise API:

- Keep `new PixSqueeze(file, options)` and its callback/abort behavior compatible.
- Keep target search bounded and use the same source for each attempt. An unmet target resolves with `targetMet: false`; failures reject.
- Preserve the explicit conversion endpoint requirement and propagate cancellation through uploads and browser work.
- Keep result fields and helper request options synchronized with declarations and the [README](../README.md).
- Do not edit generated bundles directly. Rebuild them through Rollup, retaining legacy files alongside the native `.mjs` import entries.

Before publishing, inspect the artifact with `npm pack --dry-run --ignore-scripts`. Package content includes `src/`, `dist/`, and `types/`, including `.d.mts`/`.d.cts` declaration entries; server and playground files stay repository-only. Update `CHANGELOG.md` under **Unreleased** until a release is actually prepared.

For security maintenance, run `npm audit` against the full dependency tree. The browser package has no runtime dependencies, but the repository's server imports development dependencies, so `npm audit --omit=dev` would hide its dependency risks. Review compatible updates and overrides, then run release validation. Avoid blindly applying `npm audit fix --force`: proposed fixes can downgrade major build/test tools. Remaining audit findings must be assessed by affected code path; a clean production-only report is not server acceptance.

## Commit Message Guidelines

### Commit Message Format

A commit message consists of a **header**, **body** and **footer**. The header has a **type**, **scope** and **subject**:

```
<type>(<scope>): <subject>
<BLANK LINE>
<body>
<BLANK LINE>
<footer>
```

The **header** is mandatory and the **scope** of the header is optional.

Any line of the commit message cannot be longer than 100 characters! This allows the message to be easier to read on GitHub as well as in various git tools.

The footer should contain a [closing reference to an issue](https://help.github.com/articles/closing-issues-via-commit-messages/) if any.

Here are some [samples](https://github.com/avlisodraude/pixsqueeze/commits/main).

### Revert

If the commit reverts a previous commit, it should begin with `revert: `, followed by the header of the reverted commit. In the body, it should say: `This reverts commit <hash>.`, where the hash is the SHA of the commit being reverted.

### Type

Must be one of the following:

- **build**: Changes that affect the build system or external dependencies (example scopes: gulp, broccoli, npm)
- **ci**: Changes to our CI configuration files and scripts (example scopes: Travis, Circle, BrowserStack, SauceLabs)
- **docs**: Documentation only changes
- **feat**: A new feature
- **fix**: A bug fix
- **perf**: A code change that improves performance
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **style**: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
- **test**: Adding missing tests or correcting existing tests

### Scope

The scope could be anything specifying the place of the commit change. For example `move`, `zoom`, `rotate`, etc...

### Subject

The subject contains a succinct description of the change:

- Use the imperative, present tense: "change" not "changed" nor "changes".
- Don't capitalize the first letter.
- No dot (.) at the end.

### Body

Just as in the **subject**, use the imperative, present tense: "change" not "changed" nor "changes". The body should include the motivation for the change and contrast this with previous behavior.

### Footer

The footer should contain any information about **Breaking Changes** and is also the place to reference GitHub issues that this commit **Closes**.

**Breaking Changes** should start with the word `BREAKING CHANGE:` with a space or two newlines. The rest of the commit message is then used for this.
