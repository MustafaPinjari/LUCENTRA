from django.urls import path
from .views import ExplanationView, DomainExplanationView

app_name = "ai"

urlpatterns = [
    path("explanations/", ExplanationView.as_view(), name="explanation-create"),
    path("domains/<str:domain>/explain/", DomainExplanationView.as_view(), name="domain-explain"),
]

