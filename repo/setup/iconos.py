"""Genera los iconos PNG del panel (sin dependencias). Uso: python setup/iconos.py"""
import zlib
import struct
from pathlib import Path

PUNTOS = [(8, 32), (16, 22), (23, 27), (31, 14), (40, 23)]  # misma línea que icon.svg (lienzo 48)
FONDO, LINEA = (15, 118, 110), (255, 255, 255)


def dist_segmento(px, py, a, b):
    (x1, y1), (x2, y2) = a, b
    dx, dy = x2 - x1, y2 - y1
    t = max(0, min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)))
    return ((px - x1 - t * dx) ** 2 + (py - y1 - t * dy) ** 2) ** 0.5


def png(n, ruta):
    esc = n / 48
    filas = []
    for y in range(n):
        fila = bytearray([0])
        for x in range(n):
            px, py = (x + 0.5) / esc, (y + 0.5) / esc
            d = min(dist_segmento(px, py, PUNTOS[i], PUNTOS[i + 1]) for i in range(len(PUNTOS) - 1))
            a = max(0.0, min(1.0, (2.0 - d) * esc + 0.5))  # trazo de 4 px con borde suavizado
            fila += bytes(round(FONDO[c] * (1 - a) + LINEA[c] * a) for c in range(3))
        filas.append(bytes(fila))
    raw = zlib.compress(b''.join(filas), 9)
    chunk = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    Path(ruta).write_bytes(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', n, n, 8, 2, 0, 0, 0))
                          + chunk(b'IDAT', raw) + chunk(b'IEND', b''))


if __name__ == '__main__':
    site = Path(__file__).resolve().parent.parent / 'site'
    for n in (180, 192, 512):
        png(n, site / f'icon-{n}.png')
    print('iconos generados')
