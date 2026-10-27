# BOQ Task Core

A small bill of quantities (BOQ) app. You upload construction drawings, read elements off them by hand or with an AI agent, review the results, and get a BOQ.

It is the starting point for the Concolabs developer task. Your job is to add one element to it. See [Your task](#your-task).

## How it works

```
frontend (Next.js, :3000)  ->  backend (FastAPI, :8000)  ->  agent-runtime (Node, :8090)
                                     |                              |
                              SQLite + storage/            Codex (your ChatGPT account)
```

- The **frontend** only talks to the backend.
- The **backend** stores everything in SQLite (`storage/app.db`) and files under `storage/`.
- The **agent runtime** logs in to Codex with your own ChatGPT account. When you ask the agent to read part of a drawing, the backend starts a run, the agent looks at the drawing and sends its observations back to the backend.

The app follows four steps:

| Step | What happens |
| --- | --- |
| **Pre** | Upload PDFs, set the scale of each page, list the storeys, then freeze the frame. |
| **Takeoff** | Pick an element, draw a box on a page, and add observations by hand or ask the agent. Items and issues update as you go. |
| **Review** | Confirm each element. Errors block confirming. Any later change needs a new confirmation. |
| **BOQ** | Confirmed items grouped into lines, with a CSV download. |

**The frame:** freezing takes a snapshot of pages, scales and storeys. Takeoff only works on a current frame. If you change Pre afterwards, freeze again. Observations carry over to the new frame, and boxes are measured again with the new scale.

## Setup

You need Python 3.12 or newer, Node 22.19 or newer, and Git. A ChatGPT account (Plus or Pro) is only needed for the agent. Everything else works without it.

The commands below are for Windows PowerShell. On macOS or Linux, use `source .venv/bin/activate` and `cp` instead of `Copy-Item`.

On Windows, PowerShell blocks scripts like `Activate.ps1` and `npm.ps1` by default. Allow them once for your user:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

### 1. Settings

From the repo root:

```powershell
Copy-Item .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Open `.env`, paste the printed value into `AGENT_CREDENTIAL_KEY`, and set `AGENT_RUNTIME_TOKEN` to any long random string.

All three services read this one `.env` file in the repo root. It is git-ignored, so your values never get committed. `.env.example` is the committed template:

| Setting | Used by | What it is |
| --- | --- | --- |
| `DATABASE_PATH` | backend | SQLite file, relative to the repo root |
| `STORAGE_ROOT` | backend | Folder for uploaded PDFs and page renders |
| `AGENT_RUNTIME_TOKEN` | backend, agent runtime | Shared secret between the two. Any long random string, the same for both |
| `AGENT_RUNTIME_PORT` | agent runtime | Port it listens on (default 8090) |
| `AGENT_RUNTIME_URL` | backend | Where the backend finds the agent runtime. Keep the port the same as above |
| `BACKEND_URL` | agent runtime | Where the agent runtime finds the backend |
| `AGENT_CREDENTIAL_KEY` | agent runtime | 32 bytes as 64 hex characters. Encrypts your saved Codex login |
| `AGENT_MODEL` | agent runtime | The Codex model the agent uses. `npm run models` lists the ones your account can use |
| `AGENT_MAX_TURNS` | agent runtime | Most model turns one agent run may take |
| `NEXT_PUBLIC_API_URL` | frontend | Where the browser finds the backend |

If you add a setting, add it to `.env.example` too, with a placeholder value, never a real secret.

### 2. Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

API docs: http://127.0.0.1:8000/docs

### 3. Agent runtime (optional)

The agent uses **Codex** through your own ChatGPT account (Plus or Pro). There is no API key to buy or paste: you log in once with a device code, and the login is saved encrypted in `.agent-state/` (git-ignored).

In a second terminal:

```powershell
cd agent-runtime
npm install
npm run auth     # once: prints a link and a code
npm start
```

`npm run auth` prints a link and a short code. Open the link, sign in with your ChatGPT account, enter the code, and the terminal prints `Logged in.`

`npm run health` prints `ready` once you are logged in.

Not every Codex model is open to every ChatGPT account. `npm run models` sends a tiny request to each model and prints which ones your account can use. Put one of those in `AGENT_MODEL` in `.env` and restart `npm start`. If port 8090 is taken, set `AGENT_RUNTIME_PORT` and `AGENT_RUNTIME_URL` to another port.

### 4. Frontend

In a third terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:3000. The badge at the top right shows whether the agent is ready.

## Using the app

1. Create a project and open it.
2. **Pre:** upload a PDF. For each page you will measure on, set the scale (a printed ratio like 1:100, or two points a known distance apart). Add the storeys, then click **Freeze frame**.
3. **Takeoff:** pick **Example: Pad footing concrete**. Draw a box around a footing on the plan, then click **Add by hand** (length and width come from the box, type the mark and depth) or **Ask agent**.
4. **Review:** fix any errors, then click **Confirm**.
5. **BOQ:** see the grouped lines and download the CSV.

## How an element works

Every element follows the same contract, in `backend/app/modules/takeoff/contracts.py`:

| Step | What it is | Where |
| --- | --- | --- |
| **observe** | The facts read from drawings, as a Pydantic model. They come from manual entry or from the agent. | `observation_model` |
| **measure** | Optional. Fills values from a box drawn on a page, using the page scale. | `measure(geometry, frame)` |
| **quantify** | Plain code that turns observations into BOQ items. No AI here. | `quantify(observed, frame)` |
| **check** | Plain code that reports issues. Errors block confirming. | `check(observed, items, frame)` |

All values are metres and counts. Each BOQ item keeps a `basis` line (for example `4 x 1.500 x 1.200 x 0.600`) so a reviewer can follow the sum.

The worked example is `backend/app/modules/takeoff/elements/example_pad_footing.py`, with tests in `backend/tests/test_example_pad_footing.py`. Its agent prompt is `agent-runtime/prompts/example_pad_footing.md`.

The agent never decides quantities. It only submits observations, which the backend checks against your observation model. If they are invalid, nothing is saved and the agent gets one chance to fix them.

## Add an element

1. Copy `backend/app/modules/takeoff/elements/example_pad_footing.py` to a new file, for example `my_element.py`.
2. Change `KEY`, `SECTION`, the display name, the observation model, and `measure`, `quantify` and `check`.
3. Import it in `backend/app/modules/takeoff/elements/__init__.py`.
4. Add `agent-runtime/prompts/<your key>.md` telling the agent what to look for. Leave `prompt_file=None` if you do not want agent support.
5. Add tests in `backend/tests/`.
6. Restart the backend. Your element appears in Takeoff and Review.

If you change a model in `backend/app/modules/takeoff/contracts.py`, run `python backend/scripts/export_contracts.py` from the repo root. The full API description is always live at http://127.0.0.1:8000/openapi.json.

## Tests

From the repo root, with the backend virtual environment active:

```powershell
pytest backend; ruff check backend                                # backend
npm --prefix agent-runtime test                                   # agent runtime
npm --prefix frontend run typecheck; npm --prefix frontend run lint   # frontend
```

GitHub Actions runs all of them on every push.

## Your task

Your Notion page explains which element to build and links the brief or videos to follow.

1. Click **Use this template** on GitHub to create your own copy. Make it **private**.
2. Add your element by following [Add an element](#add-an-element). Model what a quantity surveyor would read from the drawings, then write `quantify` and `check` to follow the measurement rules in your brief.
3. Write tests that show your quantities are right.
4. Add an agent prompt for your element and try it on a real drawing.
5. Fill in `ANSWERS.md` with your assumptions and notes.
6. Invite **Concolabs-Info** as a collaborator on your repo and paste the link under "Your links" on your Notion page.

Small, clear commits are welcome. If something in this repo gets in your way, change it and say why in `ANSWERS.md`.

### Using Codex and other AI tools

You are welcome to use Codex, ChatGPT, Claude, Copilot or any other AI coding tool while you work. We use them every day too. What we look at is whether you understand and can explain the code you hand in, so:

- Read and test what an AI tool writes before you keep it.
- Make sure the measurement rules come from your brief, not from a guess.
- Note in `ANSWERS.md` which tools you used and for what.

The in-app agent is separate from your coding tools. It is part of the product: it reads drawings and submits observations for your element, and your prompt in `agent-runtime/prompts/` decides how well it does that.

## Repo layout

```
backend/         FastAPI app, element contract, example element, tests
agent-runtime/   Codex login, agent runs, prompts, tests
frontend/        Next.js app
shared/          JSON contracts generated from the backend models
```
