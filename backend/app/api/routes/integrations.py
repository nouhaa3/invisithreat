import hashlib
import hmac
import secrets
import time
import uuid
from urllib.parse import urlencode, urlparse

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from pydantic import BaseModel, ConfigDict
import requests
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.permissions import P, require_permission
from app.db.session import get_db
from app.models.github_repository import GitHubRepository
from app.models.scan import Scan, ScanMethod, ScanStatus
from app.models.user import User
from app.services.project import get_project_accessible
from app.services.github_scanner import run_github_scan

router = APIRouter(prefix="/integrations", tags=["Integrations"])


class GitHubOAuthExchangeRequest(BaseModel):
    code: str
    state: str | None = None
    project_id: uuid.UUID | None = None
    repo_url: str | None = None
    repo_branch: str = "main"

    model_config = ConfigDict(extra="forbid")


def _repo_full_name_from_url(repo_url: str) -> str:
    parsed = urlparse((repo_url or "").strip())
    path = (parsed.path or "").strip("/")
    if path.lower().endswith(".git"):
        path = path[:-4]
    parts = [p for p in path.split("/") if p]
    if len(parts) >= 2:
        return f"{parts[0].lower()}/{parts[1].lower()}"
    return ""


def _verify_github_signature(raw_body: bytes, signature_header: str) -> bool:
    secret = (settings.GITHUB_WEBHOOK_SECRET or "").strip()
    if not secret:
        return False
    expected = "sha256=" + hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header or "")


def _oauth_state_secret() -> bytes:
    return (settings.SECRET_KEY or "invisithreat-oauth-state").encode("utf-8")


def _generate_oauth_state(ttl_seconds: int = 600) -> str:
    nonce = secrets.token_urlsafe(16)
    exp = int(time.time()) + max(60, ttl_seconds)
    payload = f"{nonce}.{exp}"
    sig = hmac.new(_oauth_state_secret(), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"{payload}.{sig}"


def _validate_oauth_state(state: str) -> bool:
    raw = (state or "").strip()
    parts = raw.split(".")
    if len(parts) != 3:
        return False
    nonce, exp_str, sig = parts
    if not nonce or not exp_str or not sig:
        return False
    if not exp_str.isdigit():
        return False

    payload = f"{nonce}.{exp_str}"
    expected = hmac.new(_oauth_state_secret(), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, sig):
        return False

    return int(exp_str) >= int(time.time())


def _exchange_github_code_for_token(code: str) -> dict:
    client_id = (settings.GITHUB_CLIENT_ID or "").strip()
    client_secret = (settings.GITHUB_CLIENT_SECRET or "").strip()
    redirect_uri = (settings.GITHUB_OAUTH_REDIRECT_URI or "").strip()

    if not client_id or not client_secret or not redirect_uri:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GitHub OAuth is not configured on this environment.",
        )

    try:
        response = requests.post(
            "https://github.com/login/oauth/access_token",
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "code": code,
                "redirect_uri": redirect_uri,
            },
            headers={"Accept": "application/json"},
            timeout=20,
        )
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"GitHub OAuth exchange failed: {exc}")

    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail="GitHub OAuth endpoint rejected the request")

    data = response.json() if response.content else {}
    token = (data.get("access_token") or "").strip()
    if not token:
        error_desc = (data.get("error_description") or data.get("error") or "Missing access token").strip()
        raise HTTPException(status_code=400, detail=f"GitHub OAuth failed: {error_desc}")

    return {
        "access_token": token,
        "token_type": data.get("token_type") or "bearer",
        "scope": data.get("scope") or "",
    }


@router.get("/github/app/install-url")
async def github_app_install_url(
    _user: User = Depends(require_permission(P.MANAGE_GITHUB_REPOS)),
):
    slug = (settings.GITHUB_APP_SLUG or "").strip()
    if not slug:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GitHub App is not configured on this environment.",
        )
    return {"install_url": f"https://github.com/apps/{slug}/installations/new"}


