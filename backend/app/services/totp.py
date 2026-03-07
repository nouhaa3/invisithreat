import io
import base64
import pyotp
import qrcode
from qrcode.image.pil import PilImage

APP_NAME = "InvisiThreat"


def generate_secret() -> str:
    """Generate a new random TOTP secret (base32)."""
    return pyotp.random_base32()


def get_totp_uri(secret: str, email: str) -> str:
    """Return the otpauth:// URI used to configure an authenticator app."""
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(name=email, issuer_name=APP_NAME)


def generate_qr_base64(secret: str, email: str) -> str:
    """Return a base64-encoded PNG data URL of the TOTP QR code."""
    uri = get_totp_uri(secret, email)
    img = qrcode.make(uri, image_factory=PilImage)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    encoded = base64.b64encode(buf.getvalue()).decode()
    return f"data:image/png;base64,{encoded}"


def verify_totp(secret: str, code: str) -> bool:
    """Verify a 6-digit TOTP code (allows 1-step clock drift = ±30 s)."""
    totp = pyotp.TOTP(secret)
    return totp.verify(code, valid_window=1)
