import smtplib
from email.message import EmailMessage
from urllib.parse import urlencode

from app.config import settings


class EmailDeliveryError(Exception):
    pass


def send_password_reset_email(*, recipient: str, raw_token: str) -> None:
    reset_url = f"{settings.frontend_url.rstrip('/')}/forgot-password?{urlencode({'token': raw_token})}"
    message = EmailMessage()
    message["Subject"] = "Reset your AssetMX password"
    message["From"] = f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
    message["To"] = recipient
    message.set_content(
        "AssetMX password reset\n\n"
        "We received a request to reset the password for your AssetMX account.\n\n"
        f"Reset your password: {reset_url}\n\n"
        f"This link expires in {settings.password_reset_expire_minutes} minutes. "
        "If you did not request a password reset, "
        "you can safely ignore this email.\n"
    )

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
            smtp.starttls()
            smtp.login(settings.smtp_username, settings.smtp_password)
            smtp.send_message(message)
    except (OSError, smtplib.SMTPException) as exc:
        raise EmailDeliveryError from exc