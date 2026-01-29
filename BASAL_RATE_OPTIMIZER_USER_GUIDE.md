# Basal Rate Optimizer - User Guide

## Overview

The Basal Rate Optimizer is an advanced feature in Nightscout that analyzes your glucose data during fasting periods to provide data-driven recommendations for adjusting your basal insulin rates. It uses statistical analysis and accounts for automated insulin delivery (temp basals, SMBs) to identify whether your programmed basal rates are appropriately set.

**⚠️ IMPORTANT: These are data-driven suggestions, NOT medical advice. Always consult with your healthcare provider before making any changes to your insulin therapy.**

---

## How It Works

### 1. Fasting Period Detection

The system automatically identifies fasting periods in your data by looking for:
- Time intervals with no carbohydrate intake (at least 2 hours after last meal)
- Minimal correction boluses
- Sufficient duration (minimum 4 hours for analysis)
- Adequate CGM data coverage

Fasting periods are ideal for basal rate analysis because:
- No food is being digested (no carb impact)
- Insulin on board is minimal
- Glucose changes reflect basal insulin effectiveness

### 2. Glucose Trend Analysis

For each qualifying fasting period, the system calculates:

**Linear Regression:**
- Fits a line through your glucose readings
- Calculates the slope (rate of change in mg/dL per hour)
- Measures R² (how well the line fits the data, 0-1 scale)

**Trend Classification:**
- **Rising**: Slope > +5 mg/dL/hr AND R² > 0.5
- **Falling**: Slope < -5 mg/dL/hr AND R² > 0.5  
- **Stable**: |Slope| ≤ 5 mg/dL/hr OR R² ≤ 0.5

**Glucose Variability (CV%):**
- Coefficient of Variation = (Standard Deviation / Mean) × 100
- Measures glucose stability during the period
- Lower CV% = more stable glucose = more reliable for basal testing

### 3. Automated Insulin Delivery Accounting

**This is a critical feature that sets this tool apart.**

The system analyzes treatment data during each fasting period to calculate:

```
Programmed Insulin = Basal Rate × Duration
Actual Insulin = Temp Basals + SMBs + Programmed Basal
Extra Insulin = Actual Insulin - Programmed Insulin
```

**Why this matters:**

If your glucose is stable or rising DESPITE receiving extra insulin from automation (temp basals, SMBs), it means your **base basal rate is too low**. The automation is compensating for an inadequate basal rate.

**Example:**
- Overnight period: 8 hours
- Programmed basal: 1.0 U/hr = 8.0 U total
- Actual delivery: 10.5 U (temp basals + SMBs)
- Extra insulin: 2.5 U = 0.31 U/hr extra
- Glucose: Stable at 120 mg/dL

**Interpretation:** You needed an extra 0.31 U/hr to maintain stable glucose, so your basal rate should be increased by approximately that amount.

### 4. Adjustment Calculation

The system calculates recommended adjustments using this formula:

```
Base Adjustment = (Slope / ISF) × Safety Multiplier
Automation Adjustment = Extra Insulin Per Hour (if glucose not falling)
Total Adjustment = Base Adjustment + Automation Adjustment
```

**Components:**

- **Slope**: Rate of glucose change (mg/dL per hour)
- **ISF**: Insulin Sensitivity Factor (how much 1 unit drops glucose)
  - Read from your Nightscout profile
  - Default: 50 mg/dL per unit if not set
- **Safety Multiplier**: 0.75 (makes recommendations conservative)
- **Automation Adjustment**: Accounts for extra insulin delivered

**Logic:**

1. **If glucose rising/stable + extra insulin delivered:**
   - Add full automation adjustment
   - Basal rate is too low; automation is compensating

2. **If glucose falling + extra insulin delivered:**
   - Add 50% of automation adjustment
   - Be conservative; fall might be from automation

3. **If no automation detected:**
   - Use only base adjustment from slope

### 5. Safety Limits

All calculated adjustments are capped by multiple safety limits:

**Minimum Threshold: 0.05 U/hr**
- Adjustments smaller than this are set to zero
- Prevents insignificant micro-adjustments

**Percentage Limit: 40% of Current Basal Rate**
- Maximum adjustment is 40% of your current rate
- Example: 1.0 U/hr basal → max ±0.40 U/hr adjustment
- Prevents excessive changes relative to current settings

**Absolute Limit: 60% of TDD / 24 hours**
- Based on your Total Daily Dose of insulin
- Calculated from actual insulin delivery over the analysis period
- Scales with your individual insulin needs
- Example: 50 U/day TDD → (50 × 0.60) / 24 = 1.25 U/hr max

**The most restrictive limit applies.**

### 6. Period Qualification

Fasting periods must pass strict safety checks to be used for recommendations:

**Disqualification Rules:**

1. **Duration < 4 hours**
   - Not enough time to assess basal effectiveness
   
