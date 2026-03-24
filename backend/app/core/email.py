"""
Email notification service — Brevo (Sendinblue) Transactional API
"""
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import sib_api_v3_sdk  # type: ignore  # pylint: disable=import-error
from sib_api_v3_sdk.rest import ApiException  # type: ignore  # pylint: disable=import-error
from app.core.config import settings

logger = logging.getLogger(__name__)

SENDER = {"email": (settings.EMAIL_FROM or settings.ADMIN_EMAIL or "no-reply@invisithreat.local"), "name": "InvisiThreat"}


def _send_brevo(to: str, subject: str, html: str, text: str) -> bool:
    if not settings.BREVO_API_KEY:
        return False
    try:
        configuration = sib_api_v3_sdk.Configuration()
        configuration.api_key["api-key"] = settings.BREVO_API_KEY

        api = sib_api_v3_sdk.TransactionalEmailsApi(
            sib_api_v3_sdk.ApiClient(configuration)
        )

        email = sib_api_v3_sdk.SendSmtpEmail(
            to=[{"email": to}],
            sender=SENDER,
            subject=subject,
            html_content=html,
            text_content=text,
        )

        api.send_transac_email(email)
        logger.info("Email sent via Brevo to %s — %s", to, subject)
        return True
    except ApiException as exc:
        logger.error("Brevo API error sending to %s: %s", to, exc)
        return False
    except Exception as exc:
        logger.error("Failed to send via Brevo to %s: %s", to, exc)
        return False


