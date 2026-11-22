from django.db import models

class Venta(models.Model):
    ESTADOS = [("CONFIRMADA", "Confirmada"), ("PENDIENTE", "Pendiente")]
    fecha = models.DateTimeField(auto_now_add=True)
    cliente = models.CharField(max_length=120, default="Cliente de mostrador")
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    igv = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    estado = models.CharField(max_length=20, choices=ESTADOS, default="CONFIRMADA")
    solicitar_despacho = models.BooleanField(default=False)

    def __str__(self):
        return f"Venta {self.id} - {self.estado}"

class DetalleVenta(models.Model):
    venta = models.ForeignKey(Venta, related_name="items", on_delete=models.CASCADE)
    articulo_codigo = models.CharField(max_length=30)
    descripcion = models.CharField(max_length=120)
    cantidad = models.PositiveIntegerField()
    precio_unitario = models.DecimalField(max_digits=10, decimal_places=2)
    importe = models.DecimalField(max_digits=10, decimal_places=2)