2. **CV% > 30%**
   - Too much glucose variability
   - Indicates other factors affecting glucose
   
3. **Hypoglycemia detected**
   - Any glucose < 70 mg/dL for > 15 consecutive minutes
   - Safety concern; period not reliable
   
4. **Hyperglycemia detected**
   - Any glucose reading > 250 mg/dL
   - Indicates other issues (illness, pump failure, etc.)

### 7. Confidence Scoring

Each recommendation receives a confidence score (0-100) based on:

**Duration Factor (30 points max):**
- Longer fasting periods = more reliable
- Score = min(Duration / 6 hours, 1.0) × 30
- 6+ hour periods get full points

**Stability Factor (30 points max):**
- Lower CV% = more stable = more reliable
- Score = (1 - CV% / 40) × 30
- CV% < 20% gets near-full points

**Trend Strength (20 points max):**
- Higher R² = stronger trend = more reliable
- Score = R² × 20
- R² > 0.8 gets near-full points

**Consistency Factor (20 points max):**
- Multiple periods showing same trend = more reliable
- Score = (Matching Periods / Total Periods) × 20
- All periods agreeing gets full points

**Confidence Levels:**
- **High (70-100)**: Strong recommendation, multiple confirming periods
- **Medium (50-69)**: Moderate recommendation, some uncertainty
- **Low (0-49)**: Weak recommendation, limited or conflicting data

**Multi-Period Confirmation:**
- High confidence requires ≥2 qualifying periods from different days
- All periods must show the same trend direction
- Prevents recommendations based on isolated incidents

---

## Time-of-Day Blocks

Recommendations are organized by time of day because basal needs vary throughout the day:

- **Overnight (10 PM - 6 AM)**: Most reliable for basal testing
- **Morning (6 AM - 12 PM)**: Dawn phenomenon may affect
- **Afternoon (12 PM - 6 PM)**: Activity levels vary
- **Evening (6 PM - 10 PM)**: Pre-bedtime period

Each block is analyzed independently with its own recommendation.

---

## How to Use

### Step 1: Access the Feature

1. Open Nightscout Reports
2. Select "Day to Day" report
3. Choose date range (7-30 days recommended)
4. Enable "Fasting periods" checkbox
5. Click "SHOW" to generate report

### Step 2: Review Fasting Periods

Scroll to the "Fasting Periods Analysis" section to see:
- Total fasting periods found
- Quality ratings (excellent, good, fair)
- Glucose stability metrics for each period

**Look for:**
- Periods with low CV% (<20% is excellent)
- High time in range (>80%)
- Stable trends
- Adequate duration (6+ hours ideal)

### Step 3: Review Recommendations

The "Basal Rate Optimization Recommendations" section shows:

**For each time block:**
- Current basal rate
- Recommended adjustment (if any)
- New basal rate
- Confidence score and level (color-coded)
- Supporting data from individual periods
- Warnings and considerations

**Color Coding:**
- 🟢 **Green (High Confidence)**: Strong recommendation, prioritize these
- 🟡 **Yellow (Medium Confidence)**: Moderate recommendation, consider carefully
- 🔴 **Red (Low Confidence)**: Weak recommendation, may need more data

### Step 4: Export Data

**CSV Export:**
- Click "Export to CSV" button
- Opens in Excel/Google Sheets
- Includes all recommendations and supporting data
- Share with healthcare provider

**PDF Export:**
- Click "Export to PDF" button
- Opens print dialog
- Choose "Save as PDF"
- Formatted for easy reading and sharing

### Step 5: Implement Changes Safely

**⚠️ CRITICAL SAFETY GUIDELINES:**

1. **Consult Your Healthcare Provider First**
   - Review recommendations with your doctor or diabetes educator
   - Get approval before making changes
   - Discuss your individual circumstances

2. **Test One Time Period at a Time**
   - Only adjust one basal rate segment at a time
   - This allows you to clearly see the effect of each change
   - Don't change multiple segments simultaneously

3. **Wait 2-3 Days Between Adjustments**
   - Give your body time to adjust
   - Collect enough data to assess the change
   - Don't rush the process

4. **Start with High-Confidence Recommendations**
   - Prioritize green (high confidence) recommendations
   - These have the strongest supporting data
   - Be more cautious with yellow or red recommendations

5. **Be Conservative**
   - Consider making smaller adjustments than recommended
   - You can always increase more later
   - It's safer to under-adjust than over-adjust

6. **Monitor Closely for Hypoglycemia**
   - Watch for low blood sugar, especially after rate increases
   - Have fast-acting carbs readily available
   - Consider temporary lower targets initially

7. **Keep Detailed Notes**
   - Document all changes in your diabetes management app
   - Note the date, time block, old rate, new rate
   - Track observed effects over the following days

