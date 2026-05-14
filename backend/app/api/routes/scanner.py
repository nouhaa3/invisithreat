from fastapi import APIRouter, HTTPException
from fastapi.responses import PlainTextResponse
from pathlib import Path

router = APIRouter(prefix="/scanner", tags=["scanner"])

# Resolve scanner.py relative to this file: backend/app/api/routes/scanner.py -> ../../../../scanner-cli/scanner.py
_SCANNER_CLI_DIR = Path(__file__).resolve().parents[4] / "scanner-cli"


@router.get("/download", response_class=PlainTextResponse)
async def download_scanner():
    """
    Serve the InvisiThreat CLI scanner script.
    Users download this once and run it locally — source code never leaves their machine.
    
    Supports commands:
      - login: Save API key and connect to platform
      - logout: Remove saved credentials
      - scan: Scan local directory and upload results
      - projects: List accessible projects
      - status: Show current user info
    """
    script_path = _SCANNER_CLI_DIR / "scanner.py"
    if not script_path.exists():
        # Fallback: try the path relative to the working directory (Docker context)
        script_path = Path("/scanner-cli/scanner.py")

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
