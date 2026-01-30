# Design Document: Basal Rate Optimization

## Overview

The Basal Rate Optimization feature analyzes glucose trends during fasting periods to provide data-driven recommendations for adjusting basal insulin rates. The system uses statistical analysis (linear regression) to identify whether glucose is rising, falling, or stable during periods when no food is being digested, which indicates whether basal insulin rates are appropriately set.

A key innovation is the accounting for automated insulin delivery from closed-loop systems (Loop, AAPS, OpenAPS). The system analyzes temp basals and Super Micro Boluses (SMBs) to calculate how much extra insulin was delivered beyond the programmed basal rate. If glucose remains stable or rises despite this extra insulin, it indicates the base basal rate is too low and needs to be increased more aggressively.

The design prioritizes safety through:

- Conservative adjustment calculations using a 0.75 safety multiplier
- Automated insulin delivery accounting to provide accurate recommendations for closed-loop users
- TDD-based safety limits that scale with individual insulin needs (60% of TDD / 24 hours)
- Multiple validation checks to disqualify unreliable data
- Confidence scoring to indicate recommendation reliability
- Requirement for multiple confirming periods before high-confidence recommendations
- Support for both mg/dL and mmol/L units with automatic conversion
- Clear medical disclaimers and warnings

The feature integrates with the existing Nightscout Day to Day report and fasting detection system, reading user profile data for personalized recommendations.

## Architecture

### System Components

```text
┌─────────────────────────────────────────────────────────────┐
│                    Day to Day Report                         │
│                  (daytoday.js - existing)                    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ calls
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Basal Rate Optimizer Plugin                     │
│              (basal-rate-optimizer.js - new)                 │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Statistical Analysis Engine                          │  │
│  │  - Linear regression calculation                      │  │
│  │  - Trend classification (rising/falling/stable)       │  │
│  │  - Variability analysis (CV%)                         │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Insulin Delivery Analysis Engine                     │  │
│  │  - Calculate programmed basal insulin                 │  │
│  │  - Analyze temp basals and SMBs                       │  │
│  │  - Compute extra insulin from automation              │  │
│  │  - Determine automation adjustment factor             │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Safety Validation Engine                             │  │
│  │  - Period disqualification checks                     │  │
│  │  - Hypoglycemia detection                             │  │
│  │  - TDD-based adjustment limit enforcement             │  │
│  │  - Percentage and minimum threshold limits            │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Recommendation Engine                                │  │
│  │  - Adjustment calculation                             │  │
│  │  - Confidence scoring                                 │  │
│  │  - Time-of-day grouping                               │  │
│  │  - Multi-period confirmation                          │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  UI Formatter                                         │  │
│  │  - HTML generation for recommendations                │  │
│  │  - Color coding by confidence                         │  │
│  │  - Export to PDF/CSV                                  │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────┬─────────────────────────────────┬─────────────┘
             │                                 │
             │ reads                           │ reads
             ▼                                 ▼
┌──────────────────────────┐    ┌──────────────────────────┐
│  Fasting Detection       │    │  Profile Data            │
│  (existing)              │    │  (existing)              │
│  - Fasting periods       │    │  - Basal rate schedule   │
│  - Glucose readings      │    │  - ISF values            │
└──────────────────────────┘    └──────────────────────────┘
```

### Data Flow

1. **Input**: Day to Day report calls basal rate optimizer with fasting period data and profile data
2. **Analysis**: Statistical engine analyzes each fasting period for glucose trends
3. **Validation**: Safety engine filters out unreliable or unsafe periods
4. **Grouping**: Periods are grouped by time of day (overnight, morning, afternoon, evening)
5. **Calculation**: Recommendation engine calculates adjustments for each time block
6. **Scoring**: Confidence scores are computed based on data quality and consistency
7. **Output**: UI formatter generates HTML display with recommendations and supporting data

## Components and Interfaces

### 1. Statistical Analysis Engine

#### Purpose Calculate glucose trends and variability metrics for fasting periods.

#### Key Functions

