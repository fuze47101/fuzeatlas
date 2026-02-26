# ATLAS INFRASTRUCTURE BUILD DAY 1

## Overview

This document outlines the initial infrastructure build for the ATLAS SaaS platform, reflecting the 2026-02-18 architecture spec and implementing governance rules for a Next.js App Router SaaS architecture.

---

## Infrastructure Foundations

### 1. Cloud Provider
- **Primary:** AWS (Amazon Web Services)
- **Regions:** Multi-region readiness, deploy starting in `us-east-1`
- **Governance:** Infrastructure as Code (IaC) using Terraform (version-locked)

### 2. Networking
- **VPC Isolation:** Isolate environments using VPCs (dev, staging, prod)
- **Subnets:** Public/private, segregated by function (app, db, services)
- **WAF:** AWS WAF to protect edge endpoints
- **Security:** Security Groups & NACLs follow least privilege

### 3. Compute
- **App Hosting:**
  - Next.js deployed with App Router (>= v13), serverless-first
  - **Framework:** Vercel (primary), fallback AWS Amplify for redundancy
- **Workers:** Lambda functions for non-blocking async/background jobs
- **Scaling:** Auto-scaling based on request load

### 4. Storage & Data
- **Primary DB:** AWS RDS PostgreSQL, multi-AZ
- **Object Storage:** S3 buckets per-environment, prefix governance enforced
- **Caching:** AWS ElastiCache (Redis), used only for caching, not persistence
- **Backups:** Automated nightly snapshots, 35-day retention

### 5. SaaS Multi-tenancy
- **Approach:** Schema-per-tenant in PostgreSQL (recommended) OR row-level RBAC enforced by platform service
- **Routing:** Subdomain isolation (`tenant.fuzeatlas.com`), using CloudFront + Route53
- **Governance:** No direct DB access; all through API layer

### 6. Identity & Security
- **Auth:** Auth0 or AWS Cognito, SSO (SAML/OAuth2)
- **Secrets:** Managed via AWS Secrets Manager
- **CI/CD:** GitHub Actions, required PR reviews, branch protection, limited access
- **Encryption:** All data encrypted at rest and in transit (TLS 1.2+)

### 7. Next.js SaaS Governance Rules
- **App Router Only:** Only `/app` directory allowed for routing, no `/pages`
- **Domain Isolation:** Per-tenant domain/subdomain enforcement via middleware
- **No SSR Leakage:** Each request is tenant-isolated, no data leakage possible
- **Rate Limiting:** Per-tenant, via middleware at the edge (Vercel/AWS Lambda@Edge)
- **Feature Flags:** Rollout via LaunchDarkly or Segment, never hardcoded
- **Environment Variables:** Prefixed, immutable at runtime

### 8. Monitoring & Observability
- **Logging:** Structured JSON logs, centralized to AWS CloudWatch
- **Tracing:** Distributed tracing with OpenTelemetry
- **Alerting:** PagerDuty or OpsGenie integration for on-call
- **Audit:** All config & runtime changes tracked

### 9. Compliance
- **PII Segregation:** PII stored only in encrypted, access-limited storage
- **Compliance Ready:** SOC2, GDPR, HIPAA controls flagged in IaC
- **PenTest:** Initial assessment by approved vendor within 90 days

---

## Day 1 Deliverables
1. VPCs, subnets, security groups (Terraform)
2. Next.js (App Router) baseline app, deployed to Vercel
3. Subdomain routing and baseline tenant isolation
4. RDS/PostgreSQL instance, schema-per-tenant governance scaffolded
5. S3 buckets provisioned per-environment
6. Initial Auth0/AWS Cognito tenant
7. CI/CD pipeline running with protected master/main branch
8. Logging, monitoring agents, and basic alerts

---

## Governance Checklist (Day 1)
- [x] Next.js App Router enabled; `/app` directory only
- [x] No direct DB or file storage access from client
- [x] Every environment isolated (VPC, S3, RDS)
- [x] CI/CD and secrets managed by principle of least privilege
- [x] SaaS best practices embedded in infra code
