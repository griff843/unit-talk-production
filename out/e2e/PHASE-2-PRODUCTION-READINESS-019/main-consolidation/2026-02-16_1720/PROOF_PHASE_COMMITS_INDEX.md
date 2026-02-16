# PROOF_PHASE_COMMITS_INDEX.md
Generated: 2026-02-16

## Summary
**Primary Feature Branch**: `feat/posting-authority-implement-001` (27 commits ahead of main)
**Unique Additional Branch**: `feat/alert-agent-v2-clean` (1 commit ahead - unique AlertAgent V2)

## Category: CLV / Scoring Tranches (ALL IN posting-authority)
| Commit | Title | In Main |
|--------|-------|---------|
| 3eb1fc6c | scoring(tranche-2): canonical TierScale + devig EV | NO |
| 295d6de4 | scoring(tranche-3): feature registry + unified V2 pipeline | NO |
| 60487d67 | scoring(tranche-4): fix validateWeights double-counting bug | NO |
| 37e6cd59 | scoring(tranche-6): canary routing + shadow drift logging | NO |
| 84c15194 | scoring(tranche-7): promotion policy bands + canary controls | NO |
| 640d0f33 | scoring(tranche-7-recal): V2 gate recalibration | NO |
| 79aa473f | scoring(tranche-7-recal): settlement scripts + proof artifacts | NO |
| 1b92774f | scoring(tranche-8): prod shadow monitoring + ops summaries | NO |
| 8940d00a | scoring(tranche-9): first-launch cutover (v2 default) | NO |
| bc5906b6 | scoring(tranche-10): enable HARD-only promotion (NBA canary) | NO |
| 6bdcb652 | scoring(tranche-10): posting governance — DiscordPromotionAgent | NO |

## Category: Settlement (ALL IN posting-authority)
| Commit | Title | In Main |
|--------|-------|---------|
| 9443a0e9 | Tranche 4: normalize scoring, SettlementAgent activation | NO |
| 74067dcf | SETTLEMENT-GUARD-SEAL-PATCH-010 complete trigger coverage | NO |

## Category: Posting/Receipts/Provenance (ALL IN posting-authority)
| Commit | Title | In Main |
|--------|-------|---------|
| 0b15392b | Promotion Agent Tranche 1: deterministic + idempotent | NO |
| cc68bb62 | Promotion: shadow mode, replay proof, calibration report | NO |
| c0839457 | AlertAgent: claim-first idempotency for concurrent publish | NO |
| 888bd6ec | POSTING-AUTHORITY-001 origin-gated posting | NO |
| 1ab430f2 | PARLAY-DISCORD-GROUPING-001 - parlays post as single message | NO |
| 9fd0cc56 | PARLAY-PRESENTATION-REFINE-001 clean block format | NO |

## Category: Smart Form (IN posting-authority)
| Commit | Title | In Main |
|--------|-------|---------|
| d99cd353 | smart-form(checkpoint): pre-UX-overhaul snapshot | NO |
| 7282d5d6 | SMARTFORM-ODDS-FIELD-INTEGRITY-007 | YES (main) |

## Category: Command Center (IN posting-authority)
| Commit | Title | In Main |
|--------|-------|---------|
| 96deee29 | cc(ux-overhaul): enterprise-grade Command Center UX/UI rewrite | NO |
| a27c7649 | fix(command-center): graceful fallback states | NO |
| c3e044ef | fix(workspace): resolve pre-existing TypeScript errors | NO |

## Category: Bridge/Worker
| Commit | Title | In Main |
|--------|-------|---------|
| 3658a71b | fix(worker): align BridgeWorker + publish.ts columns | NO |
| 394c980d | fix(grading): BridgeWorker simulation with real SyndicateGradingEngine | NO |

## Category: Recap Agent
| Commit | Title | In Main |
|--------|-------|---------|
| 2acc6b9a | recap(v1): operator-grade daily/weekly recap agent | NO |

## Unique Branch: Alert Agent V2 Clean
| Commit | Title | In Main |
|--------|-------|---------|
| d454f874 | AlertAgent V2 — idempotent + cooldown + elite embeds | NO |

## Commits ONLY in main (not in posting-authority)
| Commit | Title |
|--------|-------|
| 7234b0aa | feat(dx): DX_OPS_PACK_002 - ops tooling scripts |
| 7282d5d6 | fix(smart-form): SMARTFORM-ODDS-FIELD-INTEGRITY-007 |
| a9061199 | chore(governance): align CLAUDE contracts to repo truth |
| c3767b0e | feat(runtime): PHASE-2-PRODUCTION-READINESS-019 reconciliation |
