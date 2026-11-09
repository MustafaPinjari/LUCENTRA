# Independent Verification & Crawler Algorithms — LUCENTRA

**Document ID:** LUC-WIT-004  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document details the crawling algorithm, asset fetching policies, and hash calculation pipeline implemented by autonomous witness daemons.

---

## 2. Crawler Execution Logic

```mermaid
flowchart TD
    Start[Scheduled Crawler Wakeup] --> QueryDomains[Query Active Registered Domains]
    QueryDomains --> LoopDomains[For Each Domain:]
    
    LoopDomains --> FetchManifest[Fetch Active Release Manifest & EAS UID]
    FetchManifest --> FetchHTML[Perform HTTP GET on Domain Root URL]
    FetchHTML --> ParseDOM[Parse HTML & Extract All Script Tags]
    
    ParseDOM --> FetchAssets[Download Declared Assets in Manifest]
    FetchAssets --> ComputeHashes[Calculate SHA-256 for Each Asset]
    
    ComputeHashes --> Compare[Cross-Check Live Hashes with Manifest Hashes]
    Compare --> CreateLog[Generate Signed Observation Record]
    CreateLog --> PostLog[Publish Observation to API / Gossip]
```

---

## 3. Crawler Anti-Cloaking & User-Agent Rotation

To prevent targeted web servers from identifying and serving sanitized code strictly to witness nodes:
1. **User-Agent Emulation:** Nodes rotate standard consumer browser User-Agent strings (e.g. Chrome on Windows, Safari on macOS, Chrome on Android).
2. **Accept Headers:** Emulates full standard browser accept headers (`Accept: text/html,application/xhtml+xml...`).
3. **Multi-Region Crawling:** Crawls originate from diverse VPS and residential proxy networks across multiple geographical autonomous systems (ASNs).

---

## 4. Related Documents

- [docs/10-witness-network/WITNESS_ARCHITECTURE.md](WITNESS_ARCHITECTURE.md)
- [docs/10-witness-network/CONFLICT_RESOLUTION.md](CONFLICT_RESOLUTION.md)

---

## 5. References

- [Web Scraping Architecture and Anti-Fingerprinting Techniques](https://curl.se/libcurl/)

