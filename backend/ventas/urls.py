from django.urls import path
from . import views

urlpatterns = [
    path("stock/<str:codigo>/", views.stock, name="stock"),
    path("ventas/", views.ventas, name="ventas"),
]