```javascript
/**
 * Calculate linear regression for glucose data
 * @param {Array<{mills: number, sgv: number}>} glucoseReadings - CGM data points
 * @returns {{slope: number, intercept: number, rSquared: number}}
 */
function calculateLinearRegression(glucoseReadings)

/**
 * Classify glucose trend based on slope and R²
 * @param {number} slope - Rate of change in mg/dL per hour
 * @param {number} rSquared - Goodness of fit (0-1)
 * @returns {'rising' | 'falling' | 'stable'}
 */
function classifyTrend(slope, rSquared)

/**
 * Calculate coefficient of variation (CV%)
 * @param {Array<number>} glucoseValues - Array of glucose readings
 * @returns {number} CV as percentage
 */
function calculateCV(glucoseValues)
```

#### Algorithm Details

Linear Regression using least squares method:

```text
Given n data points (x₁, y₁), (x₂, y₂), ..., (xₙ, yₙ) where:
  x = time in hours from period start
  y = glucose value in mg/dL

Calculate:
  x̄ = mean of x values
  ȳ = mean of y values

  slope = Σ((xᵢ - x̄)(yᵢ - ȳ)) / Σ((xᵢ - x̄)²)
  intercept = ȳ - slope * x̄

  R² = 1 - (SS_res / SS_tot)
  where:
    SS_res = Σ(yᵢ - ŷᵢ)²  (residual sum of squares)
    SS_tot = Σ(yᵢ - ȳ)²  (total sum of squares)
    ŷᵢ = slope * xᵢ + intercept (predicted value)
```

Trend Classification:

```text
if (slope > 5 AND rSquared > 0.5):
  trend = 'rising'
else if (slope < -5 AND rSquared > 0.5):
  trend = 'falling'
else:
  trend = 'stable'
```

CV Calculation:

```text
CV% = (standard_deviation / mean) * 100
```

### 2. Safety Validation Engine

#### Purpose Ensure only reliable and safe data is used for recommendations.

#### Key Functions

```javascript
/**
 * Check if a fasting period qualifies for recommendations
 * @param {Object} fastingPeriod - Fasting period with glucose data
 * @param {Object} analysis - Statistical analysis results
 * @returns {{qualified: boolean, reason: string}}
 */
function validateFastingPeriod(fastingPeriod, analysis)

/**
 * Detect hypoglycemia in glucose readings
 * @param {Array<{mills: number, sgv: number}>} glucoseReadings
 * @returns {boolean} True if hypo detected (< 70 mg/dL for > 15 min)
 */
function detectHypoglycemia(glucoseReadings)

/**
 * Apply adjustment limits to ensure safety
 * @param {number} calculatedAdjustment - Raw calculated adjustment
 * @param {number} currentBasalRate - Current rate from profile
 * @returns {number} Limited adjustment
 */
function applyAdjustmentLimits(calculatedAdjustment, currentBasalRate)
```

#### Disqualification Rules

```javascript
function validateFastingPeriod(fastingPeriod, analysis) {
  // Rule 1: Minimum duration
  if (fastingPeriod.duration < 4) {
    return {qualified: false, reason: 'Duration too short (< 4 hours)'};
  }

  // Rule 2: Maximum variability
  if (analysis.cv > 30) {
    return {qualified: false, reason: 'Too variable (CV > 30%)'};
  }

  // Rule 3: Hypoglycemia check
  if (detectHypoglycemia(fastingPeriod.glucoseReadings)) {
    return {qualified: false, reason: 'Contains hypoglycemia'};
  }

  // Rule 4: Hyperglycemia check
  const maxGlucose = Math.max(...fastingPeriod.glucoseReadings.map(r => r.sgv));
  if (maxGlucose > 250) {
    return {qualified: false, reason: 'Contains hyperglycemia (> 250 mg/dL)'};
  }

  return {qualified: true, reason: null};
}
```

#### Adjustment Limits

```javascript
function applyAdjustmentLimits(calculatedAdjustment, currentBasalRate) {
  let limitedAdjustment = calculatedAdjustment;

  // Absolute limit: ±0.15 U/hr
  if (Math.abs(limitedAdjustment) > 0.15) {
    limitedAdjustment = Math.sign(limitedAdjustment) * 0.15;
  }

  // Percentage limit: ±20% of current rate
  const maxPercentageChange = currentBasalRate * 0.20;
  if (Math.abs(limitedAdjustment) > maxPercentageChange) {
    limitedAdjustment = Math.sign(limitedAdjustment) * maxPercentageChange;
  }

  // Minimum threshold: 0.025 U/hr
  if (Math.abs(limitedAdjustment) < 0.025) {
    limitedAdjustment = 0;
  }

  return limitedAdjustment;
}
```

