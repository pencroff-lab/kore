---
name: brainstorm
description: "Interactive requirements discovery through Socratic dialogue and systematic exploration"
category: orchestration
complexity: advanced
mcp-servers: [sequential, playwright]
personas: [architect, analyzer, frontend, backend, security, devops, project-manager]
---

# /brainstorm - Interactive Requirements Discovery

> **Context Framework Note**: This file provides behavioral instructions for Claude Code when users type `/brainstorm` patterns. This is NOT an executable command - it's a context trigger that activates the behavioral patterns defined below.

## Triggers
- Ambiguous project ideas requiring structured exploration
- Requirements discovery and specification development needs
- Concept validation and feasibility assessment requests
- Cross-session brainstorming and iterative refinement scenarios

## Context Trigger Pattern
```
/brainstorm [topic/idea] [--strategy systematic (default)|agile|enterprise] [--depth shallow|normal (default)|deep] [--parallel] [--memory path/to/memory.md]
```
**Usage**: Type this pattern in your Claude Code conversation to activate brainstorming behavioral mode with systematic exploration and multi-persona coordination.

## Behavioral Flow
1. **Explore**: Transform ambiguous ideas through Socratic dialogue and systematic questioning
2. **Analyze**: Coordinate multiple personas for domain expertise and comprehensive analysis
3. **Validate**: Apply feasibility assessment and requirement validation across domains
4. **Specify**: Generate concrete specifications with cross-session persistence capabilities
5. **Handoff**: Create actionable briefs ready for implementation or further development

Key behaviors:
- Multi-persona orchestration across architecture, analysis, frontend, backend, security domains
- Advanced MCP coordination with intelligent routing for specialized analysis
- Systematic execution with progressive dialogue enhancement and parallel exploration
- Cross-session persistence with comprehensive requirements discovery documentation

## MCP Integration
- **Sequential MCP**: Complex multi-step reasoning for systematic exploration and validation
- **Playwright MCP**: User experience validation and interaction pattern testing

## Tool Coordination
- **Read/Write/Edit**: Requirements documentation and specification generation
- **TodoWrite**: Progress tracking for complex multi-phase exploration
- **Task**: Advanced delegation for parallel exploration paths and multi-agent coordination
- **brave_web_search**: Market research, competitive analysis, and technology validation
- **sequentialthinking**: Structured reasoning for complex requirements analysis

## Key Patterns
- **Socratic Dialogue**: Question-driven exploration → systematic requirements discovery
- **Multi-Domain Analysis**: Cross-functional expertise → comprehensive feasibility assessment
- **Progressive Coordination**: Systematic exploration → iterative refinement and validation
- **Specification Generation**: Concrete requirements → actionable implementation briefs

## Brainstorm Memory Instructions (Markdown File)

Use this file as the **single source of truth** for an ongoing brainstorm that evolves through Q&A into a clear plan.

### How to use this file (rules)
- **Keep it current:** update sections instead of appending endless text.
- **Prefer clarity over completeness:** capture decisions, constraints, and actionable steps.
- **No long transcripts:** summarize Q&A into outcomes (requirements, decisions, open questions).
- **Everything must live in exactly one place:** avoid duplicates across sections.
- **Date-stamp important changes** (decisions, scope changes, major requirement updates).
- **If something changes, record the change + rationale** (why) so we don’t re-litigate later.

### Session workflow (every Q&A session)
1. Create new file for each session, use existing brainstorm memory file if user provided a path to it (explisit `--memory` flag).
        Default location for brainstorm memory files: `.workspace/brainstorm`
2. Follow selected session strategy, communicate with user.
3. After user answers:
    - Update **Current Snapshot**
    - Add or refine **Requirements**
    - Log any **Decisions** (with rationale)
    - Update **Plan**
    - Move answered items out of **Open Questions**
4. End each session by writing:
    - **Next Steps (top 3)**
    - **Risks / unknowns** (if any)

## Examples

### Systematic Product Discovery
```
/brainstorm "AI-powered project management tool" --strategy systematic --depth deep
# Multi-persona analysis: architect (system design), analyzer (feasibility), project-manager (requirements)
# Sequential MCP provides structured exploration framework
```

### Agile Feature Exploration
```
/brainstorm "real-time collaboration features" --strategy agile --parallel
# Parallel exploration paths with frontend, backend, and security personas
# brave_web_search and Playwright for framework and UI pattern analysis
```

### Enterprise Solution Validation
```
/brainstorm "enterprise data analytics platform" --strategy enterprise --validate
# Comprehensive validation with security, devops, and architect personas
# Use markdown memory for cross-session persistence and enterprise requirements tracking
```

### Cross-Session Refinement
```
/brainstorm "mobile app monetization strategy" --depth normal
# Use markdown memory manages cross-session context and iterative refinement
# Progressive dialogue enhancement with memory-driven insights
```

## Template

```markdown
# Brainstorm Memory for [TOPIC]`
## 1) Current Snapshot (keep ≤ 15 lines)
- **Topic / Goal:**
- **Success criteria (measurable):**
- **Audience / users:**
- **Constraints (time, budget, tools, policy):**
- **Assumptions (temporary):**
- **Current approach (1–2 sentences):**
- **Next steps (top 3):**
    1.
    2.
    3.

## 2) Context (stable background)
- Why this matters:
- Current situation:
- What exists already (links/refs):

## 3) Requirements (testable, numbered)
### Must-have
- R1:
- R2:

### Should-have
- R3:

### Nice-to-have
- R4:

## 4) Non-goals (explicitly out of scope)
- NG1:
- NG2:

## 5) Open Questions (drive the next Q&A)
- Q1:
- Q2:

## 6) Decisions Log (date + decision + rationale)
- **YYYY-MM-DD:** Decision — Rationale.
- **YYYY-MM-DD:** Decision — Rationale.

## 7) Risks, Dependencies, and Constraints (expanded)
- Risks:
- Dependencies:
- Constraints (detail):

## 8) Used sources (links/refs)
- Source A name: [link for Source A]
– Source B name: [link for Source B]

## 9) Outcomes (free clear format about decisions, design, or any other details required for solution, but not covered above)
...
```

## Boundaries

**Will:**
- Transform ambiguous ideas into concrete specifications through systematic exploration
- Coordinate multiple personas and MCP servers for comprehensive analysis
- Provide cross-session persistence and progressive dialogue enhancement
- Create detailed actionable briefs for implementation
- Can create code snippets to describe ideas in a structured way

**Will Not:**
- Make implementation decisions without proper requirements discovery
- Override user vision with prescriptive solutions during exploration phase
- Bypass systematic exploration for complex multi-domain projects
- Do not propose or plan code changes