@router.get("/github/oauth/start")
async def github_oauth_start(
    _user: User = Depends(require_permission(P.MANAGE_GITHUB_REPOS)),
):
    client_id = (settings.GITHUB_CLIENT_ID or "").strip()
    redirect_uri = (settings.GITHUB_OAUTH_REDIRECT_URI or "").strip()

    if not client_id or not redirect_uri:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GitHub OAuth is not configured on this environment.",
        )

    state = _generate_oauth_state()
    query = urlencode(
        {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "scope": "repo,read:user",
            "state": state,
        }
    )
    return {
        "authorize_url": f"https://github.com/login/oauth/authorize?{query}",
        "state": state,
    }


@router.post("/github/oauth/exchange")
async def github_oauth_exchange(
    payload: GitHubOAuthExchangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(P.MANAGE_GITHUB_REPOS)),
):
    if not payload.state or not _validate_oauth_state(payload.state):
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state. Start OAuth again.")

    token_data = _exchange_github_code_for_token(payload.code)
    token = token_data["access_token"]

    if payload.project_id:
        project, _ = get_project_accessible(db, payload.project_id, current_user)

        repo_record = (
            db.query(GitHubRepository)
            .filter(GitHubRepository.project_id == project.id)
            .first()
        )

        if not repo_record:
            repo_record = GitHubRepository(
                project_id=project.id,
                name=(payload.repo_url or "repository").strip().rstrip("/").split("/")[-1] or "repository",
                url=(payload.repo_url or "").strip(),
                default_branch=(payload.repo_branch or "main").strip() or "main",
                access_token=token,
            )
            db.add(repo_record)
        else:
            if payload.repo_url:
                repo_record.url = payload.repo_url.strip()
                repo_record.name = payload.repo_url.strip().rstrip("/").split("/")[-1] or repo_record.name
            repo_record.default_branch = (payload.repo_branch or repo_record.default_branch or "main").strip() or "main"
            repo_record.access_token = token

        db.commit()

    return token_data


@router.get("/github/oauth/callback")
async def github_oauth_callback(code: str):
    token_data = _exchange_github_code_for_token(code)
    return {
        "message": "OAuth successful. Copy access_token and paste it in the GitHub Access Token field.",
        **token_data,
    }


@router.post("/github/webhook")
async def github_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    raw_body = await request.body()
    signature = request.headers.get("X-Hub-Signature-256", "")
    event = (request.headers.get("X-GitHub-Event") or "").lower()

    if not _verify_github_signature(raw_body, signature):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid GitHub webhook signature")

    payload = await request.json()

    if event == "ping":
        return {"message": "GitHub webhook verified"}

    if event != "push":
        return {"message": f"Ignored event: {event}"}

    full_name = (payload.get("repository", {}).get("full_name") or "").strip().lower()
    clone_url = (payload.get("repository", {}).get("clone_url") or "").strip()
    ref = (payload.get("ref") or "").strip()
    branch = ref.split("/")[-1] if ref.startswith("refs/heads/") else "main"

    if not full_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing repository.full_name in payload")

    repos = db.query(GitHubRepository).all()
    matched_repos = [r for r in repos if _repo_full_name_from_url(r.url) == full_name]

    if not matched_repos:
        return {"message": "No linked project for this repository", "repository": full_name, "created_scans": []}

    created_scan_ids: list[str] = []

    for repo in matched_repos:
        scan = Scan(
            id=uuid.uuid4(),
            project_id=repo.project_id,
            method=ScanMethod.github,
            status=ScanStatus.pending,
            repo_url=repo.url or clone_url,
            repo_branch=branch or repo.default_branch or "main",
        )
        db.add(scan)
        db.flush()

        background_tasks.add_task(
            run_github_scan,
            scan_id=str(scan.id),
            repo_url=scan.repo_url,
            branch=scan.repo_branch,
            db_url=settings.DATABASE_URL,
            github_token=repo.access_token,
        )
        created_scan_ids.append(str(scan.id))

    db.commit()

    return {
        "message": "Webhook processed",
        "repository": full_name,
        "created_scans": created_scan_ids,
    }
