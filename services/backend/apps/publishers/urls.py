from rest_framework.routers import DefaultRouter
from .views import PublisherViewSet

router = DefaultRouter()
router.register(r"", PublisherViewSet, basename="publisher")

urlpatterns = router.urls
