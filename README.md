# cse-210-warm-up-graphing

Graph Tool (CSE 210 Warm Up)

## Run locally

1. Install [Node.js](https://nodejs.org/) if it is not already installed.
2. From this project folder, run `npm start`.
3. Open [http://localhost:3000](http://localhost:3000) in a browser.

## Lint and formatting

- `npm run lint` checks the code with ESLint.
- `npm run format` formats everything with Prettier; `npm run format:check` only reports unformatted files.
- `npm install` sets up a pre-commit hook that formats the files you commit, so you normally do not need to run Prettier yourself.
- CI runs the format check, lint, unit tests, and the Playwright tests on every push and pull request.

Prettier uses its default style (double quotes, 2-space indent) and is pinned to an exact version so formatting stays the same on every machine. Generated files, `samples/`, `Resources/`, and `administrative/` are excluded in `.prettierignore`.

ESLint uses the recommended rules with these exceptions, set in `eslint.config.js`:

- `no-unused-vars` is off in `csv_loader.js` and `data_processer.js`. They are classic browser scripts that share functions through globals, so the rule reports false positives (tracked in #37).
- `no-control-regex` is off in `graphExport.js`, which strips control characters from exported file names on purpose.

The repo-wide formatting commit is listed in `.git-blame-ignore-revs`. To skip it in local `git blame`, run `git config blame.ignoreRevsFile .git-blame-ignore-revs`.
