# Integration Testing Guide — LUCENTRA

**Document ID:** LUC-TST-003  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document outlines the integration test architecture connecting the Django REST Framework API, PostgreSQL database, Redis cache, and simulated EVM blockchain nodes.

---

## 2. API Integration Testing (`services/backend/tests/integration/`)

Using `pytest-django` and `rest_framework.test.APIClient`:

```python
import pytest
from rest_framework import status
from apps.registry.models import Domain

@pytest.mark.django_db
def test_domain_challenge_lifecycle(api_client):
    # 1. Request Challenge
    response = api_client.post("/api/v1/domains/challenge/", {"domain": "uniswap.org"})
    assert response.status_code == status.HTTP_201_CREATED
    assert "challengeValue" in response.data
    
    # 2. Check Database Record
    domain = Domain.objects.get(normalized_name="uniswap.org")
    assert not domain.is_dns_verified
```

---

## 3. Related Documents

- [docs/12-testing/TESTING_STRATEGY.md](TESTING_STRATEGY.md)
- [docs/12-testing/CONTRACT_TESTING.md](CONTRACT_TESTING.md)

---

## 4. References

- [Django REST Framework Testing](https://www.django-rest-framework.org/api-guide/testing/)

