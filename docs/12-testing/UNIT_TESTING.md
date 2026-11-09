# Unit Testing Guide — LUCENTRA

**Document ID:** LUC-TST-002  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document provides standards, conventions, and example test suites for unit testing across Python backend logic, TypeScript core utilities, and smart contracts.

---

## 2. Python Backend Unit Testing (`services/backend/tests/`)

```python
import pytest
from apps.registry.services import normalize_domain, generate_challenge_token

def test_domain_normalization_uts46():
    assert normalize_domain("EXAMPLE.COM.") == "example.com"
    assert normalize_domain("https://sub.test.org:8080/path") == "sub.test.org"

def test_challenge_token_entropy():
    token1 = generate_challenge_token()
    token2 = generate_challenge_token()
    assert len(token1) == 64
    assert token1 != token2
```

---

## 3. TypeScript Core Unit Testing (`packages/core/test/`)

```typescript
import { describe, it, expect } from "vitest";
import { canonicalizeManifest } from "../src/canonical";

describe("RFC 8785 Canonicalization", () => {
  it("sorts object keys lexicographically", () => {
    const input = { z: 1, a: 2, m: 3 };
    const expected = '{"a":2,"m":3,"z":1}';
    expect(canonicalizeManifest(input)).toBe(expected);
  });
});
```

---

## 4. Related Documents

- [docs/12-testing/TESTING_STRATEGY.md](TESTING_STRATEGY.md)
- [docs/12-testing/INTEGRATION_TESTING.md](INTEGRATION_TESTING.md)

---

## 5. References

- [Pytest Documentation](https://docs.pytest.org/)
- [Vitest Documentation](https://vitest.dev/)