8. **Verify with Basal Testing**
   - After making changes, do traditional basal testing
   - Skip meals and monitor glucose for 4-6 hours
   - Confirm the new rate keeps glucose stable

---

## Understanding the Math

### Example Calculation

**Scenario:**
- Overnight fasting period: 8 hours
- Average glucose slope: +10 mg/dL/hr (rising)
- ISF: 50 mg/dL per unit
- Current basal rate: 1.0 U/hr
- Extra insulin from automation: 2.4 U over 8 hours = 0.30 U/hr

**Step 1: Base Adjustment**
```
Base Adjustment = (Slope / ISF) × Safety Multiplier
Base Adjustment = (10 / 50) × 0.75
Base Adjustment = 0.20 × 0.75
Base Adjustment = 0.15 U/hr
```

**Step 2: Automation Adjustment**
```
Since glucose is rising (slope > -5), add full automation adjustment:
Automation Adjustment = 0.30 U/hr
```

**Step 3: Total Adjustment**
```
Total Adjustment = Base Adjustment + Automation Adjustment
Total Adjustment = 0.15 + 0.30
Total Adjustment = 0.45 U/hr
```

**Step 4: Apply Safety Limits**
```
TDD = 50 U/day
Absolute Limit = (50 × 0.60) / 24 = 1.25 U/hr ✓ (not exceeded)
Percentage Limit = 1.0 × 0.40 = 0.40 U/hr ✗ (exceeded!)

Final Adjustment = 0.40 U/hr (capped by percentage limit)
```

**Step 5: Calculate New Rate**
```
New Basal Rate = Current Rate + Adjustment
New Basal Rate = 1.0 + 0.40
New Basal Rate = 1.40 U/hr
```

**Recommendation:** INCREASE by 0.40 U/hr (from 1.0 to 1.40 U/hr)

---

## Interpreting Results

### High Confidence, Increase Recommended

**What it means:**
- Multiple fasting periods show glucose rising
- Automation is delivering extra insulin to compensate
- Your basal rate is too low for this time period

**Action:**
- Strong recommendation to increase basal rate
- Consult healthcare provider
- Implement change carefully with monitoring

### High Confidence, Decrease Recommended

**What it means:**
- Multiple fasting periods show glucose falling
- Little to no extra insulin from automation
- Your basal rate is too high for this time period

**Action:**
- Strong recommendation to decrease basal rate
- Consult healthcare provider
- Monitor closely for hyperglycemia after change

### Medium/Low Confidence

**What it means:**
- Limited data or conflicting trends
- High glucose variability
- May need more fasting periods for reliable recommendation

**Action:**
- Collect more data before making changes
- Review individual period details
- Consider other factors (illness, stress, activity)

### No Change Recommended

**What it means:**
- Glucose is stable during fasting periods
- Minimal extra insulin from automation
- Current basal rate appears appropriate

**Action:**
- No adjustment needed for this time block
- Continue monitoring
- Reassess if patterns change

---

## Troubleshooting

### "No qualifying fasting periods found"

**Possible causes:**
- Periods too short (< 4 hours)
- High glucose variability (CV% > 30%)
- Hypoglycemia or hyperglycemia present
- Not enough meal-free time in data

**Solutions:**
- Extend date range to capture more days
- Review fasting period details to see disqualification reasons
- Ensure adequate meal-free periods (skip snacks)
- Check for data quality issues

### "All periods showing 0 confidence"

**Possible causes:**
- Missing glucose readings data
- Data validation failures
- Software version mismatch

**Solutions:**
- Ensure you're running the latest version
- Check browser console for errors
- Verify CGM data is uploading correctly
- Contact support if issue persists

### Recommendations seem too aggressive/conservative

**Adjustable parameters:**
- Safety multiplier (currently 0.75)
- Percentage limit (currently 40%)
- Absolute limit formula (currently 60% TDD / 24h)
- Minimum threshold (currently 0.05 U/hr)

**Note:** These are configured in the code and require developer access to modify.

### Conflicting recommendations over time

**This is normal:**
- Insulin needs change with seasons, activity, stress, illness
- Hormonal cycles affect insulin sensitivity
- Weight changes impact insulin requirements

**Action:**
- Use most recent data (last 7-14 days)
- Consider current life circumstances
- Reassess regularly (monthly or when patterns change)

---

## Technical Details

### Data Requirements

**Minimum:**
- 7 days of CGM data
- Treatment data (carbs, insulin)
- At least 2 qualifying fasting periods per time block

**Optimal:**
- 14-30 days of data
- 3+ qualifying fasting periods per time block
- Complete CGM coverage (>80% of time)
- Accurate carb and insulin logging

### Calculation Precision

- All rates rounded to 0.05 U/hr (typical pump increment)
- Slopes rounded to 0.01 mg/dL/hr
- CV% rounded to 0.1%
- Confidence scores rounded to nearest integer

