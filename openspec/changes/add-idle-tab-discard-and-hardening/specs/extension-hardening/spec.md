## ADDED Requirements

### Requirement: Local-only optimization processing
The extension SHALL perform idle optimization, tab classification, and RAM estimation locally without sending browsing-derived data to external services.

#### Scenario: Idle scan runs
- **WHEN** the background optimization flow processes tab titles and URLs
- **THEN** the extension SHALL keep that processing local to the extension runtime

#### Scenario: Analytics are available
- **WHEN** RAM analytics exist for discarded tabs
- **THEN** the extension SHALL NOT transmit those analytics to any remote endpoint

### Requirement: Permission and disclosure alignment
The extension SHALL describe its use of tab data in user-facing disclosures consistent with its single-purpose optimization behavior.

#### Scenario: User reviews extension behavior
- **WHEN** the extension explains its optimization workflow
- **THEN** it SHALL disclose that tab metadata is used locally for grouping and optimization decisions

#### Scenario: User reviews RAM metric
- **WHEN** the extension displays RAM savings
- **THEN** it SHALL indicate that the value is an estimate

### Requirement: Lean runtime and package footprint
The extension SHALL avoid unnecessary runtime work and SHALL exclude non-essential debug artifacts from the published package.

#### Scenario: Background worker is active
- **WHEN** idle optimization is running in normal operation
- **THEN** the extension SHALL use periodic event-driven scans rather than persistent high-frequency polling

#### Scenario: Release package is prepared
- **WHEN** the extension is built for Chrome Web Store publication
- **THEN** the published package SHALL omit sourcemaps and other non-essential debug artifacts
