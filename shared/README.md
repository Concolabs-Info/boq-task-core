# Shared contracts

JSON Schemas for the data that moves between the backend, the frontend and the agent runtime.
They are generated from the backend models, so do not edit them by hand:

```
python backend/scripts/export_contracts.py
```

A backend test fails if they are out of date.

## Conventions

- **Pixels:** pages are rendered at 150 DPI. Every box and point is in those render pixels, origin top left, x to the right, y down.
- **Boxes:** `bbox` is `[x0, y0, x1, y1]` with `x0 < x1` and `y0 < y1`.
- **Units:** observation values and quantities are in metres (m, m2, m3) or counts (nr). Convert millimetres before storing.
- **Scale:** a page scale is stored as metres per render pixel.