### Profile Data Integration

The system reads from your Nightscout profile:
- Basal rate schedule (all segments)
- ISF (Insulin Sensitivity Factor)
- Target glucose range (for time-in-range calculations)

**If profile data is missing:**
- Default ISF: 50 mg/dL per unit
- Default basal rate: 1.0 U/hr
- Warning displayed in recommendations

### Automation Detection

The system detects automated insulin delivery from:
- **Temp Basals**: Rate adjustments from Loop/AAPS/OpenAPS
- **SMBs**: Super Micro Boluses from advanced algorithms
- **Correction Boluses**: Manual or automated corrections

**Treatment data analyzed:**
- Event type: "Temp Basal"
- Rate and duration fields
- Insulin/bolus amounts (excluding meal boluses)

---

## Limitations

### What This Tool Does NOT Account For

1. **Exercise and Activity**
   - Physical activity affects insulin sensitivity
   - May cause glucose drops unrelated to basal rates
   - Consider excluding exercise days from analysis

2. **Illness and Stress**
   - Increases insulin resistance
   - Temporary changes, not indicative of basal needs
   - Exclude sick days from analysis

3. **Hormonal Cycles**
   - Menstrual cycles affect insulin sensitivity
   - May need different basal rates at different cycle phases
   - Consider analyzing by cycle phase

4. **Alcohol Consumption**
   - Affects glucose metabolism
   - Can cause delayed hypoglycemia
   - Exclude periods after alcohol consumption

5. **Site Changes and Pump Issues**
   - New infusion sites may absorb differently
   - Pump malfunctions affect insulin delivery
   - Exclude days with site/pump issues

6. **Medication Changes**
   - Steroids, beta blockers, etc. affect insulin needs
   - Temporary adjustments may be needed
   - Consult healthcare provider

### When NOT to Use This Tool

- During illness or infection
- After major life changes (new job, schedule change)
- During pregnancy (insulin needs change rapidly)
- If you have frequent hypoglycemia unawareness
- If your diabetes management is unstable
- Without healthcare provider supervision

---

## Frequently Asked Questions

### Q: How often should I run this analysis?

**A:** Monthly, or when you notice patterns changing. More frequently if actively adjusting basal rates.

### Q: Can I trust the recommendations?

**A:** The recommendations are data-driven and use proven statistical methods, BUT they are not medical advice. Always review with your healthcare provider before making changes.

### Q: Why do I need multiple fasting periods?

**A:** One period could be an outlier due to various factors. Multiple periods showing the same trend provide confidence that the pattern is real and not coincidental.

### Q: What if morning and overnight recommendations conflict?

**A:** This is common due to dawn phenomenon. Your basal needs may genuinely differ between these periods. Adjust each time block independently.

### Q: Should I adjust all time blocks at once?

**A:** NO. Only adjust one time block at a time, wait 2-3 days, assess the results, then move to the next time block if needed.

### Q: What if I'm using Loop/AAPS/OpenAPS?

**A:** This tool is ESPECIALLY valuable for closed-loop users because it accounts for the extra insulin your system is delivering. If your system is constantly giving temp basals or SMBs, your base basal rate likely needs adjustment.

### Q: Can I use this for pump basal testing?

**A:** Yes, but this is a complement to, not a replacement for, traditional basal testing. Use this to identify which time blocks need attention, then verify with traditional basal testing.

### Q: What's the difference between this and traditional basal testing?

**A:** Traditional basal testing requires skipping meals and monitoring glucose for 4-6 hours. This tool analyzes your existing data to identify patterns without requiring special testing days. It also accounts for automated insulin delivery, which traditional testing doesn't.

---

## Version History

- **v2.1-TDD-BASED-LIMITS**: TDD-based safety limits, increased percentage limit to 40%
- **v2.0-INSULIN-DELIVERY-ACCOUNTING**: Added automation insulin delivery accounting
- **v1.1-GLUCOSE-READINGS-FIX**: Fixed glucose readings array in fasting periods
- **v1.0-DEBUG-QUALIFICATION**: Initial release with debug logging

---

## Support and Feedback

For issues, questions, or feedback:
- Check Nightscout documentation
- Post in Nightscout community forums
- Report bugs on GitHub
- Consult your healthcare provider for medical questions

---

## Disclaimer

This tool is provided for informational purposes only and is not a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or other qualified health provider with any questions you may have regarding your diabetes management. Never disregard professional medical advice or delay in seeking it because of something you have read in this tool's output.

The recommendations generated by this tool are based on statistical analysis of your glucose data and may not account for all factors affecting your insulin needs. Your healthcare provider should review and approve any changes to your insulin therapy based on your individual medical situation, history, and other factors not captured in this analysis.

---

**Last Updated:** January 28, 2026
