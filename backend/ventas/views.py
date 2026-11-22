from decimal import Decimal, ROUND_HALF_UP
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from .models import Venta, DetalleVenta
from .serializers import VentaSerializer
from .stock_mock import consultar_stock, AlmacenNoDisponible

IGV_REFERENCIAL = Decimal("0.18")

@api_view(["GET"])
def stock(request, codigo):
    modo = request.headers.get("X-Mock-Stock-Mode", "normal")
    try:
        data = consultar_stock(codigo, modo)
    except AlmacenNoDisponible as exc:
        return Response({"error": "ALMACEN_NO_DISPONIBLE", "detalle": str(exc)}, status=503)
    if "error" in data:
        return Response(data, status=404)
    return Response(data)

@api_view(["GET", "POST"])
def ventas(request):
    if request.method == "GET":
        return Response(VentaSerializer(Venta.objects.all().order_by("-id"), many=True).data)

    data = request.data
    items = data.get("items", [])
    if not items:
        return Response({"error": "La venta debe tener al menos un artículo"}, status=400)

    modo = request.headers.get("X-Mock-Stock-Mode", "normal")
    subtotal = Decimal("0.00")
    lineas = []
    for item in items:
        try:
            cantidad = int(item["cantidad"])
            precio = Decimal(str(item["precio_unitario"]))
            codigo = str(item["articulo_codigo"])
            descripcion = str(item.get("descripcion", codigo))
        except (KeyError, ValueError, TypeError):
            return Response({"error": "Detalle de artículo inválido"}, status=400)
        if cantidad <= 0 or precio < 0:
            return Response({"error": "Cantidad y precio deben ser válidos"}, status=400)
        try:
            stock_data = consultar_stock(codigo, modo)
        except AlmacenNoDisponible as exc:
            return Response({"error": "ALMACEN_NO_DISPONIBLE", "detalle": str(exc),
                             "venta_confirmada": False}, status=503)
        disponible = stock_data.get("StkCanDis", 0)
        if cantidad > disponible:
            return Response({"error": "STOCK_INSUFICIENTE", "ArtCod": codigo,
                             "StkCanDis": disponible, "venta_confirmada": False}, status=409)
        importe = (precio * cantidad).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        subtotal += importe
        lineas.append((codigo, descripcion, cantidad, precio, importe))

    subtotal = subtotal.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    igv = (subtotal * IGV_REFERENCIAL).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    total = subtotal + igv

    venta = Venta.objects.create(
        cliente=data.get("cliente") or "Cliente de mostrador",
        subtotal=subtotal, igv=igv, total=total,
        solicitar_despacho=bool(data.get("solicitar_despacho", False)),
        estado="CONFIRMADA",
    )
    for codigo, descripcion, cantidad, precio, importe in lineas:
        DetalleVenta.objects.create(venta=venta, articulo_codigo=codigo,
            descripcion=descripcion, cantidad=cantidad,
            precio_unitario=precio, importe=importe)

    respuesta = VentaSerializer(venta).data
    respuesta["nota_integracion"] = (
        "Despacho pendiente de integración con Distribución"
        if venta.solicitar_despacho else
        "No se solicitó despacho"
    )
    respuesta["nota_stock"] = "Stock consultado mediante MOCK; no se registró movimiento real en Almacén."
    return Response(respuesta, status=status.HTTP_201_CREATED)
