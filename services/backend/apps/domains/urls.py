from rest_framework.routers import DefaultRouter
from .views import DomainViewSet

router = DefaultRouter()
router.register(r"", DomainViewSet, basename="domain")

urlpatterns = router.urls
