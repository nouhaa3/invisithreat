from fastapi import APIRouter
from fastapi.responses import PlainTextResponse
from pathlib import Path

router = APIRouter(prefix="/scanner", tags=["scanner"])

# Resolve scan.py relative to this file: backend/app/api/routes/scanner.py -> ../../../../scripts/scan.py
_SCRIPTS_DIR = Path(__file__).resolve().parents[4] / "scripts"


@router.get("/download", response_class=PlainTextResponse)
async def download_scanner():
    """
    Serve the InvisiThreat CLI scanner script.
    Users download this once and run it locally — source code never leaves their machine.
    """
    script_path = _SCRIPTS_DIR / "scan.py"
    if not script_path.exists():
        # Fallback: try the path relative to the working directory (Docker context)
        script_path = Path("/scripts/scan.py")

    if not script_path.exists():
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Scanner script not found on server.")

    content = script_path.read_text(encoding="utf-8")
    return PlainTextResponse(
        content=content,
        media_type="text/x-python",
        headers={"Content-Disposition": 'attachment; filename="scan.py"'},
    )


@router.get("/version")
async def scanner_version():
    return {"version": "0.1.0", "name": "invisithreat-scanner", "language": "python"}
