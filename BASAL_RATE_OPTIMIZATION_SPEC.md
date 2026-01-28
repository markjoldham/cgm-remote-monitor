# Basal Rate Optimization - Feature Specification

**Version**: 1.0  
**Date**: 2026-01-28  
**Status**: Draft - Requirements Phase

---

## 1. Overview

### 1.1 Purpose

Provide intelligent, safety-focused recommendations for basal rate adjustments based on statistical analysis of fasting period glucose data.

### 1.2 Goals

- Analyze glucose stability during fasting periods to identify basal rate issues
- Use statistical models to recommend specific rate adjustments
- Prioritize safety with conservative recommendations and clear warnings
- Provide actionable insights that users can discuss with their healthcare providers

### 1.3 Non-Goals

- Automatic basal rate adjustments (user must manually review and apply)
- Real-time recommendations (analysis is retrospective)
- Replacing medical advice (tool provides data for informed discussions)

---

## 2. Requirements

### 2.1 Functional Requirements

#### FR-1: Statistical Analysis

- **FR-1.1**: Calculate glucose trend (rising/falling/stable) during fasting periods
- **FR-1.2**: Compute rate of change (mg/dL per hour)
- **FR-1.3**: Determine statistical significance of trends
- **FR-1.4**: Identify time-of-day patterns (overnight, morning, afternoon, evening)
- **FR-1.5**: Calculate confidence intervals for recommendations

#### FR-2: Basal Rate Recommendations

- **FR-2.1**: Suggest specific rate adjustments (e.g., "+0.05 U/hr", "-0.10 U/hr")
- **FR-2.2**: Provide time-of-day specific recommendations
- **FR-2.3**: Calculate recommended adjustment magnitude based on:
    - Rate of change during fasting
    - Current basal rate (if available from profile)
    - Glucose variability (CV%)
    - Duration of fasting period
- **FR-2.4**: Prioritize recommendations by impact and confidence

#### FR-3: Safety Features

- **FR-3.1**: Flag periods with high variability as unsuitable for basal testing
- **FR-3.2**: Require minimum fasting duration (4+ hours) for recommendations
- **FR-3.3**: Limit maximum recommended adjustment (e.g., ±20% of current rate)
- **FR-3.4**: Warn about periods with active insulin or recent meals
- **FR-3.5**: Highlight periods with hypoglycemia risk
- **FR-3.6**: Require multiple confirming periods before strong recommendations

#### FR-4: Visualization

- **FR-4.1**: Display recommendations in the fasting periods summary
- **FR-4.2**: Show confidence level for each recommendation
- **FR-4.3**: Provide visual indicators (color coding) for recommendation strength
- **FR-4.4**: Include explanatory text for why recommendations are made

### 2.2 Non-Functional Requirements

#### NFR-1: Safety

- All recommendations must be conservative (prefer under-adjustment to over-adjustment)
- Clear disclaimers that recommendations are not medical advice
- Prominent warnings for any safety concerns

#### NFR-2: Usability

- Recommendations must be easy to understand for non-technical users
- Provide context and reasoning for each recommendation
- Allow users to export recommendations for discussion with healthcare providers

#### NFR-3: Performance

- Analysis should complete within 5 seconds for 7 days of data
- No impact on existing report generation performance

---

## 3. Design

### 3.1 Statistical Model

#### 3.1.1 Trend Analysis

```text
For each fasting period:
1. Calculate linear regression of glucose over time
2. Compute slope (mg/dL per hour)
3. Calculate R² to determine trend strength
4. Classify trend:
   - Rising: slope > +5 mg/dL/hr AND R² > 0.5
   - Falling: slope < -5 mg/dL/hr AND R² > 0.5
   - Stable: |slope| ≤ 5 mg/dL/hr OR R² ≤ 0.5
```text

#### 3.1.2 Basal Rate Adjustment Calculation

```text
Base adjustment formula:
adjustment_U_per_hr = (slope_mg_dL_per_hr / sensitivity_factor) * safety_multiplier

Where:
- slope_mg_dL_per_hr: Rate of glucose change during fasting
- sensitivity_factor: User's insulin sensitivity (default: 50 mg/dL per U)
- safety_multiplier: Conservative factor (0.3 to 0.5)

Example:
- Glucose rising at +10 mg/dL/hr
- Sensitivity: 50 mg/dL per U
- Safety multiplier: 0.4
- Adjustment: (10 / 50) * 0.4 = +0.08 U/hr
```text

#### 3.1.3 Confidence Scoring

```text
Confidence score (0-100):
- Duration score: min(duration_hours / 6, 1.0) * 30
- Stability score: (1 - CV/40) * 30
- Trend strength: R² * 20
- Consistency score: (matching_periods / total_periods) * 20

Total confidence = sum of above scores
- High confidence: 70-100
- Medium confidence: 50-69
- Low confidence: 0-49
```text

