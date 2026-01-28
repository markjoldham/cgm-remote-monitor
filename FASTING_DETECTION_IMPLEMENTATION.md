# Fasting Period Detection Algorithm Implementation

## Overview
I've successfully implemented a comprehensive Fasting Period Detection Algorithm for Nightscout that identifies periods when users are likely fasting (no food intake) to enable basal rate analysis during insulin-only periods.

## Files Created/Modified

### 1. Core Algorithm: `lib/report_plugins/fasting-detection.js`
**Features:**
- Detects fasting periods based on treatment data (carbs, insulin)
- Analyzes glucose stability during fasting periods
- Classifies periods by type (overnight, morning, afternoon, evening)
- Scores periods for quality (excellent, good, fair, poor)
- Configurable thresholds for carbs, insulin, duration, etc.

**Key Functions:**
- `detectFastingPeriods()` - Main detection algorithm
- `calculateGlucoseStats()` - Analyzes glucose stability and trends
- `scoreFastingPeriods()` - Ranks periods by usefulness for basal testing
- `classifyPeriodType()` - Identifies optimal testing times

### 2. Report Integration: `lib/report_plugins/daytoday.js`
**Enhancements:**
- Added "Fasting periods" checkbox option
- Integrated fasting detection into Day to Day report
- Visual overlays on charts showing fasting periods
- Detailed summary with best periods for basal testing
- Color-coded quality indicators (purple shades)
- Interactive tooltips with period details

### 3. Main Display Plugin: `lib/plugins/fasting.js`
**Features:**
- Real-time fasting status pill in main interface
- Shows current fasting duration
- Color-coded quality indication
- Notifications for excellent fasting periods
- Configurable alert thresholds

### 4. Plugin Registration: `lib/plugins/index.js`
- Added fasting plugin to both client and server default plugins
- Enables automatic loading and initialization

### 5. Translations: `translations/en/en.json`
- Added comprehensive English translations for all fasting-related text
- Includes labels, descriptions, and quality indicators

## Algorithm Logic

### Fasting Detection Criteria:
1. **Time since last significant treatment** (>2 hours)
2. **Carb threshold** (default: >5g breaks fasting)
3. **Bolus threshold** (default: >0.5U with carbs breaks fasting)
4. **Minimum duration** (default: 3 hours)
5. **Maximum duration** (default: 12 hours)

### Quality Assessment:
- **Excellent**: 6+ hours overnight with CV <20% and high time in range
- **Good**: 4+ hours with CV 20-30% and good stability
- **Fair**: 3+ hours with CV 30-40% or moderate stability
- **Poor**: <3 hours or CV >40% (high glucose variability)

### Glucose Stability Metrics:
- **CV (Coefficient of Variation)**: Industry standard for glucose variability (StdDev/Mean × 100)
  - Excellent: <20%
  - Good: 20-30%
  - Fair: 30-40%
  - Poor: >40%
- **Time in Range**: Percentage of readings between 70-180 mg/dL
- **Trend Analysis**: Rising, falling, or stable glucose patterns
- **Rate of Change**: mg/dL per hour during the period
- **Quality Score**: 0-100 composite score for basal testing suitability
  - Factors: CV (40%), Time in Range (30%), Trend stability (20%), Duration (10%)

### Period Classification:
- **Overnight** (22:00-08:00): Most valuable for basal testing
- **Morning** (06:00-12:00): Good for dawn phenomenon analysis
- **Afternoon** (12:00-18:00): Useful for midday basal rates
- **Evening** (18:00-22:00): Evening basal assessment

## Visual Features

### Day to Day Report:
- **Chart overlays**: Colored background areas showing fasting periods
- **Quality indicators**: Different colors/patterns for quality levels
- **Labels**: Duration labels on high-quality periods
- **Tooltips**: Detailed information on hover
- **Summary panel**: Best periods listed with statistics

### Main Display:
- **Fasting pill**: Shows current fasting status and duration
- **Color coding**: Green (excellent), Blue (good), Orange (fair), Red (poor)
- **Notifications**: Alerts for optimal basal testing opportunities

## Configuration Options

### Report Level:
- `minFastingDuration`: Minimum hours to consider fasting (default: 3)
- `maxFastingDuration`: Maximum hours to analyze (default: 12)
- `carbThreshold`: Carbs that break fasting (default: 5g)
- `bolusThreshold`: Bolus that breaks fasting (default: 0.5U)
- `glucoseStabilityThreshold`: Max variation for stability (default: 30 mg/dL)

### Plugin Level:
- `enableAlerts`: Enable notifications (default: false)
- `warn`: Warning threshold (default: 30)
- `urgent`: Urgent threshold (default: 60)

## Benefits for Diabetics

### Basal Rate Optimization:
1. **Identifies optimal testing periods** automatically
2. **Reduces guesswork** in basal rate analysis
3. **Provides quality metrics** for period selection
4. **Highlights overnight periods** (most important for basal testing)

