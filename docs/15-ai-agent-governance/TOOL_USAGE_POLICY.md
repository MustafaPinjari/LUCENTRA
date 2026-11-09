# Tool Usage Policy — LUCENTRA

**Document ID:** LUC-GOV-006  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document regulates the usage of execution tools (shell execution, file editing, web search, MCP tools) by AI engineering agents to ensure safety, efficiency, and sandboxing compliance.

---

## 2. Tool Usage Constraints

1. **Prefer Standard Sandbox Mode:** Always execute commands inside standard sandbox mode first. Only request sandbox bypass when external networking or port binding is strictly required.
2. **Surgical File Edits:** Use targeted file editing tools (`edit_file`) for contiguous code modifications rather than rewriting entire large source files.
3. **No Speculative Search Loops:** Do not launch open-ended recursive web searches or file grep loops. Target specific file paths and known symbols.
4. **No Destructive Commands:** Destructive shell commands (`rm -rf`, `git reset --hard`, `DROP TABLE`) are strictly prohibited unless explicit human architectural approval is documented.

---

## 3. Related Documents

- [docs/15-ai-agent-governance/RESOURCE_OPTIMIZATION.md](RESOURCE_OPTIMIZATION.md)
- [docs/15-ai-agent-governance/CODE_CHANGE_POLICY.md](CODE_CHANGE_POLICY.md)
