# MWHEBA 2.0 | Project Root Documentation

This folder contains the root-level Markdown source of truth for planning the full MWHEBA website rebuild and integrated B2B store.

## Files
- `AGENTS.md`: mandatory agent behavior and first task.
- `PROJECT_SPEC.md`: business goals, features and constraints.
- `ARCHITECTURE.md`: conditional technical architecture and boundaries.
- `DATA_MODEL.md`: conceptual entities and invariants.
- `IMPLEMENTATION_ROADMAP.md`: execution phases and expected plan outputs.
- `QUALITY_GATES.md`: acceptance criteria and launch gates.
- `DECISIONS.md`: confirmed and unresolved decisions.

## How to use in Google Antigravity
1. Copy **all eight `.md` files** into the repository root.
2. Open the repository in Antigravity.
3. Start a new agent conversation and paste:

> Read `AGENTS.md` first, then read all referenced root Markdown files. Work in PLAN ONLY mode. Inspect the repository read-only, then create the detailed phase plans under `plans/` exactly as instructed. Start with the master plan and blocking Payload Ecommerce POC. Do not install dependencies, write application code, or modify existing files outside `plans/` until I approve.

4. Review `plans/00-master-plan.md` and `plans/02-commerce-feasibility-poc.md` before allowing implementation.

## Important
The chosen stack is a **preferred candidate, not a proven implementation**. Payload Ecommerce must pass the feasibility POC before production development.
