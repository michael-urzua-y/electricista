"""
Utilidad para encriptar/desencriptar campos sensibles usando Fernet (AES-128-CBC).
La clave se deriva del SECRET_KEY de Django.
"""
import base64
import hashlib

from cryptography.fernet import Fernet
from django.conf import settings


def _get_fernet():
    """Genera una instancia de Fernet usando el SECRET_KEY de Django como base."""
    # Derivar una clave de 32 bytes desde SECRET_KEY
    key = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
    fernet_key = base64.urlsafe_b64encode(key)
    return Fernet(fernet_key)


def encrypt_value(plain_text: str) -> str:
    """Encripta un string y retorna el texto cifrado en base64."""
    if not plain_text:
        return ''
    f = _get_fernet()
    return f.encrypt(plain_text.encode()).decode()


def decrypt_value(encrypted_text: str) -> str:
    """Desencripta un string cifrado con Fernet."""
    if not encrypted_text:
        return ''
    f = _get_fernet()
    return f.decrypt(encrypted_text.encode()).decode()
