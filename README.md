# BOQ Task Core

A small bill of quantities (BOQ) app. You upload construction drawings, read elements off them by hand or with an AI agent, review the results, and get a BOQ.

It is the starting point for the Concolabs developer task. Your job is to add one element to it. See [Your task](#your-task).

> [!IMPORTANT]
> **How to take the task: use the template, do not fork.**
>
> 1. Click the green **Use this template** button at the top of this page, then **Create a new repository**.
> 2. Create it under your own GitHub account and set it to **Private**.
> 3. Do all your work in your copy. Do not fork this repo and do not open pull requests here.
> 4. When you are done, go to your repo's **Settings > Collaborators**, click **Add people** and invite **`Concolabs-Info`**.
> 5. Paste your repo link under **Your links** on your Notion page.
>
> A template copy is your own repo with a clean history. It is not linked back here, so other candidates cannot see your work, and you never need to share your GitHub username with us up front.

> [!NOTE]
> **Disclaimer.** This repository belongs to Concolabs Inc. and is shared only for the Concolabs hiring task. See [License and disclaimer](#license-and-disclaimer).

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

Open http://localhost:3000. The bottom of the sidebar shows whether the agent is ready.

## Using the app

`samples/example-foundation-plan.pdf` is a small A3 foundation plan at 1:100 with pad footings F1 and F2 and a footing schedule. Use it to try the whole flow before you work on your own drawings.

1. Create a project and open it.
2. **Pre:** upload a PDF. For each page you will measure on, set the scale (a printed ratio like 1:100, or two points a known distance apart). Add the storeys, then click **Freeze frame**.
3. **Takeoff:** pick **Example: Pad footing concrete**. Draw a box around a footing on the plan, then choose **Enter values by hand** (length and width come from the box, type the mark and depth) or **Ask the agent to read it**.
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

Rules the core applies to every element, so you do not need to code them:

- **Box versus typed values.** For a box you draw by hand, the values `measure` returns replace what was typed, because the box is the source. For the agent it is the other way round: values it read from the drawing win, and `measure` only fills the fields it left out.
- **Missing scale.** Drawing a box on a page with no scale is refused with "Set the scale for this page first".
- **Storeys.** An observation whose storey is no longer in Pre gets an `unknown_storey` error.
- **Crashes.** If `quantify` or `check` raises, the element shows a `quantify_failed` or `check_failed` error instead of breaking the page. Stored values that no longer fit a changed observation model show `invalid_observation`.
- **Re-freezing.** Manual observations with a box are measured again with the new scale. If your `measure` raises, the old values are kept.

## Add an element

1. Copy `backend/app/modules/takeoff/elements/example_pad_footing.py` to a new file, for example `my_element.py`.
2. Change `KEY`, `SECTION`, the display name, the observation model, and `measure`, `quantify` and `check`.
3. Import it in `backend/app/modules/takeoff/elements/__init__.py`.
4. Add `agent-runtime/prompts/<your key>.md` telling the agent what to look for. Leave `prompt_file=None` if you do not want agent support.
5. Add tests in `backend/tests/`.
6. Restart the backend. Your element appears in Takeoff and Review.

If you change a model in `backend/app/modules/takeoff/contracts.py`, run `python backend/scripts/export_contracts.py` from the repo root. The full API description is always live at http://127.0.0.1:8000/openapi.json.

## Reading the PDF deterministically

Drawings exported from CAD are not just pictures. The PDF still holds the exact data the image is drawn from, and you can read it with plain code, with no AI and no guessing:

| In the PDF | What it gives you | Example |
| --- | --- | --- |
| **Text with positions** | Every mark, dimension, note and schedule cell as exact text, with its box | `F1`, `1500 x 1200`, a schedule row `F1  1500 x 1200  600` |
| **Vector paths** | The lines, rectangles and curves the drawing is made of, with exact coordinates | the outline of a footing, a beam edge, a grid line |
| **Layers** | PDF optional content groups, usually the CAD layer names | `S-FOUNDATIONS`, `A-DIMS`, `A-TEXT` |

The sample drawing has all three. Its footing outlines sit on the `S-FOUNDATIONS` layer. The F1 outline is 89 px wide, which is 1.507 m at 1:100. That is exact to the pixel, where a hand-drawn box is only as good as your mouse.

This repo already gives you a reader for it:

- **Python:** `read_vectors(pdf_path, page_index, bbox=None, layers=None)` in `backend/app/services/pdf_vectors.py`. It returns `layers`, `text` (lines with their box) and `paths` (kind, box, layer, points), all in render pixels like the rest of the app.
- **API:** `GET /api/pages/{page_id}/vectors?x0=&y0=&x1=&y1=&layer=` returns the same as JSON. Leave out the box for the whole page, and repeat `layer=` to filter.
- **Agent:** the `read_vectors` tool. The base prompt tells the agent to prefer exact PDF text over reading numbers from the image.
- **UI:** when you draw a box in Takeoff, the panel shows the text and layers the PDF holds inside it.

Ways you can use it for your element:

- **Measure from geometry, not from the mouse.** Find the vector rectangles or lines on your element's layer inside the drawn box, and take sizes from them instead of the box edges.
- **Read printed sizes and schedules as text.** Pull section sizes, bar marks or schedule rows straight from the text, and check them against what was measured.
- **Use layers to separate elements.** Filter by layer to find every beam or slab edge on a plan, then count or measure them.
- **Combine it with the agent.** Let code extract what it can read exactly, and let the agent handle what needs judgement, such as which note applies to which element.

Not every PDF has this data. Scanned drawings are only an image: then `text` and `paths` come back empty and you fall back to the scale and a drawn box. Many exports have no named layers either. Handle these cases and say in `ANSWERS.md` how you did.

## Commands

| Where | Command | What it does |
| --- | --- | --- |
| `backend` | `uvicorn app.main:app --reload` | Run the API on port 8000 (docs at `/docs`) |
| `backend` | `pytest` | Backend tests |
| `backend` | `ruff check .` and `ruff format .` | Lint and format |
| repo root | `python backend/scripts/export_contracts.py` | Regenerate `shared/contracts` after changing a contract model |
| `agent-runtime` | `npm run auth` | Log in to Codex with your ChatGPT account (once) |
| `agent-runtime` | `npm run health` | Print `ready` or `login_required` |
| `agent-runtime` | `npm run models` | List the Codex models your account can use |
| `agent-runtime` | `npm start` | Run the agent runtime |
| `agent-runtime` | `npm test` | Agent runtime tests (no login or network needed) |
| `frontend` | `npm run dev` | Run the app on port 3000 |
| `frontend` | `npm run typecheck` and `npm run lint` | Type check and lint |

## Troubleshooting

| You see | Do this |
| --- | --- |
| Projects page says it cannot reach the backend | Start the backend (step 2). Check `NEXT_PUBLIC_API_URL` in `.env`. |
| Sidebar says **Agent offline** | Start the agent runtime with `npm start`. Check `AGENT_RUNTIME_URL` matches `AGENT_RUNTIME_PORT`, and that `AGENT_RUNTIME_TOKEN` is set. |
| Sidebar says **Agent needs login** | Run `npm run auth` in `agent-runtime`. |
| Agent run fails with "model is not supported" | Run `npm run models`, put a model marked `ok` in `AGENT_MODEL`, restart `npm start`. |
| `Port 8090 is already in use` | Set `AGENT_RUNTIME_PORT` and `AGENT_RUNTIME_URL` in `.env` to another port. |
| "Freeze the frame first" | Pre changed after the last freeze. Freeze again in Pre. |
| "Set the scale for this page first" | Set the page scale in Pre, freeze, then draw the box again. |
| "Credential file could not be decrypted" | `AGENT_CREDENTIAL_KEY` changed. Delete `.agent-state/` and run `npm run auth` again. |
| You want a clean start | Stop the backend and delete the `storage/` folder. It holds the database and uploaded drawings. |

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

1. Create your private copy with **Use this template**, as shown in [How to take the task](#boq-task-core) at the top. Do not fork.
2. Add your element by following [Add an element](#add-an-element). Model what a quantity surveyor would read from the drawings, then write `quantify` and `check` to follow the measurement rules in your brief.
3. Write tests that show your quantities are right.
4. Where your drawings allow it, read sizes and text from the PDF itself. See [Reading the PDF deterministically](#reading-the-pdf-deterministically).
5. Add an agent prompt for your element and try it on a real drawing.
6. Fill in `ANSWERS.md` with your assumptions and notes.
7. Invite **`Concolabs-Info`** as a collaborator on your repo and paste the link under **Your links** on your Notion page.

Small, clear commits are welcome. If something in this repo gets in your way, change it and say why in `ANSWERS.md`.

### Using Codex and other AI tools

You are welcome to use Codex, ChatGPT, Claude, Copilot or any other AI coding tool while you work. We use them every day too. What we look at is whether you understand and can explain the code you hand in, so:

- Read and test what an AI tool writes before you keep it.
- Make sure the measurement rules come from your brief, not from a guess.
- Note in `ANSWERS.md` which tools you used and for what.

The in-app agent is separate from your coding tools. It is part of the product: it reads drawings and submits observations for your element, and your prompt in `agent-runtime/prompts/` decides how well it does that.

## Repo layout

```
backend/
  app/api/routes/             HTTP routes (internal.py is only for the agent runtime)
  app/modules/pre/            projects, uploads, scale, storeys, frame
  app/modules/takeoff/        element contract, registry, observations, pipeline
  app/modules/takeoff/elements/   one file per element: put yours here
  app/modules/review/         confirmations and stale checks
  app/modules/boq/            BOQ lines and CSV
  app/services/pdf.py         PDF checks, page renders and crops
  app/services/pdf_vectors.py reads text, vector paths and layers from the PDF
  tests/
agent-runtime/
  src/                        Codex login, encrypted credential file, run loop, HTTP server
  src/tools/                  read_project, crop, read_vectors, submit_observations
  prompts/                    element-reader.md plus one prompt per element
  tests/
frontend/
  src/app/                    pages: projects, Pre, Takeoff, Review, BOQ
  src/components/             viewer, forms, tables, shared UI
shared/contracts/             JSON Schemas generated from the backend models
samples/                      a sample drawing to try the app with
ANSWERS.md                    your notes for the reviewers
```

## License and disclaimer

Copyright (c) 2026 Concolabs Inc. All rights reserved. See [`LICENSE`](LICENSE).

- **For the hiring task only.** If Concolabs invited you, you may copy this repo into a private repository, run it and change it to complete the task and share it with us. Do not use it for anything else, and do not publish it or your copy.
- **Not a product.** This is a small teaching base for an interview task. It is not a Concolabs product, it is not secure enough to put on the internet, and its quantities must not be used for real tenders, contracts, estimates or construction.
- **Sample data is made up.** The sample drawing and the example element are invented to show the pattern. They do not describe a real project or a full measurement method.
- **AI output can be wrong.** The agent can misread drawings. Everything it submits has to be checked by a person before it counts, which is why Review exists.
- **Your ChatGPT account is yours.** The agent runs on your own ChatGPT account through Codex, under OpenAI's terms. Your login is stored encrypted on your machine only and is never sent to Concolabs. Requests the agent makes count against your own plan.
- **Your work stays yours.** By sharing your repository with Concolabs you let us access, run and review it to assess your application.
- **Third-party packages** (FastAPI, PyMuPDF, Next.js, pi-ai and others) are not part of this repo and keep their own licenses.
- **No warranty.** Provided as is, without warranty of any kind. See `LICENSE`.
