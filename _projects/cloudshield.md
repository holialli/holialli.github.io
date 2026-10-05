---
title: CloudShield
file_no: "004"
area: cloud
featured: false
summary: A read-only AWS posture scanner with CIS-mapped IAM, S3 and EC2 checks across every enabled region, PDF and JSON reports, and remediation you have to opt into twice.
description: A Python CSPM tool for AWS with CIS-mapped checks, multi-region scanning, CI gating and opt-in remediation.
stack: Python, boto3, GitHub Actions
stack_short: Python, boto3
status: Working tool
proof: Exit codes and thresholds for CI gating, PDF and JSON reports, suppressions with expiry
proof_short: CI gate, reports
repos:
  - https://github.com/holialli/cloudshield
---

## The problem

Many cloud incidents start with a misconfiguration rather than an exploit: a public bucket, a security group open to the world, an access key nobody has rotated in a year. AWS has the data to spot them, but it's spread across services and regions. I wanted one scan that checks the common ones, explains them in a report, and can fail a pipeline, without being able to break the account it's auditing.

## What it checks

- **IAM:** root account MFA (CIS 1.5), access keys older than 90 days with inactive keys graded lower (CIS 1.14), and over-permissive policies on customer-managed policies, roles, users and groups (CIS 1.16).
- **S3:** account- and bucket-level Public Access Block, public bucket ACLs and public bucket policies. Per-bucket calls go to each bucket's own region.
- **EC2,** in every region: security groups exposing SSH or RDP to the internet (by port-range containment, so a 0–65535 rule counts), all-protocol ingress, a non-empty default security group (CIS 5.4), IMDSv2 enforcement (CIS 5.6), EBS encryption (CIS 2.2.1) and instances with public IPs.

Policy findings are graded rather than flagged all the same: `Allow *:*` is High; a service wildcard such as `s3:*`, a bare `Resource: "*"`, a `NotAction` grant, or an admin grant narrowed only by a `Condition` is Medium. `Deny` statements are never findings, because they're guardrails. AWS service-linked roles are recorded as exceptions, not failures.

## Safety decisions

- **Scanning is read-only.** The `SecurityAudit` policy covers it.
- **Remediation is opt-in twice.** `--remediate` means execute rather than plan, and `--allow` names the specific checks you're authorising. Fixes that can break a working workload, like revoking ingress or disabling a credential, are marked destructive.
- **No shell.** Everything goes through boto3, and no resource identifier is ever interpolated into a shell command.
- **Accepted risk is recorded, not hidden.** Suppressions need a reason and an expiry date. Suppressed checks still appear in the report, and expired suppressions come back as warnings.
- **Long scans don't die halfway.** When it assumes an audit role, the session uses refreshable credentials, so a multi-region scan survives the one-hour STS expiry.
- **Reports are treated as sensitive.** The PDF and JSON contain real account IDs and ARNs, so they're gitignored.

## Proof

It's built to gate a pipeline: `--fail-on high` or `--min-score 80` turns findings into an exit code (`0` clean, `1` gate breached, `2` scan couldn't run). The README includes a GitHub Actions workflow that scans every region daily and on pull requests, fails on High findings, and uploads the report even when the gate fails.

The 0–100 risk score discounts and caps repeated failures of the same check, so one bad control across hundreds of resources can't zero the score on its own.

## What I'd change

- Coverage is IAM, S3 and EC2 for now. RDS, KMS and CloudTrail checks would be the next additions.
