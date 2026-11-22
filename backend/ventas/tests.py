from django.test import SimpleTestCase, override_settings
from rest_framework.test import APIClient
from .stock_mock import consultar_stock, AlmacenNoDisponible


class StockMockTests(SimpleTestCase):
    """Pruebas unitarias para el servicio simulado de stock (stock_mock)."""

    def test_stock_articulo_conocido(self):
        """Verifica la consulta exitosa de un artículo conocido (modo normal por defecto)."""
        data = consultar_stock("ART001")
        self.assertEqual(data["ArtCod"], "ART001")
        self.assertEqual(data["ArtDes"], "Teclado")
        self.assertEqual(data["StkCanDis"], 10)

    def test_stock_insuficiente_simulado(self):
        """Verifica que el modo insuficiente reduzca la cantidad disponible a 1."""
        data = consultar_stock("ART001", "insuficiente")
        self.assertEqual(data["ArtCod"], "ART001")
        self.assertEqual(data["ArtDes"], "Teclado")
        self.assertEqual(data["StkCanDis"], 1)

    def test_stock_otro_articulo_conocido(self):
        """Verifica la consulta de otro artículo registrado en el catálogo."""
        data = consultar_stock("ART002")
        self.assertEqual(data["ArtCod"], "ART002")
        self.assertEqual(data["ArtDes"], "Mouse")
        self.assertEqual(data["StkCanDis"], 5)

    def test_stock_modo_normal_explicito(self):
        """Verifica que indicar explícitamente modo='normal' retorne el stock completo."""
        data = consultar_stock("ART001", modo="normal")
        self.assertEqual(data["StkCanDis"], 10)

    def test_stock_articulo_no_encontrado(self):
        """Verifica que un artículo inexistente retorne el error esperado y stock 0."""
        data = consultar_stock("ART999")
        self.assertEqual(data, {"error": "ARTICULO_NO_ENCONTRADO", "disponible": 0})

    def test_stock_articulo_no_encontrado_modo_insuficiente(self):
        """Verifica que un artículo inexistente retorne error aún con modo insuficiente."""
        data = consultar_stock("ART999", modo="insuficiente")
        self.assertEqual(data, {"error": "ARTICULO_NO_ENCONTRADO", "disponible": 0})

    def test_stock_almacen_caido_lanza_excepcion(self):
        """Verifica que el modo caido lance la excepción AlmacenNoDisponible con su mensaje."""
        with self.assertRaises(AlmacenNoDisponible) as ctx:
            consultar_stock("ART001", modo="caido")
        self.assertIn("Servicio simulado de Almacén no disponible", str(ctx.exception))


@override_settings(ALLOWED_HOSTS=["testserver", "localhost", "127.0.0.1"])
class StockApiTests(SimpleTestCase):
    """Pruebas de integración de la API para el endpoint de consulta de stock."""

    def setUp(self):
        self.client = APIClient()

    def test_api_stock_articulo_conocido(self):
        """GET /api/stock/<codigo>/ retorna 200 y los datos del artículo."""
        response = self.client.get("/api/stock/ART001/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["ArtCod"], "ART001")
        self.assertEqual(response.data["ArtDes"], "Teclado")
        self.assertEqual(response.data["StkCanDis"], 10)

    def test_api_stock_articulo_no_encontrado(self):
        """GET /api/stock/<codigo>/ retorna 404 cuando el artículo no existe."""
        response = self.client.get("/api/stock/ART999/")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.data["error"], "ARTICULO_NO_ENCONTRADO")

    def test_api_stock_modo_insuficiente(self):
        """GET /api/stock/<codigo>/ con cabecera X-Mock-Stock-Mode: insuficiente."""
        response = self.client.get("/api/stock/ART001/", HTTP_X_MOCK_STOCK_MODE="insuficiente")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["StkCanDis"], 1)

    def test_api_stock_modo_almacen_caido(self):
        """GET /api/stock/<codigo>/ con cabecera X-Mock-Stock-Mode: caido retorna 503."""
        response = self.client.get("/api/stock/ART001/", HTTP_X_MOCK_STOCK_MODE="caido")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data["error"], "ALMACEN_NO_DISPONIBLE")
        self.assertIn("detalle", response.data)
