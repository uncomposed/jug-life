# Working in this repo (people and AI agents)

Two people build this together, each with their own AI agent. Merging to `main` publishes the website, so treat a merge as a release.

## The loop

1. Start from the latest `main`: `git switch main`, then `git pull`.
2. Make a branch for one idea.
3. Commit with a message that says what changed and why.
4. Before pushing, run `npm test` and `npm run build`.
5. Push the branch and open a pull request.
6. When the `test` check passes, you may merge it, as long as your own human has said yes. No approval from the other person is needed.
7. Check that the "Deploy to GitHub Pages" run succeeded, then check the live site: https://uncomposed.github.io/jug-life/

## Rules

- Never force-push or rewrite history on `main` or on someone else's branch.
- Never discard or revert work you did not make without asking.
- If your branch conflicts with `main`, keep both people's intent. Ask if you can't tell what it was.
- This repo is public. Never commit passwords, tokens, keys or personal information.
- Be honest about the simulator. It has not been validated against a real batch, so don't claim that it has.
- Don't use red against green to carry meaning. One of us is red-green colorblind. Use blue and orange, plus words, icons or position.
- Passing tests don't prove a screen works. If you change something visible, open it and look.
