---
title: SOC Lab
file_no: "005"
area: detection
featured: false
summary: A VirtualBox SOC with an inline Suricata IDS and 30 hand-written rules, attacked from Kali and investigated in Kibana.
description: A Suricata + ELK lab with 30 custom detection rules, tested against Nmap, Hydra and Metasploit from Kali.
stack: Suricata 7, Filebeat, Elasticsearch, Kibana, VirtualBox, Kali, Metasploitable2
stack_short: Suricata, ELK
status: Lab project (August 2025), revisited in 2026
proof: Kibana dashboards from the lab, a project report, and the rules on GitHub
proof_short: Dashboards, report
repos:
  - https://github.com/holialli/soc-lab-suricata-elk
---

## The setup

Three VMs on one VirtualBox internal network, with the IDS placed inline so every packet between attacker and victim passes through it:

```
Kali (attacker) ──▶ IDS VM (Suricata) ──▶ Metasploitable2 (victim)
                         │
                    eve.json
                         │
                     Filebeat ──▶ Elasticsearch ──▶ Kibana
```

Suricata writes EVE JSON, Filebeat ships it into Elasticsearch, and the Filebeat Suricata module provides the Events and Alerts dashboards.

## The rules

I wrote 30 rules across ten categories: reconnaissance (ICMP sweeps, Nmap SYN scans), exploitation (command injection, SQL injection, XSS, EternalBlue), SSH and RDP brute force, cleartext credentials (FTP, HTTP Basic), malware and C2 indicators, exfiltration, suspicious file transfers, persistence (`schtasks`, `reg add`, `wmic`), phishing, and lateral movement over SMB and DCOM.

## What I ran, and what fired

From Kali I ran an Nmap scan, a Hydra brute force against SSH, and Metasploit exploits against the victim. The events dashboard counted 1,185 events in one 15-minute window, and the alert dashboard showed the reverse-shell, ICMP and SSH brute-force rules firing.

<figure>
  <img src="{{ '/assets/img/soc-alert-overview.webp' | relative_url }}" alt="Kibana Filebeat Suricata Alert Overview: alerts per 30 seconds from the Kali host, and a table of top alert signatures listing Reverse Shell Pattern Detected 17 times, ICMP Ping to Victim twice and SSH Brute Force twice." width="1600" height="537" loading="lazy">
  <figcaption>Alert overview from the lab, 31 August 2025.</figcaption>
</figure>

<figure>
  <img src="{{ '/assets/img/soc-events-overview.webp' | relative_url }}" alt="Kibana Filebeat Suricata Events Overview showing 1,185 events and a stacked bar chart of activity types over time: mostly flow events, with ssh, sip, tftp, snmp and anomaly events." width="1600" height="537" loading="lazy">
  <figcaption>Event overview for the same session.</figcaption>
</figure>

## Reading the results honestly

Looking back, the alert counts say as much about the rules as about the attacks:

- **SSH Brute Force fired twice.** `threshold: type both` allows at most one alert per source per minute, so two alerts means the attack ran into a second minute. But the rule counts *packets* to port 22, not connection attempts, so a single normal login would trip it too. I wrote that up in [My Suricata SSH brute-force rule worked for the wrong reason]({{ '/writing/suricata-ssh-brute-force/' | relative_url }}).
- **Reverse Shell Pattern Detected fired 17 times**, but its pattern matches any three control bytes in a row, which almost any binary protocol produces. Most of those 17 are probably ordinary traffic, not shells.

## What I'd change

- Use SIDs in the 1,000,000 range. 2,000,000+ belongs to Emerging Threats and can clash with ET Open.
- Replace the victim IP hardcoded in every rule with `$HOME_NET`.
- Test every rule against a capture of normal traffic as well as the attack, so noisy rules (the per-packet SSH rule, the "any GET" scan rule, the "login in the URL" phishing rule) get caught before they reach a dashboard.
- Lean on ET Open for broad coverage and keep local rules for targeted cases. Content matches like `' OR 1=1 --` are easy to evade.
