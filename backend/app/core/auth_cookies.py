from fastapi import Request, Response

from app.core.config import settings

ACCESS_COOKIE = "ivt_access_token"
REFRESH_COOKIE = "ivt_refresh_token"


def _cookie_secure() -> bool:
    if settings.ENVIRONMENT.lower() == "production":
        return True
    return bool(settings.AUTH_COOKIE_SECURE and settings.ENVIRONMENT.lower() != "development")


def set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    secure = _cookie_secure()
    samesite = getattr(settings, "AUTH_COOKIE_SAMESITE", "lax")
    response.set_cookie(
        key=ACCESS_COOKIE,
        value=access_token,
        httponly=True,
        secure=secure,
        samesite=samesite,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=refresh_token,
        httponly=True,
        secure=secure,
        samesite=samesite,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path="/",
    )


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(ACCESS_COOKIE, path="/")
    response.delete_cookie(REFRESH_COOKIE, path="/")


def get_access_cookie(request: Request) -> str | None:
    return request.cookies.get(ACCESS_COOKIE)


def get_refresh_cookie(request: Request) -> str | None:
    return request.cookies.get(REFRESH_COOKIE)