### 3. Recommendation Engine

#### Purpose Calculate basal rate adjustments and confidence scores.

#### Key Functions

```javascript
/**
 * Calculate basal rate adjustment
 * @param {number} slope - Glucose rate of change (mg/dL per hour)
 * @param {number} isf - Insulin sensitivity factor
 * @param {number} currentBasalRate - Current basal rate
 * @returns {number} Recommended adjustment in U/hr
 */
function calculateAdjustment(slope, isf, currentBasalRate)

/**
 * Calculate confidence score for a recommendation
 * @param {Array<Object>} qualifyingPeriods - Periods supporting the recommendation
 * @param {Object} analysis - Aggregated analysis data
 * @returns {number} Confidence score 0-100
 */
function calculateConfidenceScore(qualifyingPeriods, analysis)

/**
 * Group fasting periods by time of day
 * @param {Array<Object>} fastingPeriods - All fasting periods
 * @returns {Object} Periods grouped by time block
 */
function groupByTimeOfDay(fastingPeriods)

/**
 * Generate recommendation for a time block
 * @param {string} timeBlock - 'overnight', 'morning', 'afternoon', or 'evening'
 * @param {Array<Object>} periods - Qualifying periods for this time block
 * @param {Object} profileData - User's profile settings
 * @returns {Object} Recommendation with adjustment, confidence, and reasoning
 */
function generateRecommendation(timeBlock, periods, profileData)
```

#### Adjustment Calculation

```javascript
function calculateAdjustment(slope, isf, currentBasalRate) {
  const SAFETY_MULTIPLIER = 0.4; // Conservative factor

  // Base calculation
  let adjustment = (slope / isf) * SAFETY_MULTIPLIER;

  // Apply safety limits
  adjustment = applyAdjustmentLimits(adjustment, currentBasalRate);

  // Round to nearest 0.05 U/hr (typical pump increment)
  adjustment = Math.round(adjustment / 0.05) * 0.05;

  return adjustment;
}
```

#### Confidence Score Calculation

```javascript
function calculateConfidenceScore(qualifyingPeriods, analysis) {
  let score = 0;

  // Duration component (max 30 points)
  const avgDuration = qualifyingPeriods.reduce((sum, p) => sum + p.duration, 0) / qualifyingPeriods.length;
  const durationScore = Math.min(avgDuration / 6, 1.0) * 30;
  score += durationScore;

  // Stability component (max 30 points)
  const avgCV = qualifyingPeriods.reduce((sum, p) => sum + p.cv, 0) / qualifyingPeriods.length;
  const stabilityScore = Math.max(0, (1 - avgCV / 40)) * 30;
  score += stabilityScore;

  // Trend strength component (max 20 points)
  const avgRSquared = qualifyingPeriods.reduce((sum, p) => sum + p.rSquared, 0) / qualifyingPeriods.length;
  const trendScore = avgRSquared * 20;
  score += trendScore;

  // Consistency component (max 20 points)
  const totalPeriods = analysis.totalPeriodsInTimeBlock;
  const consistencyScore = (qualifyingPeriods.length / totalPeriods) * 20;
  score += consistencyScore;

  return Math.round(score);
}
```

#### Time-of-Day Grouping

```javascript
function groupByTimeOfDay(fastingPeriods) {
  const groups = {
    overnight: [],  // 22:00 - 06:00
    morning: [],    // 06:00 - 12:00
    afternoon: [],  // 12:00 - 18:00
    evening: []     // 18:00 - 22:00
  };

  fastingPeriods.forEach(period => {
    const startHour = moment(period.startTime).hour();

    if (startHour >= 22 || startHour < 6) {
      groups.overnight.push(period);
    } else if (startHour >= 6 && startHour < 12) {
      groups.morning.push(period);
    } else if (startHour >= 12 && startHour < 18) {
      groups.afternoon.push(period);
    } else {
      groups.evening.push(period);
    }
  });

  return groups;
}
```

