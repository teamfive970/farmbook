# Minders API

FastAPI starter service. The current scaffold exposes only `GET /health`.

## Run locally

```bash
python -m venv .venv
# Windows PowerShell: .venv\\Scripts\\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

**Not production-ready:** farmer authentication, Admin authorization, database persistence and cloud synchronization are not implemented.
