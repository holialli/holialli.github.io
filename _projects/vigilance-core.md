---
title: Vigilance Core
file_no: "002"
area: forensics
featured: true
summary: Carves around sixteen artifact types out of Windows disk images, flags anomalies, and answers investigator questions in plain English with every claim cited to its evidence.
description: A disk-image forensics tool that carves Windows artifacts, screens them for anomalies and answers questions with cited evidence, fully offline.
stack: Python, pytsk3, libewf, scikit-learn, FAISS, MiniLM, Ollama, Gradio
stack_short: Python, FAISS, Ollama
status: Working triage tool, not a validated forensic tool
proof: 156 tests, PDF case reports, results cached per image hash
proof_short: 156 tests
repos:
  - https://github.com/holialli/Vigilance-Core
---

## The problem

A single Windows disk image holds tens of thousands of artifacts: event logs, registry hives, prefetch, SRUM, USB history. Searching them by hand is slow, and putting an LLM on top creates a new problem: answers that sound right but aren't backed by anything in the evidence. For forensics, an answer you can't trace back to an artifact is worse than no answer.

## What I built

Upload a `.dd`, `.raw` or `.E01` image, and Vigilance Core carves it into one artifact table, screens that table for anomalies, indexes it, and lets an investigator ask questions in plain English. Every claim in an answer carries an inline citation like `[E1]` that resolves to the artifact it came from.

```
 .dd/.raw/.E01 ──▶ carve ──▶ score ──▶ index ──▶ retrieve ──▶ answer with citations
                     │         │         │           │
              ~16 extractors  Isolation FAISS    semantic + lexical
              via pytsk3 /    Forest +  over     + query→type routing
              pyewf           rules     MiniLM
```

The interface has three tabs: AI investigation, a dashboard with counts and a timeline, and the raw artifact table with search, triage findings and entity correlation. Cases can be saved, and a PDF report can be generated with the case metadata and evidence summary.

## Design decisions

- **Grounded, not generated from memory.** The model only sees retrieved artifacts and must cite them. If retrieval finds nothing relevant, it says so instead of filling the gap.
- **Two kinds of retrieval.** High-volume artifact types (event logs, registry) go into a FAISS vector index. Low-volume, high-value types (USB devices, browser history, prefetch, recycle bin) are searched lexically at query time, so a USB insertion can't get buried under tens of thousands of similar-looking registry keys.
- **The model doesn't get the last word on known-bad events.** An Isolation Forest scores behaviour (event ID, hour of day, events per minute), but known-bad event IDs such as audit-log clearing, account creation and brute-force logons are flagged by rule so they always surface.
- **Evidence stays on the machine.** The provider chain tries Ollama locally first, then optional cloud providers, then a deterministic offline summary. With Ollama, no artifact text leaves the examiner's computer.
- **Integrity.** The source image is hashed with SHA-256, and all results are cached under that hash. The cache is treated with the same care as the evidence itself, since it holds the carved contents.
- **Local use only.** The interface binds to localhost and has no authentication, so it's built to run on an examiner's own machine, not a shared server.

## Proof

- 156 tests (`python -m pytest tests/ -q`).
- Interrupted index builds resume from completed chunks rather than starting over.
- Re-uploading the same image skips carving entirely, using the cache keyed by its hash.

## What I'd change

- It isn't validated against NIST CFTT or a similar programme, so it's a triage aid, not something to base courtroom findings on alone.
- The shipped anomaly model was trained on a single disk image, and recycle-bin and recent-file artifacts are currently over-flagged. Retraining across more images is the fix.
- Extraction targets Windows. Linux and macOS images aren't meaningfully supported yet.