### 4. UI Formatter

#### Purpose Generate HTML display and export functionality for recommendations.

#### Key Functions

```javascript
/**
 * Generate HTML for recommendations section
 * @param {Object} recommendations - Recommendations by time block
 * @param {Object} metadata - Analysis metadata (date range, period count)
 * @returns {string} HTML string
 */
function generateRecommendationsHTML(recommendations, metadata)

/**
 * Get color coding for confidence level
 * @param {number} confidenceScore - Score 0-100
 * @returns {string} Color code ('green', 'yellow', 'red')
 */
function getConfidenceColor(confidenceScore)

/**
 * Export recommendations to PDF
 * @param {Object} recommendations - Recommendations data
 * @returns {Blob} PDF blob
 */
function exportToPDF(recommendations)

/**
 * Export recommendations to CSV
 * @param {Object} recommendations - Recommendations data
 * @returns {string} CSV string
 */
function exportToCSV(recommendations)
```

#### HTML Structure

```javascript
function generateRecommendationsHTML(recommendations, metadata) {
  let html = `
    <div class="basal-rate-recommendations">
      <h3>Basal Rate Optimization Recommendations</h3>

      <div class="disclaimer">
        ⚠️ IMPORTANT: These are data-driven suggestions, not medical advice.
        Discuss with your healthcare provider before making changes.
      </div>

      <div class="analysis-summary">
        📊 Analysis based on ${metadata.periodCount} fasting periods
        from ${metadata.startDate} to ${metadata.endDate}
      </div>

      ${Object.keys(recommendations).map(timeBlock =>
        generateTimeBlockHTML(timeBlock, recommendations[timeBlock])
      ).join('')}

      <div class="tips">
        💡 Tips:
        <ul>
          <li>Test one time period at a time</li>
          <li>Wait 2-3 days between adjustments</li>
          <li>Monitor for hypoglycemia after increases</li>
          <li>Keep detailed notes of changes made</li>
        </ul>
      </div>

      <div class="export-buttons">
        <button onclick="exportRecommendationsToPDF()">Export to PDF</button>
        <button onclick="exportRecommendationsToCSV()">Export to CSV</button>
      </div>
    </div>
  `;

  return html;
}
```

#### Confidence Color Coding

```javascript
function getConfidenceColor(confidenceScore) {
  if (confidenceScore >= 70) {
    return 'green';  // High confidence
  } else if (confidenceScore >= 50) {
    return 'yellow'; // Medium confidence
  } else {
    return 'red';    // Low confidence
  }
}
```

## Data Models

### Fasting Period (Input)

```javascript
{
  startTime: number,           // Unix timestamp (ms)
  endTime: number,             // Unix timestamp (ms)
  duration: number,            // Hours
  glucoseReadings: [           // Array of CGM readings
    {
      mills: number,           // Unix timestamp (ms)
      sgv: number              // Glucose value (mg/dL)
    }
  ],
  quality: string,             // From fasting detection: 'excellent', 'good', 'fair'
  score: number                // From fasting detection: 0-100
}
```

### Statistical Analysis (Internal)

```javascript
{
  slope: number,               // mg/dL per hour
  intercept: number,           // mg/dL
  rSquared: number,            // 0-1
  trend: string,               // 'rising', 'falling', 'stable'
  cv: number,                  // Coefficient of variation (%)
  meanGlucose: number,         // mg/dL
  stdDevGlucose: number        // mg/dL
}
```

### Recommendation (Output)

```javascript
{
  timeBlock: string,           // 'overnight', 'morning', 'afternoon', 'evening'
  currentBasalRate: number,    // U/hr (from profile)
  adjustment: number,          // U/hr (positive = increase, negative = decrease)
  newBasalRate: number,        // U/hr (current + adjustment)
  confidenceScore: number,     // 0-100
  confidenceLevel: string,     // 'high', 'medium', 'low'
  reasoning: {
    avgSlope: number,          // Average slope across qualifying periods
    avgCV: number,             // Average CV across qualifying periods
    qualifyingPeriods: number, // Count of periods supporting this recommendation
    totalPeriods: number       // Total periods in this time block
  },
  supportingData: [            // Individual period data
    {
      date: string,            // ISO date
      slope: number,           // mg/dL per hour
      duration: number,        // Hours
      cv: number               // %
    }
  ],
  warnings: [string]           // Array of warning messages
}
```

