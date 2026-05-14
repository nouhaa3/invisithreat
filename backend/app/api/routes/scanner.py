from fastapi import APIRouter, HTTPException
from fastapi.responses import PlainTextResponse
from pathlib import Path

router = APIRouter(prefix="/scanner", tags=["scanner"])

# Resolve scan.py relative to repo root: backend/app/api/routes/scanner.py -> ../../../../scripts/scan.py
_REPO_ROOT = Path(__file__).resolve().parents[4]
_SCRIPT_PATH = _REPO_ROOT / "scripts" / "scan.py"


@router.get("/download", response_class=PlainTextResponse)
async def download_scanner():
    """
        Serve the lightweight Python CLI scanner script (token-based upload).
        Users download this once and run it locally — source code never leaves their machine.
    """
    script_path = _SCRIPT_PATH
    if not script_path.exists():
        # Fallback: try the path mounted in Docker compose
        script_path = Path("/scripts/scan.py")

    if not script_path.exists():
        raise HTTPException(status_code=404, detail="Scanner script not found on server.")

    content = script_path.read_text(encoding="utf-8")
    return PlainTextResponse(
        content=content,
        media_type="text/x-python",
        headers={"Content-Disposition": 'attachment; filename="invisithreat-scan.py"'},
    )


@router.get("/version")
async def scanner_version():
    return {"version": "0.1.0", "name": "invisithreat-scanner", "language": "python"}
