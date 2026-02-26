#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Atlas Full Session — 2026-02-18
Saved transcript / definition baseline.

This file exists to prevent drift.
It defines what Atlas is and what we are building.
"""

# ATLAS — Definition (baseline)

## What Atlas is
Atlas is an external-facing SaaS for FUZE that centralizes fabrics, submissions, and lab testing into one canonical system of record.

It must:
- ingest legacy exports (CSV)
- support manual entry (one-by-one) for fabrics, submissions, and tests
- link tests to fabrics/submissions when a match exists
- allow review of all testing when no match exists
- provide fast search + filtering for operations

## Core objects
- Fabric (canonical fabric record)
- FabricSubmission (FUZE fabric number, customer/factory codes, method, date, wash target, status flags)
- TestRun (ICP / Antibacterial / Fungal / Odor / Other)
- Results (ICP result values, pass/fail where applicable)
- Documents (reports, images, submissions)

## MVP user flows
1) Browse/search fabrics
2) Open fabric detail
3) View submissions for that fabric
4) View tests linked to that submission
5) Create new fabric + submission manually
6) Create new tests manually and link them to the submission (or leave unlinked)
7) Upload test report documents and attach to tests/submissions

## Principles
- Next.js app router only (no pages router)
- Prisma/Postgres as canonical backend
- Everything is linkable; nothing is lost
- Keep raw source data in JSON for traceability