### Profile Data (Input)

```javascript
{
  basalSchedule: [             // Time-based basal rates
    {
      time: string,            // "HH:MM" format
      value: number            // U/hr
    }
  ],
  isf: number,                 // Insulin sensitivity factor (mg/dL per U)
  targetRange: {               // Optional
    low: number,               // mg/dL
    high: number               // mg/dL
  }
}
```

## Error Handling

### Error Categories

1. **Data Validation Errors**
   - Missing or incomplete fasting period data
   - Invalid glucose readings (null, negative, or extreme values)
   - Missing profile data

2. **Calculation Errors**
   - Linear regression fails (insufficient data points)
   - Division by zero in statistical calculations
   - Numerical overflow/underflow

3. **Safety Errors**
   - Calculated adjustment exceeds safety limits
   - Detected hypoglycemia in data
   - Insufficient qualifying periods for recommendation

### Error Handling Strategy

```javascript
function generateRecommendation(timeBlock, periods, profileData) {
  try {
    // Validate inputs
    if (!periods || periods.length === 0) {
      return {
        timeBlock,
        error: 'NO_DATA',
        message: 'No fasting periods found for this time block',
        recommendation: 'NO CHANGE - Need more data'
      };
    }

    // Analyze each period
    const analyses = periods.map(period => {
      try {
        return analyzeperiod(period);
      } catch (error) {
        console.error('Period analysis failed:', error);
        return null;
      }
    }).filter(a => a !== null);

    if (analyses.length === 0) {
      return {
        timeBlock,
        error: 'ANALYSIS_FAILED',
        message: 'Could not analyze periods',
        recommendation: 'NO CHANGE - Analysis error'
      };
    }

    // Filter qualifying periods
    const qualifyingPeriods = analyses.filter(a => a.qualified);

    if (qualifyingPeriods.length < 2) {
      return {
        timeBlock,
        error: 'INSUFFICIENT_DATA',
        message: `Only ${qualifyingPeriods.length} qualifying period(s) found. Need at least 2 for high confidence.`,
        recommendation: 'NO CHANGE - Need more qualifying data',
        confidenceScore: Math.min(qualifyingPeriods.length * 30, 49)
      };
    }

    // Calculate recommendation
    const adjustment = calculateAdjustment(
      avgSlope(qualifyingPeriods),
      profileData.isf || 50,
      getCurrentBasalRate(timeBlock, profileData)
    );

    const confidence = calculateConfidenceScore(qualifyingPeriods, {
      totalPeriodsInTimeBlock: periods.length
    });

    return {
      timeBlock,
      adjustment,
      confidenceScore: confidence,
      // ... rest of recommendation data
    };

  } catch (error) {
    console.error('Recommendation generation failed:', error);
    return {
      timeBlock,
      error: 'UNKNOWN_ERROR',
      message: 'An unexpected error occurred',
      recommendation: 'NO CHANGE - System error'
    };
  }
}
```

### User-Facing Error Messages

```javascript
const ERROR_MESSAGES = {
  NO_DATA: 'No fasting periods found for this time of day. Try collecting more data.',
  INSUFFICIENT_DATA: 'Not enough qualifying periods for a confident recommendation. Continue monitoring.',
  HIGH_VARIABILITY: 'Glucose too variable during fasting periods. Focus on reducing variability first.',
  HYPOGLYCEMIA_DETECTED: 'Hypoglycemia detected in data. Do not increase basal rates. Consult healthcare provider.',
  MISSING_PROFILE: 'Profile data not found. Using default values. Update your Nightscout profile for personalized recommendations.',
  ANALYSIS_FAILED: 'Could not analyze fasting periods. Check data quality.',
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again or contact support.'
};
```

## Testing Strategy

The testing strategy employs both unit tests and property-based tests to ensure correctness and safety.

