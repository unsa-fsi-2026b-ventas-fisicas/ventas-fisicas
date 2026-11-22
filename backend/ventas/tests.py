from django.test import TestCase
from .stock_mock import consultar_stock

class StockMockTests(TestCase):
    def test_stock_articulo_conocido(self):
        data = consultar_stock("ART001")
        self.assertEqual(data["StkCanDis"], 10)

    def test_stock_insuficiente_simulado(self):
        data = consultar_stock("ART001", "insuficiente")
        self.assertEqual(data["StkCanDis"], 1)
