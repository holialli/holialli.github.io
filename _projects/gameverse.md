---
title: GameVerse
file_no: "003"
area: devsecops
featured: true
summary: A MERN gaming platform used as a DevSecOps testbed. Secret scanning, tests and dependency checks gate every deploy, container images are scanned with Trivy, and the live build is scanned with OWASP ZAP.
description: A MERN app with a scan-gated GitHub Actions pipeline, previously hosted on a Terraform-built EC2 instance behind Cloudflare with no SSH.
stack: React, Node/Express, MongoDB, Redis, GitHub Actions, Gitleaks, Snyk, Trivy, OWASP ZAP, Terraform, Cloudflare
stack_short: GitHub Actions, Terraform
status: Live at game-verse.tech (Render + Vercel)
proof: The pipeline runs on every app change pushed to main, and the deployed commit is verified before the ZAP scan
proof_short: Live site, pipeline
repos:
  - https://github.com/holialli/GameVerse
  - https://github.com/holialli/gameverse-infra
---

## The problem

I wanted a real application to practise shipping safely: something with authentication, websockets and a database, deployed for real, where the pipeline, not my memory, makes sure a leaked secret or a known-vulnerable dependency never reaches production.

## The pipeline

Every push to `main` that changes the app (including lockfiles) runs `.github/workflows/devsecops.yml`:

```
push ─▶ Gitleaks ─▶ tests ─▶ Snyk (API + frontend) ─▶ build images ─▶ Trivy
                                                                        │
       ZAP baseline ◀── /api/health reports the commit ◀── Render deploy hook
```

1. **Gitleaks** scans the repository for committed credentials.
2. The backend tests run, then **Snyk** checks both the API and frontend dependencies and fails the build on critical CVEs.
3. Both Docker images are built and scanned with **Trivy** before they're pushed. A critical CVE that has a fix available fails the build; high-severity findings are reported. The gate failed on its first run: the npm that ships inside the `node:20-alpine` base image bundled a `node-tar` with a critical CVE. Neither container runs npm, so the images now delete it after their last install. That also removed the high-severity findings that came from npm's other bundled packages.
4. Only then does the workflow call Render's deploy hook, for the exact commit that was scanned. Render's own auto-deploy is turned off, so nothing skips the gates.
5. The workflow waits until `/api/health` reports that commit, then runs an **OWASP ZAP** baseline scan against the live build.

## Application security

- JWT refresh-token rotation backed by Redis, with replay rejection, in HTTP-only cookies.
- Express rate limiting and request validation against automated and brute-force traffic.
- One CORS allowlist shared by the REST API and Socket.IO, so the two can't drift apart.
- Secrets live in the host's environment and in GitHub Actions secrets. Nothing is baked into images.

## Infrastructure, March to September 2026

For six months the whole stack ran on one EC2 instance, built with Terraform in [gameverse-infra](https://github.com/holialli/gameverse-infra):

- **No SSH.** The first version allowed SSH from my own IP with a key pair. I replaced that with AWS Systems Manager: port 22 closed, no key pair attached, and access and deploys through SSM, so there were no static SSH keys to leak or rotate.
- **Origin reachable only through Cloudflare.** The security group was generated from Cloudflare's published IP ranges, so traffic that tried to bypass Cloudflare's WAF and DDoS protection was dropped at AWS.
- **Least-privilege instance role** with only the SSM managed policy.

In September 2026 the AWS free plan ended, so the API moved to Render and the frontend to Vercel.

## What I'd change

In the pipeline:

- Consider failing on high-severity dependency CVEs too, not only critical.

In the Terraform, looking back:

- Require IMDSv2 and encrypt the root EBS volume.
- Restrict outbound traffic, which was open to the internet.
- Keep Terraform state in S3 with locking instead of on my machine.
- Scan the Terraform itself with Checkov or tfsec in CI, the same way the app code is scanned.