### 3.2 Safety Rules

#### 3.2.1 Disqualification Criteria

A fasting period is disqualified from recommendations if:

- Duration < 4 hours
- CV% > 30% (too variable)
- Contains hypoglycemia (glucose < 70 mg/dL for > 15 minutes)
- Contains hyperglycemia (glucose > 250 mg/dL)
- Recent meal (< 3 hours before period start)
- Active insulin on board (if IOB data available)

#### 3.2.2 Adjustment Limits

- Maximum single adjustment: ±0.15 U/hr
- Maximum percentage change: ±20% of current basal rate
- Minimum adjustment threshold: 0.025 U/hr (below this, recommend no change)

#### 3.2.3 Confirmation Requirements

For high-confidence recommendations:

- Require 2+ qualifying periods showing same trend
- Periods should be from different days
- Trends should be consistent (same direction, similar magnitude)

### 3.3 User Interface Design

#### 3.3.1 Recommendations Section

Add new section to Day to Day report after fasting periods summary:

```text
┌─────────────────────────────────────────────────────────────┐
│ Basal Rate Optimization Recommendations                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ ⚠️ IMPORTANT: These are data-driven suggestions, not        │
│    medical advice. Discuss with your healthcare provider.   │
│                                                              │
│ 📊 Analysis based on 6 fasting periods over 7 days          │
│                                                              │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ 🌙 OVERNIGHT (10 PM - 6 AM)                          │   │
│ │ Current Rate: 1.2 U/hr                               │   │
│ │                                                       │   │
│ │ Recommendation: INCREASE by 0.05 U/hr → 1.25 U/hr   │   │
│ │ Confidence: HIGH (82/100)                            │   │
│ │                                                       │   │
│ │ Reasoning:                                            │   │
│ │ • Glucose consistently rising (+8 mg/dL/hr)          │   │
│ │ • 3 qualifying overnight periods analyzed            │   │
│ │ • Low variability (CV: 15%)                          │   │
│ │ • No hypoglycemia detected                           │   │
│ │                                                       │   │
│ │ Supporting Data:                                      │   │
│ │ • Jan 26: +7.2 mg/dL/hr (8.5h, CV 15%)              │   │
│ │ • Jan 23: +9.1 mg/dL/hr (11.8h, CV 11%)             │   │
│ │ • Jan 22: +8.5 mg/dL/hr (8.4h, CV 14%)              │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                              │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ 🌅 MORNING (6 AM - 12 PM)                            │   │
│ │ Current Rate: 1.0 U/hr                               │   │
│ │                                                       │   │
│ │ Recommendation: NO CHANGE                            │   │
│ │ Confidence: MEDIUM (55/100)                          │   │
│ │                                                       │   │
│ │ Reasoning:                                            │   │
│ │ • Glucose stable (-2 mg/dL/hr)                       │   │
│ │ • Only 1 qualifying morning period                   │   │
│ │ • Need more data for confident recommendation        │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                              │
│ � Tips:                                                     │
│ • Test one time period at a time                            │
│ • Wait 2-3 days between adjustments                         │
│ • Monitor for hypoglycemia after increases                  │
│ • Keep detailed notes of changes made                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```text

#### 3.3.2 Color Coding

- 🟢 Green: High confidence (70-100), safe to implement
- 🟡 Yellow: Medium confidence (50-69), consider with caution
- 🔴 Red: Low confidence (0-49) or safety concerns, do not implement

---

## 4. Implementation Plan

### 4.1 Phase 1: Statistical Analysis Engine

**Files**: `lib/report_plugins/basal-rate-optimizer.js`

**Tasks**:

- [ ] Implement linear regression for glucose trends
- [ ] Calculate R² and confidence intervals
- [ ] Compute rate of change with statistical significance
- [ ] Add time-of-day classification
- [ ] Unit tests for statistical functions

### 4.2 Phase 2: Recommendation Engine

**Files**: `lib/report_plugins/basal-rate-optimizer.js`

**Tasks**:

- [ ] Implement basal rate adjustment calculation
- [ ] Apply safety rules and limits
- [ ] Calculate confidence scores
- [ ] Group recommendations by time of day
- [ ] Require confirmation from multiple periods

### 4.3 Phase 3: Safety Validation

**Files**: `lib/report_plugins/basal-rate-optimizer.js`

**Tasks**:

- [ ] Implement disqualification criteria
- [ ] Add hypoglycemia detection
- [ ] Validate adjustment limits
- [ ] Add warning generation
- [ ] Safety unit tests

### 4.4 Phase 4: UI Integration

**Files**: `lib/report_plugins/daytoday.js`

