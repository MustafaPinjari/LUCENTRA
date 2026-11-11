"""URL configuration for LUCENTRA backend."""

from django.urls import path, include
from .views import HealthView, ReadinessView

urlpatterns = [
    # Health and Readiness
    path("api/v1/health/", HealthView.as_view(), name="health"),
    path("api/v1/readiness/", ReadinessView.as_view(), name="readiness"),

    # REST APIs
    path("api/v1/publishers/", include("apps.publishers.urls")),
    path("api/v1/domains/", include("apps.domains.urls")),
    path("api/v1/releases/", include("apps.releases.urls")),
    path("api/v1/attestations/", include("apps.attestations.urls")),
]
