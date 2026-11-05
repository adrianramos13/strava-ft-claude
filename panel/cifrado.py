"""Cifrado AES-GCM con clave derivada de una contraseña (PBKDF2-SHA256).

El formato es compatible con WebCrypto, así que el panel lo descifra en el navegador.
"""
import os
import json
import base64

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

ITER = 310_000


def _clave(password, salt, iteraciones=ITER):
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=iteraciones)
    return kdf.derive(password.encode('utf-8'))


def cifrar(obj, password):
    salt, iv = os.urandom(16), os.urandom(12)
    datos = json.dumps(obj, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    ct = AESGCM(_clave(password, salt)).encrypt(iv, datos, None)
    b64 = lambda b: base64.b64encode(b).decode('ascii')
    return {'v': 1, 'iter': ITER, 'salt': b64(salt), 'iv': b64(iv), 'ct': b64(ct)}


def descifrar(sobre, password):
    d = lambda k: base64.b64decode(sobre[k])
    datos = AESGCM(_clave(password, d('salt'), sobre['iter'])).decrypt(d('iv'), d('ct'), None)
    return json.loads(datos)
