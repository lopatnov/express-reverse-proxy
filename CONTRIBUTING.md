# Contributions Welcome

Thanks for your interest in contributing to **@lopatnov/express-reverse-proxy**! Contributing to open source can be a rewarding way to learn, share knowledge, and build experience. We are glad you are here.

## Table of Contents

1. [Types of Contributions](#types-of-contributions)
1. [Ground Rules & Expectations](#ground-rules--expectations)
1. [How to Contribute](#how-to-contribute)

---

## Types of Contributions

You do not have to contribute code to make a difference. Here are some ways you can help:

### Developers can:

- Take a look at the [open issues][issues] and find one to work on.
- Locate and fix bugs in `server.js` or the configuration handling logic.
- Implement new features or improve existing ones.
- Improve tooling, scripts, or the Docker/PM2 setup.

### Writers can:

- Fix or improve the project documentation.
- Add more configuration examples or recipes to the README.
- Improve inline comments in `server.js`.

### Testers can:

- Report reproducible bugs with a minimal `server-config.json` example.
- Verify that existing issues are still present or have been resolved.

### Supporters can:

- Answer questions in [Discussions][discussions].
- Help triage open issues — identify duplicates, ask clarifying questions.

---

## Ground Rules & Expectations

Please read the [Code of Conduct][code-of-conduct] before contributing. By participating in this project, you agree to uphold its standards.

---

## How to Contribute

If you have an idea, first search [open issues][issues] and [pull requests][pull-requests] to see if it has already been discussed.

If it has not:

- **Minor change** _(typo, doc fix)_: Open a pull request directly.
- **Major change** _(new feature, API change)_: Open an issue first to discuss the approach.

### Step-by-step workflow

1. Fork the repository by clicking **Fork** on GitHub.

1. Clone your fork locally:

   ```shell
   git clone https://github.com/<YOUR-USERNAME>/express-reverse-proxy
   ```

1. Add the upstream remote so you can sync changes:

   ```shell
   git remote add upstream https://github.com/lopatnov/express-reverse-proxy
   ```

1. Sync your local `master` branch with upstream:

   ```shell
   git checkout master
   git pull upstream master && git push origin master
   ```

1. Create a new branch from `master`:

   ```shell
   git checkout -b <your-branch-name>
   ```

1. Make your changes to the code or documentation.

1. Test your changes manually:

   ```shell
   node server.js --config server-config.json
   ```

1. Commit your changes. Use a present-tense message describing what the commit does when applied:

   ```shell
   git commit -m "Add support for multiple proxy targets"
   ```

1. Push your branch to your fork:

   ```shell
   git push -u origin <your-branch-name>
   ```

1. Open a pull request on GitHub from your fork's branch to `lopatnov/express-reverse-proxy:master`.

1. Respond to any review comments and push follow-up commits if needed.

1. Once merged, you can delete your branch and sync your fork.

Happy contributing!

[code-of-conduct]: ./CODE_OF_CONDUCT.md
[issues]: https://github.com/lopatnov/express-reverse-proxy/issues
[discussions]: https://github.com/lopatnov/express-reverse-proxy/discussions
[pull-requests]: https://github.com/lopatnov/express-reverse-proxy/pulls
