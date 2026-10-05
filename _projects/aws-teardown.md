---
title: aws-teardown
file_no: "001"
area: cloud
featured: true
summary: Finds the AWS resources a tutorial left running, in every region, with a monthly cost for each and delete commands in an order that works.
description: A read-only CLI that finds AWS resources left running after a tutorial, estimates what they cost, and prints delete commands in a working order.
stack: Python, boto3, moto, GitHub Actions
stack_short: Python, boto3
status: Released on GitHub (PyPI release pending)
proof: 27 tests against moto, CI on Python 3.9, 3.12 and 3.13, and a demo that runs without an AWS account
proof_short: 27 tests, CI
repos:
  - https://github.com/holialli/aws-teardown
---

## The problem

AWS tutorials create things that bill by the hour: NAT gateways, load balancers, EKS control planes, public IPv4 addresses. Closing the browser tab doesn't stop any of it, and the console shows resources one service and one region at a time. Nothing answers the question a student actually has after a tutorial: *what did that just create, and what is it costing me?*

## What I built

A command-line tool with three commands:

```
aws-teardown scan        # everything billable, most expensive first
aws-teardown snapshot    # record what exists before a tutorial
aws-teardown diff        # show only what was created since the snapshot
```

`snapshot` before a tutorial and `diff` after it is the part none of the similar tools I looked at do. You get a teardown list for that tutorial alone, instead of working out which resources are yours and which are its.

## How it works

- Every enabled region is scanned in parallel. Each resource type is one scanner function: EC2 instances, EBS volumes and snapshots, Elastic IPs, NAT gateways, interface VPC endpoints, load balancers, RDS, EKS, Secrets Manager, KMS keys and SageMaker.
- Each finding carries a monthly estimate (us-east-1 on-demand prices over 730 hours) and the AWS CLI command to delete it.
- Delete commands come out in an order that works: instances before the volumes they hold, the NAT gateway before its Elastic IP. Root volumes that are deleted with their instance don't get a separate command.
- `--fail-over 5` exits with code 2 when the estimate is above $5 a month, so it can run in cron or a scheduled GitHub Action.

Output from the demo after a typical VPC tutorial (region column and some notes trimmed to fit):

```
Created since snapshot of 2026-10-05T16:10:31+00:00:

~$/MONTH  TYPE          RESOURCE                            NOTES
$32.85    nat-gateway   nat-ba1abd1a716d7e74d (tutorial-nat) plus $0.045/GB processed
$30.37    ec2-instance  i-047061e3670b6d10a (tutorial-web)   t3.medium, running
$3.65     elastic-ip    eipalloc-641243cafa70fe7e9           release it after deleting the NAT gateway
$1.60     ebs-volume    vol-fff37bd1c63919ed1                20 GiB gp3, UNATTACHED
$0.80     ebs-volume    vol-b72fe61a40783a66f                8 GiB gp2, root volume (deleted with the instance)
$0.40     secret        tutorial-db-password                 Secrets Manager secret

6 resource(s), roughly $69.67/month.
```

## Security decisions

- **Read-only by design.** Every call is a `Describe*` or `List*`, so AWS's managed `ReadOnlyAccess` or `ViewOnlyAccess` policy is enough. It never deletes anything; it prints commands for a person to read and run.
- **No false "all clear".** If a call is denied or fails, the report says what couldn't be checked instead of implying the account is clean.
- **Minimal local state.** The snapshot file stores resource IDs only, nothing else about the account.

## Proof

- 27 tests, all against [moto](https://github.com/getmoto/moto), a community library that mocks AWS.
- CI runs lint, format checks and the tests on Python 3.9, 3.12 and 3.13.
- `examples/try_without_aws.py` starts a local moto server, creates a "tutorial", and runs `snapshot` → `diff` → `scan`, so anyone can try it without an account.

## What I'd change

- It has only been tested against moto so far. Moto is close to AWS but not identical, so real-account reports are the next step.
- Prices are us-east-1 estimates. Region-specific pricing would make the totals closer to a real bill outside us-east-1.
