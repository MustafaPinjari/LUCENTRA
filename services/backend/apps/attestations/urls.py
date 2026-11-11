from rest_framework.routers import DefaultRouter
from .views import AttestationViewSet

router = DefaultRouter()
router.register(r"", AttestationViewSet, basename="attestation")

urlpatterns = router.urls