**Tasks**:

- [ ] Add recommendations section to report
- [ ] Implement color coding
- [ ] Add explanatory text
- [ ] Format supporting data
- [ ] Add export functionality

### 4.5 Phase 5: Testing & Validation

**Tasks**:

- [ ] Test with real user data
- [ ] Validate recommendations against known good adjustments
- [ ] User acceptance testing
- [ ] Documentation
- [ ] Medical disclaimer review

---

## 5. Data Requirements

### 5.1 Required Data

- Fasting period glucose readings (from existing detection)
- Fasting period metadata (start/end times, duration, quality)
- User's basal profile (if available)
- User's insulin sensitivity factor (optional, use default if not available)

### 5.2 Optional Data

- IOB (insulin on board) data
- Recent meal/bolus history
- User's target range
- Historical basal rate changes

---

## 6. Risk Assessment

### 6.1 Safety Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Incorrect recommendation causes hypoglycemia | HIGH | Conservative adjustments, multiple confirmations, clear warnings |
| User implements without medical supervision | MEDIUM | Prominent disclaimers, encourage healthcare provider discussion |
| Algorithm error in calculation | MEDIUM | Extensive testing, unit tests, validation against known cases |
| Insufficient data leads to poor recommendation | LOW | Require minimum data quality, show confidence scores |

### 6.2 Technical Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Performance impact on report generation | LOW | Optimize algorithms, cache calculations |
| Complex UI confuses users | MEDIUM | User testing, clear documentation, progressive disclosure |
| Integration with existing code | LOW | Modular design, minimal changes to existing files |

---

## 7. Success Metrics

### 7.1 Quantitative Metrics

- Recommendation accuracy: 80%+ of recommendations improve glucose stability
- User adoption: 30%+ of users with fasting data view recommendations
- Safety: Zero reported hypoglycemia incidents from following recommendations

### 7.2 Qualitative Metrics

- User feedback: Recommendations are clear and actionable
- Healthcare provider feedback: Data is useful for clinical discussions
- User confidence: Users feel empowered to optimize their therapy

---

## 8. Open Questions

1. **Q**: Should we integrate with existing basal profile data?
   **A**: TBD - Need to investigate how profiles are stored and accessed

2. **Q**: What default insulin sensitivity factor should we use?
   **A**: TBD - Research typical values, possibly 50 mg/dL per U as starting point

3. **Q**: Should recommendations be exportable (PDF, CSV)?
   **A**: TBD - User feedback needed, likely yes for healthcare provider discussions

4. **Q**: Should we track which recommendations users implement?
   **A**: TBD - Privacy considerations, but could be valuable for validation

5. **Q**: How do we handle users on insulin pumps vs. MDI?
   **A**: TBD - May need different recommendation strategies

---

## 9. References

### 9.1 Clinical Guidelines

- ADA Standards of Care: Basal insulin adjustment guidelines
- ISPAD Guidelines: Pediatric basal rate optimization
- Think Like a Pancreas: Practical basal testing methodology

### 9.2 Technical References

- Linear regression algorithms
- Statistical significance testing
- Insulin pharmacokinetics
- CGM data analysis best practices

---

## 10. Appendix

### 10.1 Example Calculations

**Example 1: Rising Glucose Overnight**

```text
Input:
- Fasting period: 10 PM - 6 AM (8 hours)
- Glucose readings: 120, 125, 130, 135, 140, 145, 150, 155 mg/dL
- Current basal rate: 1.0 U/hr
- Insulin sensitivity: 50 mg/dL per U

Calculation:
- Slope: (155 - 120) / 8 = +4.4 mg/dL/hr
- R²: 0.98 (strong linear trend)
- Adjustment: (4.4 / 50) * 0.4 = +0.035 U/hr
- Rounded: +0.05 U/hr (minimum increment)
- New rate: 1.05 U/hr
- Confidence: HIGH (duration 8h, CV 10%, R² 0.98)
```

**Example 2: Falling Glucose Morning**

```text
Input:
- Fasting period: 6 AM - 10 AM (4 hours)
- Glucose readings: 140, 130, 120, 110, 100, 90 mg/dL
- Current basal rate: 1.2 U/hr
- Insulin sensitivity: 50 mg/dL per U

Calculation:
- Slope: (90 - 140) / 4 = -12.5 mg/dL/hr
- R²: 0.95 (strong linear trend)
- Adjustment: (-12.5 / 50) * 0.4 = -0.10 U/hr
- New rate: 1.10 U/hr
- Confidence: MEDIUM (duration 4h, approaching hypo)
- WARNING: Glucose approaching 70 mg/dL, monitor closely
```

---

**Document Status**: Ready for review and feedback
**Next Steps**: Review requirements, refine design, begin Phase 1 implementation