### Clinical Value:
1. **Evidence-based basal adjustments** using stable periods with low CV
2. **Dawn phenomenon detection** through morning fasting analysis
3. **Comprehensive glucose stability metrics** including CV, time in range, and trends
4. **Historical trend analysis** across multiple days
5. **Quality scoring** helps identify most reliable periods for basal testing
6. **Rate of change analysis** detects subtle basal inadequacies

### User Experience:
1. **Visual indicators** make fasting periods obvious
2. **Automated detection** requires no manual tracking
3. **Quality scoring** helps prioritize which periods to analyze
4. **Real-time status** shows current fasting state

## Usage Instructions

### Enabling in Reports:
1. Go to Reports → Day to Day
2. Check "Fasting periods" option
3. Click "Show" to generate report
4. Look for purple-shaded areas on charts
5. Review summary panel for best testing periods

### Main Display:
1. Fasting plugin loads automatically if enabled
2. Look for "FASTING" pill in minor pills area
3. Shows duration and quality color-coding
4. Click for detailed information

### Optimal Usage:
1. **Review overnight periods** (22:00-08:00) for primary basal testing
2. **Look for "excellent" quality periods** (6+ hours, CV <20%)
3. **Use glucose stability metrics** to assess basal adequacy:
   - CV <20% indicates excellent basal control
   - Time in range >80% is ideal
   - Stable trend (not rising/falling) suggests appropriate basal rates
   - Quality score >70 indicates highly reliable period
4. **Compare multiple days** to identify patterns
5. **Focus on periods with <30 mg/dL glucose range** for best analysis
6. **Check rate of change** - should be near 0 mg/dL/hr for proper basal rates

## Technical Implementation

### Algorithm Efficiency:
- **15-minute scanning intervals** for performance
- **Binary search** for treatment lookups
- **Caching** for repeated calculations
- **Configurable thresholds** for customization

### Data Requirements:
- **CGM data**: Continuous glucose readings
- **Treatment data**: Carbs, insulin, timestamps
- **Minimum 6 readings** per period for analysis
- **24+ hours of data** for meaningful results

This implementation provides Nightscout users with a powerful tool for identifying optimal periods for basal rate analysis, making diabetes management more data-driven and effective.

## Glucose Stability Analysis Details

### Coefficient of Variation (CV%)
The CV is the gold standard metric for assessing glucose variability in diabetes management. It's calculated as:
```
CV% = (Standard Deviation / Mean) × 100
```

**Clinical Interpretation:**
- **<20%**: Excellent glucose stability - ideal for basal testing
- **20-30%**: Good stability - acceptable for basal analysis
- **30-40%**: Fair stability - may indicate basal adjustments needed
- **>40%**: Poor stability - not reliable for basal testing

### Time in Range (TIR)
Percentage of glucose readings within the target range of 70-180 mg/dL during the fasting period.

**Clinical Significance:**
- **>80%**: Excellent - basal rates are likely appropriate
- **60-80%**: Good - minor adjustments may be beneficial
- **<60%**: Poor - basal rates likely need adjustment

### Trend Analysis
Compares the first third vs. last third of the fasting period to detect overall glucose direction:
- **Stable**: Change <15 mg/dL - indicates appropriate basal rates
- **Rising**: Change >15 mg/dL upward - may need increased basal
- **Falling**: Change >15 mg/dL downward - may need decreased basal

### Rate of Change
Measures glucose change per hour during the fasting period:
- **Near 0 mg/dL/hr**: Ideal - basal rates are appropriate
- **+5 to +15 mg/dL/hr**: Mild rise - consider small basal increase
- **-5 to -15 mg/dL/hr**: Mild fall - consider small basal decrease
- **>±15 mg/dL/hr**: Significant trend - basal adjustment likely needed

### Quality Score Algorithm
Composite score (0-100) weighing multiple factors:
- **CV Score (40%)**: Lower CV = higher score
- **Time in Range (30%)**: Higher TIR = higher score
- **Trend Stability (20%)**: Stable trend = higher score
- **Duration (10%)**: Longer period = higher score

**Score Interpretation:**
- **>70**: Excellent for basal testing - high confidence
- **50-70**: Good for basal testing - moderate confidence
- **<50**: Fair/poor - use with caution or find better period

### Visual Indicators
The Day to Day report uses color coding to quickly identify quality:
- **Green**: Excellent CV (<20%)
- **Blue**: Good CV (20-30%)
- **Orange**: Fair CV (30-40%)
- **Red**: Poor CV (>40%)

### Educational Display
The report includes a comprehensive metrics table explaining:
- What each metric measures
- Ideal values for basal testing
- How to interpret the results
- Clinical significance of each measurement

This detailed analysis empowers users to make informed decisions about basal rate adjustments based on objective, quantifiable glucose stability metrics.