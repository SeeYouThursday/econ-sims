<!--
This file is generated to help AI coding agents (Copilot / automated contributors)
quickly understand and act within this repository. It is deliberately concise
and focused on discoverable facts and immediate next steps for an empty/new repo.
-->

# Copilot instructions for this repository

Repository snapshot

- The repository is currently empty: there are no source files, manifests, or
  documentation at the root (no `README.md`, `package.json`, `pyproject.toml`,
  etc.). Because there is no implementation to read, these instructions focus
  on safe, discoverable first actions and the conventions to follow when
  adding initial scaffolding.

What an AI agent should do first

- Re-scan the repo root for common manifests: `package.json`, `pyproject.toml`,
  `requirements.txt`, `setup.py`, `Cargo.toml`, `Makefile`. If any appear, stop
  and re-run analysis against those files.
- If still empty, create a minimal `README.md` describing the intended purpose
  of the project (one-paragraph), and add a short TODO list in the repo root.

Scaffolding recommendations (concrete, minimal)

- Choose a language/runtime based on the user's preference; if unknown, create
  a simple `README.md` and an empty `src/` directory. Prefer the following
  minimal files as applicable:
  - Node.js: `package.json` with `name` and `scripts` for `start` and `test`.
  - Python: `pyproject.toml` or `requirements.txt` and `src/` package.
- Commit incremental changes so humans can review — keep PRs small and focused.

Development workflows (how to detect and run)

- When manifests are present, use the native commands:
  - Node: `npm install` / `npm test` / `npm run build` (look at `package.json`)
  - Python: `python -m pip install -r requirements.txt` or `poetry install` if
    `pyproject.toml` exists; run tests via `pytest` if present.
- If no test framework is present, add a single, fast smoke test that verifies
  the project imports/starts. Example locations: `tests/test_smoke.py` or
  `test/index.test.js`.

Project conventions and merge guidance

- Keep public code under `src/` and CLI/tools under `scripts/` or `bin/`.
- Add a top-level `README.md` before adding significant code — it anchors the
  project's intent and helps future agents decide architecture.
- If `.github/copilot-instructions.md` already exists, merge by preserving any
  specific examples and updating only the repo-state & next-step sections.

Integration points & external dependencies

- There are none discoverable in the current repository snapshot. When adding
  integrations (APIs, databases, services), document them in `README.md` and
  include small, runnable integration checks (e.g., a `scripts/check_db.py`)
  that return non-zero on failure.

Safety notes for the agent

- Do not create secrets in the repo. If credentials are required for testing,
  create a sample `.env.example` and instruct humans to provide real secrets via
  repository secrets or local environment variables.
- Keep changes minimal and reviewable — prefer adding scaffolding and docs to
  guessing large architectural choices.

If anything here is unclear or you'd like a different starting scaffold (Node,
Python, or Rust), tell me which language and I'll generate the minimal files.
