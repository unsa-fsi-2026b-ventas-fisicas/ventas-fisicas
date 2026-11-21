from decimal import Decimal

CATALOGO = {
    "ART001": {"descripcion": "Teclado", "disponible": 10},
    "ART002": {"descripcion": "Mouse", "disponible": 5},
}

class AlmacenNoDisponible(Exception):
    pass

def consultar_stock(codigo, modo="normal"):
    # MOCK: reemplazar cuando exista contrato y endpoint real de Almacén.
    if modo == "caido":
        raise AlmacenNoDisponible("Servicio simulado de Almacén no disponible")
    articulo = CATALOGO.get(codigo)
    if not articulo:
        return {"error": "ARTICULO_NO_ENCONTRADO", "disponible": 0}
    disponible = articulo["disponible"]
    if modo == "insuficiente":
        disponible = 1
    return {
        "ArtCod": codigo,
        "ArtDes": articulo["descripcion"],
        "StkCanDis": disponible,
    }