def _send_smtp(to: str, subject: str, html: str, text: str) -> bool:
    if not settings.SMTP_HOST or not settings.SMTP_USERNAME or not settings.SMTP_PASSWORD:
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = SENDER["email"]
        msg["To"] = to
        msg.attach(MIMEText(text, "plain", "utf-8"))
        msg.attach(MIMEText(html, "html", "utf-8"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20) as server:
            if settings.SMTP_USE_TLS:
                server.starttls()
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.sendmail(SENDER["email"], [to], msg.as_string())

        logger.info("Email sent via SMTP to %s — %s", to, subject)
        return True
    except Exception as exc:
        logger.error("Failed to send via SMTP to %s: %s", to, exc)
        return False

def _send(to: str, subject: str, html: str, text: str) -> bool:
    """Low-level send: Brevo first, then SMTP fallback. Never raises."""
    if _send_brevo(to, subject, html, text):
        return True
    if _send_smtp(to, subject, html, text):
        return True
    logger.warning(
        "No email transport configured or available for %s. Configure BREVO_API_KEY or SMTP_*.",
        to,
    )
    return False


# ─── Templates ───────────────────────────────────────────────────────────────

def notify_admin_new_request(nom: str, email: str, role_name: str, approve_token: str, reject_token: str) -> bool:
    """Notify the admin that a new user is waiting for approval, with one-click approve/reject buttons."""
    if not settings.ADMIN_EMAIL:
        logger.warning("ADMIN_EMAIL not set — skipping admin notification")
        return False

    approve_url = f"{settings.BACKEND_URL}/api/auth/action/approve/{approve_token}"
    reject_url  = f"{settings.BACKEND_URL}/api/auth/action/reject/{reject_token}"

    subject = f"[InvisiThreat] New account request from {nom}"

    html = f"""
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#080808;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="560" style="background:#111111;border-radius:16px;border:1px solid rgba(255,255,255,0.06);overflow:hidden;">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#1a0a00,#111);padding:32px 36px;border-bottom:1px solid rgba(255,107,43,0.15);">
          <span style="font-size:22px;font-weight:700;color:#FF8C5A;">InvisiThreat</span>
          <span style="font-size:12px;color:rgba(255,255,255,0.3);margin-left:12px;">Admin Notification</span>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:36px;">
          <p style="color:rgba(255,255,255,0.5);font-size:14px;margin:0 0 8px;">New account request</p>
          <h2 style="color:#fff;font-size:24px;margin:0 0 24px;">Someone wants to join</h2>
          <table width="100%" style="background:rgba(255,107,43,0.06);border:1px solid rgba(255,107,43,0.15);border-radius:12px;margin-bottom:28px;">
            <tr><td style="padding:20px 24px;">
              <table>
                <tr>
                  <td style="padding:4px 0;color:rgba(255,255,255,0.35);font-size:13px;width:80px;">Name</td>
                  <td style="padding:4px 0;color:#fff;font-size:13px;font-weight:600;">{nom}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;color:rgba(255,255,255,0.35);font-size:13px;">Email</td>
                  <td style="padding:4px 0;color:#FF8C5A;font-size:13px;">{email}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;color:rgba(255,255,255,0.35);font-size:13px;">Role</td>
                  <td style="padding:4px 0;color:#a78bfa;font-size:13px;font-weight:600;">{role_name}</td>
                </tr>
              </table>
            </td></tr>
          </table>

          <!-- One-click action buttons -->
          <p style="color:rgba(255,255,255,0.4);font-size:13px;margin:0 0 16px;">Click a button to decide — no login required:</p>
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding-right:12px;">
                <a href="{approve_url}"
                   style="display:inline-block;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;font-weight:700;font-size:14px;text-decoration:none;padding:13px 28px;border-radius:10px;">
                  ✓ Approve
                </a>
              </td>
              <td>
                <a href="{reject_url}"
                   style="display:inline-block;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.35);color:#f87171;font-weight:700;font-size:14px;text-decoration:none;padding:12px 28px;border-radius:10px;">
                  ✕ Reject
                </a>
              </td>
            </tr>
          </table>
          <p style="color:rgba(255,255,255,0.2);font-size:11px;margin-top:16px;">Links expire in 7 days.</p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:20px 36px;border-top:1px solid rgba(255,255,255,0.05);">
          <p style="color:rgba(255,255,255,0.2);font-size:12px;margin:0;">InvisiThreat · DevSecOps Platform</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""

    plain = (
        f"New account request on InvisiThreat\n\n"
        f"Name:  {nom}\nEmail: {email}\nRole:  {role_name}\n\n"
        f"APPROVE: {approve_url}\n\n"
        f"REJECT:  {reject_url}\n\n"
        f"Links expire in 7 days."
    )
    return _send(settings.ADMIN_EMAIL, subject, html, plain)


def notify_user_approved(nom: str, email: str) -> bool:
    """Tell the user their request was approved."""
    subject = "[InvisiThreat] Your account has been approved! 🎉"
    login_url = f"{settings.FRONTEND_URL}/login"

    html = f"""
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#080808;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="560" style="background:#111111;border-radius:16px;border:1px solid rgba(255,255,255,0.06);overflow:hidden;">
        <tr><td style="background:linear-gradient(135deg,#001a0d,#111);padding:32px 36px;border-bottom:1px solid rgba(34,197,94,0.15);">
          <span style="font-size:22px;font-weight:700;color:#4ade80;">InvisiThreat</span>
        </td></tr>
        <tr><td style="padding:40px 36px;text-align:center;">
          <div style="width:56px;height:56px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.2);border-radius:50%;margin:0 auto 20px;display:flex;align-items:center;justify-content:center;font-size:26px;">✓</div>
          <h2 style="color:#fff;font-size:26px;margin:0 0 12px;">You're in, {nom}!</h2>
          <p style="color:rgba(255,255,255,0.4);font-size:14px;line-height:1.6;margin:0 0 32px;">
            Your InvisiThreat account has been approved by the administrator.<br>
            You can now sign in and start securing your pipelines.
          </p>
          <a href="{login_url}" style="display:inline-block;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;font-weight:700;font-size:14px;text-decoration:none;padding:13px 32px;border-radius:10px;">
            Sign In Now →
          </a>
        </td></tr>
        <tr><td style="padding:20px 36px;border-top:1px solid rgba(255,255,255,0.05);">
          <p style="color:rgba(255,255,255,0.2);font-size:12px;margin:0;text-align:center;">InvisiThreat · DevSecOps Platform</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""

    plain = (
        f"Hello {nom},\n\n"
        f"Your InvisiThreat account has been approved.\n"
        f"You can now log in at: {login_url}\n\n"
        f"Welcome aboard!"
    )
    return _send(email, subject, html, plain)


def notify_user_rejected(nom: str, email: str) -> bool:
    """Tell the user their request was rejected."""
    subject = "[InvisiThreat] Your account request was not approved"

    html = f"""
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#080808;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="560" style="background:#111111;border-radius:16px;border:1px solid rgba(255,255,255,0.06);overflow:hidden;">
        <tr><td style="background:linear-gradient(135deg,#1a0000,#111);padding:32px 36px;border-bottom:1px solid rgba(239,68,68,0.15);">
          <span style="font-size:22px;font-weight:700;color:#f87171;">InvisiThreat</span>
        </td></tr>
        <tr><td style="padding:40px 36px;text-align:center;">
          <h2 style="color:#fff;font-size:24px;margin:0 0 16px;">Hello {nom},</h2>
          <p style="color:rgba(255,255,255,0.4);font-size:14px;line-height:1.7;margin:0 0 20px;">
            Unfortunately, your request to join <strong style="color:#fff;">InvisiThreat</strong> was not approved<br>
            by the administrator at this time.
          </p>
          <p style="color:rgba(255,255,255,0.3);font-size:13px;margin:0;">
            If you believe this is a mistake, please contact your organisation's security admin.
          </p>
        </td></tr>
        <tr><td style="padding:20px 36px;border-top:1px solid rgba(255,255,255,0.05);">
          <p style="color:rgba(255,255,255,0.2);font-size:12px;margin:0;text-align:center;">InvisiThreat · DevSecOps Platform</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""

    plain = (
        f"Hello {nom},\n\n"
        f"Unfortunately, your request to join InvisiThreat was not approved.\n"
        f"Please contact your organisation's admin for more information."
    )
    return _send(email, subject, html, plain)


def notify_admin_reset_code(nom: str, email: str, code: str) -> bool:
    """Send the 6-digit password reset code directly to the user."""
    subject = "[InvisiThreat] Your password reset code"

    html = f"""
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#080808;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="560" style="background:#111111;border-radius:16px;border:1px solid rgba(255,255,255,0.06);overflow:hidden;">
        <tr><td style="background:linear-gradient(135deg,#0a0015,#111);padding:32px 36px;border-bottom:1px solid rgba(139,92,246,0.2);">
          <span style="font-size:22px;font-weight:700;color:#FF8C5A;">InvisiThreat</span>
          <span style="font-size:12px;color:rgba(255,255,255,0.3);margin-left:12px;">Password Reset</span>
        </td></tr>
        <tr><td style="padding:36px;">
          <h2 style="color:#fff;font-size:22px;margin:0 0 12px;">Hi {nom},</h2>
          <p style="color:rgba(255,255,255,0.4);font-size:14px;line-height:1.7;margin:0 0 24px;">
            We received a request to reset your InvisiThreat password.<br>
            Use the code below to continue. It expires in <strong style="color:#fff;">30 minutes</strong>.
          </p>
          <div style="text-align:center;margin:24px 0;">
            <span style="display:inline-block;background:rgba(139,92,246,0.12);border:1px solid rgba(139,92,246,0.3);border-radius:14px;padding:18px 40px;font-size:36px;font-weight:800;letter-spacing:10px;color:#a78bfa;">{code}</span>
          </div>
          <p style="color:rgba(255,255,255,0.25);font-size:12px;text-align:center;margin:0;">
            If you didn't request this, you can safely ignore this email.
          </p>
        </td></tr>
        <tr><td style="padding:20px 36px;border-top:1px solid rgba(255,255,255,0.05);">
          <p style="color:rgba(255,255,255,0.2);font-size:12px;margin:0;text-align:center;">InvisiThreat · DevSecOps Platform</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""

    plain = (
        f"Hi {nom},\n\n"
        f"Your InvisiThreat password reset code is: {code}\n\n"
        f"This code expires in 30 minutes.\n"
        f"If you didn't request this, ignore this email."
    )
    return _send(email, subject, html, plain)


def notify_user_verify_email(nom: str, email: str, verification_token: str, frontend_url: str) -> bool:
    """Send email verification link to newly registered user."""
    subject = "[InvisiThreat] Verify your email address"
    verify_url = f"{frontend_url}/verify-email?token={verification_token}"

    html = f"""
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#080808;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#080808;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#111111;border-radius:18px;border:1px solid rgba(255,107,43,0.18);overflow:hidden;box-shadow:0 0 50px rgba(255,107,43,0.08);">
          <tr>
            <td style="padding:28px 32px;background:linear-gradient(135deg,#1a0902,#111111);border-bottom:1px solid rgba(255,107,43,0.15);">
              <span style="font-size:22px;font-weight:700;color:#FF8C5A;letter-spacing:.3px;">InvisiThreat</span>
              <span style="font-size:12px;color:rgba(255,255,255,0.3);margin-left:10px;">Email Verification</span>
            </td>
          </tr>
            <tr><td style="padding:36px 32px;">
              <h2 style="color:#ffffff;font-size:26px;line-height:1.2;margin:0 0 10px;text-align:center;">Welcome, {nom}!</h2>
              <p style="color:rgba(255,255,255,0.55);font-size:14px;line-height:1.65;margin:0 0 26px;text-align:center;">
                Verify your email to activate your account and start securing your pipeline.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td align="center">
                    <a href="{verify_url}" style="display:inline-block;background:linear-gradient(135deg,#FF6B2B,#C13A00);color:#fff;font-weight:700;font-size:14px;text-decoration:none;padding:13px 30px;border-radius:10px;box-shadow:0 8px 24px rgba(255,107,43,0.3);">
                      Verify My Email
                    </a>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);border-radius:12px;">
                <tr>
                  <td style="padding:14px 16px;color:rgba(255,255,255,0.42);font-size:12px;line-height:1.6;">
                    This verification link expires in <strong style="color:#fff;">24 hours</strong>.<br>
                    If you didn't create this account, you can safely ignore this email.
                  </td>
                </tr>
              </table>
            </td></tr>
          <tr>
            <td style="padding:18px 32px;border-top:1px solid rgba(255,255,255,0.05);text-align:center;">
              <p style="margin:0;color:rgba(255,255,255,0.22);font-size:12px;">InvisiThreat · DevSecOps Platform</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

    plain = (
        f"Hi {nom},\n\n"
        f"Welcome to InvisiThreat!\n"
        f"Please verify your email by visiting this link:\n"
        f"{verify_url}\n\n"
        f"This link expires in 24 hours.\n"
        f"If you didn't create this account, ignore this email."
    )
    return _send(email, subject, html, plain)


def notify_admin_role_request(user_nom: str, user_email: str, requested_role: str) -> bool:
    """Notify admin when a viewer requests a role upgrade."""
    if not settings.ADMIN_EMAIL:
        logger.warning("ADMIN_EMAIL not set — skipping admin role request notification")
        return False

    subject = f"[InvisiThreat] Role request: {user_nom} -> {requested_role}"

    html = f"""<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#080808;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="560" style="background:#111111;border-radius:16px;border:1px solid rgba(255,255,255,0.06);overflow:hidden;">
        <tr><td style="background:linear-gradient(135deg,#1a0a00,#111);padding:28px 32px;border-bottom:1px solid rgba(255,107,43,0.15);">
          <span style="font-size:22px;font-weight:700;color:#FF8C5A;">InvisiThreat</span>
          <span style="font-size:12px;color:rgba(255,255,255,0.3);margin-left:12px;">Role Request</span>
        </td></tr>
        <tr><td style="padding:32px;">
          <h2 style="color:#fff;font-size:22px;margin:0 0 14px;">New role request received</h2>
          <p style="color:rgba(255,255,255,0.5);font-size:14px;line-height:1.65;margin:0 0 20px;">
            A user requested a role upgrade and is waiting for admin review.
          </p>
          <table width="100%" style="background:rgba(255,107,43,0.06);border:1px solid rgba(255,107,43,0.16);border-radius:12px;">
            <tr><td style="padding:16px 18px;">
              <p style="margin:0 0 6px;color:rgba(255,255,255,0.35);font-size:12px;">User</p>
              <p style="margin:0 0 10px;color:#fff;font-size:14px;font-weight:600;">{user_nom}</p>
              <p style="margin:0 0 6px;color:rgba(255,255,255,0.35);font-size:12px;">Email</p>
              <p style="margin:0 0 10px;color:#FF8C5A;font-size:14px;">{user_email}</p>
              <p style="margin:0 0 6px;color:rgba(255,255,255,0.35);font-size:12px;">Requested role</p>
              <p style="margin:0;color:#fff;font-size:14px;font-weight:700;">{requested_role}</p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""

    plain = (
        "New role request on InvisiThreat\n\n"
        f"User: {user_nom}\n"
        f"Email: {user_email}\n"
        f"Requested role: {requested_role}\n"
    )
    return _send(settings.ADMIN_EMAIL, subject, html, plain)


def notify_user_role_request_received(nom: str, email: str, requested_role: str) -> bool:
    """Notify user that their role request has been submitted."""
    subject = "[InvisiThreat] Role request submitted"

    html = f"""<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#080808;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="560" style="background:#111111;border-radius:16px;border:1px solid rgba(255,255,255,0.06);overflow:hidden;">
        <tr><td style="background:linear-gradient(135deg,#1a0a00,#111);padding:28px 32px;border-bottom:1px solid rgba(255,107,43,0.15);">
          <span style="font-size:22px;font-weight:700;color:#FF8C5A;">InvisiThreat</span>
          <span style="font-size:12px;color:rgba(255,255,255,0.3);margin-left:12px;">Role Request</span>
        </td></tr>
        <tr><td style="padding:32px;">
          <h2 style="color:#fff;font-size:22px;margin:0 0 14px;">Request submitted successfully</h2>
          <p style="color:rgba(255,255,255,0.5);font-size:14px;line-height:1.65;margin:0 0 16px;">
            Hi {nom}, your request for <strong style="color:#fff;">{requested_role}</strong> role was sent to the administrators.
          </p>
          <p style="color:rgba(255,255,255,0.35);font-size:13px;line-height:1.6;margin:0;">
            You will receive another notification once your request is approved.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""

    plain = (
        f"Hi {nom},\n\n"
        f"Your request for {requested_role} role has been submitted to administrators.\n"
        "You will be notified when it is approved."
    )
    return _send(email, subject, html, plain)


def notify_user_role_request_approved(nom: str, email: str, role_name: str) -> bool:
    """Notify user when their role request is approved."""
    subject = "[InvisiThreat] Your role request was approved"
    login_url = f"{settings.FRONTEND_URL}/login"

    html = f"""<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#080808;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="560" style="background:#111111;border-radius:16px;border:1px solid rgba(255,255,255,0.06);overflow:hidden;">
        <tr><td style="background:linear-gradient(135deg,#001a0d,#111);padding:28px 32px;border-bottom:1px solid rgba(34,197,94,0.2);">
          <span style="font-size:22px;font-weight:700;color:#4ade80;">InvisiThreat</span>
          <span style="font-size:12px;color:rgba(255,255,255,0.3);margin-left:12px;">Role Approved</span>
        </td></tr>
        <tr><td style="padding:32px;">
          <h2 style="color:#fff;font-size:22px;margin:0 0 14px;">Great news, {nom}!</h2>
          <p style="color:rgba(255,255,255,0.5);font-size:14px;line-height:1.65;margin:0 0 20px;">
            Your role request has been approved. Your new role is <strong style="color:#fff;">{role_name}</strong>.
          </p>
          <a href="{login_url}" style="display:inline-block;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;font-weight:700;font-size:14px;text-decoration:none;padding:12px 28px;border-radius:10px;">
            Sign In
          </a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""

    plain = (
        f"Hi {nom},\n\n"
        f"Your role request has been approved. New role: {role_name}.\n"
        f"Sign in: {login_url}"
    )
    return _send(email, subject, html, plain)


def notify_project_invitation(
    invitee_email: str,
    invitee_nom: str | None,
    inviter_nom: str,
    project_name: str,
    role: str,
    registered: bool,
    frontend_url: str,
  ) -> bool:
    """Send a project invitation email. Works for both registered users and new ones."""
    action_url = f"{frontend_url}/login" if not registered else f"{frontend_url}/dashboard"
    btn_label = "Create My Account" if not registered else "Go to Dashboard"
    greeting = f"Hi {invitee_nom}," if invitee_nom else "Hello,"

    subject = f"[InvisiThreat] {inviter_nom} invites you to join project \"{project_name}\""

    html = f"""<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#080808;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="560" style="background:#111111;border-radius:16px;border:1px solid rgba(255,255,255,0.06);overflow:hidden;">
        <tr><td style="background:linear-gradient(135deg,#1a0a00,#111);padding:32px 36px;border-bottom:1px solid rgba(255,107,43,0.15);">
          <span style="font-size:22px;font-weight:700;color:#FF8C5A;">InvisiThreat</span>
          <span style="font-size:12px;color:rgba(255,255,255,0.3);margin-left:12px;">Project Invitation</span>
        </td></tr>
        <tr><td style="padding:36px;">
          <p style="color:rgba(255,255,255,0.5);font-size:14px;margin:0 0 8px;">{greeting}</p>
          <h2 style="color:#fff;font-size:22px;margin:0 0 20px;">You've been invited to a project</h2>
          <table width="100%" style="background:rgba(255,107,43,0.06);border:1px solid rgba(255,107,43,0.15);border-radius:12px;margin-bottom:28px;">
            <tr><td style="padding:20px 24px;">
              <table>
                <tr>
                  <td style="padding:4px 0;color:rgba(255,255,255,0.35);font-size:13px;width:90px;">Project</td>
                  <td style="padding:4px 0;color:#fff;font-size:14px;font-weight:700;">{project_name}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;color:rgba(255,255,255,0.35);font-size:13px;">Invited by</td>
                  <td style="padding:4px 0;color:#FF8C5A;font-size:13px;">{inviter_nom}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;color:rgba(255,255,255,0.35);font-size:13px;">Your role</td>
                  <td style="padding:4px 0;color:#a78bfa;font-size:13px;font-weight:600;">{role}</td>
                </tr>
              </table>
            </td></tr>
          </table>
          {'<p style="color:rgba(255,255,255,0.4);font-size:13px;margin:0 0 20px;">You don\'t have an account yet. Create one to accept this invitation.</p>' if not registered else '<p style="color:rgba(255,255,255,0.4);font-size:13px;margin:0 0 20px;">You have been added to this project. Open your dashboard to start collaborating.</p>'}
          <a href="{action_url}" style="display:inline-block;background:linear-gradient(135deg,#FF6B2B,#e85d1e);color:#fff;font-weight:700;font-size:14px;text-decoration:none;padding:13px 32px;border-radius:10px;">{btn_label}</a>
        </td></tr>
        <tr><td style="padding:20px 36px;border-top:1px solid rgba(255,255,255,0.05);">
          <p style="color:rgba(255,255,255,0.2);font-size:12px;margin:0;text-align:center;">InvisiThreat · DevSecOps Platform</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""

    plain = (
        f"{greeting}\n\n"
        f"{inviter_nom} has invited you to join the project \"{project_name}\" as {role}.\n\n"
        f"{'Register at: ' if not registered else 'Open your dashboard: '}{action_url}\n\n"
        "— InvisiThreat"
    )
    return _send(invitee_email, subject, html, plain)
