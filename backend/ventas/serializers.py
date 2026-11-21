from rest_framework import serializers
from .models import Venta, DetalleVenta

class DetalleVentaSerializer(serializers.ModelSerializer):
    class Meta:
        model = DetalleVenta
        fields = ["articulo_codigo", "descripcion", "cantidad", "precio_unitario", "importe"]

class VentaSerializer(serializers.ModelSerializer):
    items = DetalleVentaSerializer(many=True, read_only=True)
    class Meta:
        model = Venta
        fields = ["id", "fecha", "cliente", "subtotal", "igv", "total", "estado", "solicitar_despacho", "items"]