### Unit Testing Approach

Unit tests will focus on:
- Specific examples demonstrating correct behavior
- Edge cases (empty data, single data point, extreme values)
- Error conditions (invalid inputs, missing data)
- Integration between components

### Property-Based Testing Approach

Property-based tests will verify universal properties across randomized inputs using a JavaScript property testing library (fast-check). Each test will run a minimum of 100 iterations to ensure comprehensive coverage.

#### Property Test Configuration
- Library: fast-check (JavaScript property-based testing)
- Minimum iterations: 100 per property
- Each test tagged with: `Feature: basal-rate-optimization, Property {N}: {description}`

### Test Organization

```text
tests/
  unit/
    statistical-analysis.test.js
    safety-validation.test.js
    recommendation-engine.test.js
    ui-formatter.test.js
  property/
    basal-rate-optimizer.property.test.js
  integration/
    end-to-end.test.js
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Statistical Analysis Properties

#### Property Linear Regression Calculation Completeness**

*For any* fasting period with glucose readings, calculating linear regression should produce both a slope value and an R² value, where R² is between 0 and 1.

#### Validates: Requirements 1.1, 1.2**

#### Property Trend Classification Correctness**

*For any* calculated slope and R² value, the trend classification should be: 'rising' when slope > 5 and R² > 0.5, 'falling' when slope < -5 and R² > 0.5, and 'stable' otherwise.

#### Validates: Requirements 1.3, 1.4, 1.5**

#### Property CV Calculation**

*For any* fasting period with glucose readings, the coefficient of variation (CV%) should be calculated and should be a non-negative number.

#### Validates: Requirements 1.6**

### Time Classification Properties

#### Property Time Block Classification**

*For any* fasting period, the time block classification should be: 'overnight' when start hour is >= 22 or < 6, 'morning' when start hour is >= 6 and < 12, 'afternoon' when start hour is >= 12 and < 18, and 'evening' when start hour is >= 18 and < 22.

#### Validates: Requirements 2.1, 2.2, 2.3, 2.4**

#### Property Time Block Grouping**

*For any* collection of fasting periods, grouping by time of day should result in each period appearing in exactly one time block group, and the group should match the period's start time classification.

#### Validates: Requirements 2.5**

### Adjustment Calculation Properties

#### Property Adjustment Formula Application**

*For any* slope value, ISF value, and safety multiplier (0.3-0.5), the calculated adjustment should equal (slope / ISF) * safety_multiplier before any limits are applied.

#### Validates: Requirements 3.1, 3.3**

#### Property ISF Default Fallback**

*For any* calculation where ISF is not provided in profile data, the system should use 50 mg/dL per unit as the default ISF value.

#### Validates: Requirements 3.2**

#### Property Minimum Adjustment Threshold**

*For any* calculated adjustment with absolute value less than 0.025 U/hr, the final recommended adjustment should be 0 (no change).

#### Validates: Requirements 3.4**

#### Property New Rate Calculation**

*For any* current basal rate and adjustment value, the new recommended rate should equal the current rate plus the adjustment.

#### Validates: Requirements 3.5**

#### Property Adjustment Safety Limits**

*For any* calculated adjustment and current basal rate, the final adjustment should not exceed 0.15 U/hr in absolute value AND should not exceed 20% of the current basal rate in absolute value.

#### Validates: Requirements 3.6, 3.7**

### Confidence Scoring Properties

#### Property Confidence Score Components**

*For any* set of qualifying periods, the confidence score should be the sum of four components: duration score (max 30), stability score (max 30), trend strength score (max 20), and consistency score (max 20), resulting in a total between 0 and 100.

#### Validates: Requirements 4.1, 4.2, 4.3, 4.4**

#### Property Confidence Level Classification**

*For any* confidence score, the confidence level should be 'high' when score >= 70, 'medium' when score >= 50 and < 70, and 'low' when score < 50.

#### Validates: Requirements 4.5, 4.6, 4.7**

### Safety Validation Properties

#### Property Period Disqualification Rules**

*For any* fasting period, it should be disqualified if: duration < 4 hours, OR CV% > 30, OR contains glucose < 70 mg/dL for > 15 consecutive minutes, OR contains any glucose > 250 mg/dL.

#### Validates: Requirements 5.1, 5.2, 5.3, 5.4**

#### Property Disqualification Reason Recording**

*For any* disqualified fasting period, the disqualification result should include a non-empty reason string explaining why it was disqualified.

#### Validates: Requirements 5.5**

#### Property High Confidence Confirmation Requirement**

*For any* recommendation with confidence score >= 70, there should be at least 2 qualifying periods with the same trend direction (same sign of slope) from different calendar days.

#### Validates: Requirements 6.1, 6.2, 6.3**

#### Property Confidence Capping for Insufficient Periods**

*For any* time block with fewer than 2 qualifying periods, the maximum confidence score should be capped at 69.

#### Validates: Requirements 6.4**

### Recommendation Generation Properties

#### Property Recommendation Completeness**

*For any* generated recommendation for a time block, it should include all required fields: current basal rate, adjustment magnitude and direction, new basal rate value, confidence score, explanatory reasoning, and supporting data.

#### Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6**

#### Property Insufficient Data Handling**

*For any* time block with insufficient qualifying data (< 2 periods or all disqualified), the recommendation should be "NO CHANGE" with an explanation of why more data is needed.

#### Validates: Requirements 7.7**

### UI Integration Properties

#### Property Medical Disclaimer Presence**

*For any* generated recommendations display, the output should contain the medical disclaimer text stating recommendations are not medical advice.

#### Validates: Requirements 8.2**

#### Property Confidence Color Coding**

*For any* recommendation display, the color coding should be green when confidence >= 70, yellow when confidence >= 50 and < 70, and red when confidence < 50.

#### Validates: Requirements 8.3**

#### Property Metadata Display**

*For any* recommendations display, it should show the total number of fasting periods analyzed and the date range of the analysis.

#### Validates: Requirements 8.4**

#### Property Supporting Data Formatting**

*For any* recommendation with supporting data, each qualifying period should be formatted to show date, slope, duration, and CV%.

#### Validates: Requirements 8.5**

#### Property Safety Tips Inclusion**

*For any* recommendations display, it should include practical tips for implementing basal rate changes safely.

#### Validates: Requirements 8.6**

### Export Properties

#### Property Export Disclaimer Inclusion**

*For any* exported recommendations (PDF or CSV), the export should include the medical disclaimer text.

#### Validates: Requirements 9.3**

#### Property Export Metadata Inclusion**

*For any* exported recommendations, the export should include the analysis date range and total number of periods analyzed.

#### Validates: Requirements 9.4**

### Profile Integration Properties

#### Property Profile Data Reading**

*For any* analysis with available profile data, the system should read and use the basal rate schedule and ISF value from the profile.

#### Validates: Requirements 10.1, 10.2**

#### Property Profile Data Fallback with Warning**

*For any* analysis with unavailable or incomplete profile data, the system should use default values AND display a warning to the user about using defaults.

#### Validates: Requirements 10.3**

#### Property Basal Rate Segment Selection**

*For any* fasting period in a time block with multiple basal rate segments, the system should use the basal rate that is active at the start time of the fasting period.

#### Validates: Requirements 10.4**

### Error Handling Properties

#### Property Near-Hypoglycemia Warning**

*For any* fasting period with glucose trending toward 70 mg/dL (within 10 mg/dL), the recommendation should include a warning to monitor closely after any rate increase.

#### Validates: Requirements 11.1**

#### Property Insufficient Data Messaging**

*For any* time block with insufficient data for a recommendation, the display should include a message indicating more data is needed.

#### Validates: Requirements 11.2**

#### Property Missing Profile Warning**

*For any* analysis where profile data is missing or incomplete, the display should include a warning that default values are being used.

#### Validates: Requirements 11.3**

#### Property Calculation Error Handling**

*For any* calculation that encounters an error (division by zero, invalid input), the system should log the error and display a user-friendly message indicating the recommendation could not be generated.

#### Validates: Requirements 11.4**

#### Property Implementation Safety Warning**

*For any* displayed recommendation, it should include a warning to test one time period at a time and wait 2-3 days between adjustments.

#### Validates: Requirements 11.5**
