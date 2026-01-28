# Requirements Document

## Introduction

The Basal Rate Optimization feature provides intelligent, safety-focused recommendations for basal insulin rate adjustments based on statistical analysis of fasting period glucose data from Nightscout CGM systems. This feature analyzes glucose trends during periods when no food is being digested (fasting periods) to identify whether basal insulin rates are appropriately set. The system uses linear regression and statistical confidence measures to recommend specific rate adjustments while prioritizing user safety through conservative recommendations and multiple validation checks.

Target users are people with Type 1 diabetes using insulin pumps who want data-driven insights to optimize their basal insulin therapy in consultation with their healthcare providers.

## Glossary

- **Basal_Rate_Optimizer**: The system component that analyzes fasting period data and generates basal rate recommendations
- **Fasting_Period**: A time interval where the user has not consumed food, identified by the existing fasting detection system
- **Glucose_Trend**: The direction and rate of glucose change over time (rising, falling, or stable)
- **Linear_Regression**: Statistical method to calculate the line of best fit through glucose data points
- **R_Squared**: Statistical measure (0 to 1) indicating how well the linear regression fits the data
- **Slope**: Rate of glucose change measured in mg/dL per hour
- **Confidence_Score**: Numerical score (0-100) indicating reliability of a recommendation
- **ISF**: Insulin Sensitivity Factor - how much one unit of insulin lowers blood glucose (mg/dL per unit)
- **Basal_Rate**: Amount of background insulin delivered per hour by an insulin pump (units per hour)
- **Profile_Data**: User's insulin pump settings including basal rates and ISF values
- **Time_Block**: One of four daily periods: overnight (10 PM - 6 AM), morning (6 AM - 12 PM), afternoon (12 PM - 6 PM), evening (6 PM - 10 PM)
- **CV_Percent**: Coefficient of Variation - measure of glucose variability expressed as percentage
- **Hypoglycemia**: Blood glucose below 70 mg/dL
- **Hyperglycemia**: Blood glucose above 250 mg/dL
- **Safety_Multiplier**: Conservative factor (0.3 to 0.5) applied to calculated adjustments to ensure recommendations are cautious

## Requirements

### Requirement 1: Statistical Trend Analysis

**User Story:** As a person with diabetes, I want the system to analyze my glucose trends during fasting periods, so that I can understand whether my basal rates are causing glucose to rise or fall.

#### Acceptance Criteria for Requirement 1

1. WHEN a fasting period contains glucose readings, THE Basal_Rate_Optimizer SHALL calculate the Slope using Linear_Regression
2. WHEN Linear_Regression is calculated, THE Basal_Rate_Optimizer SHALL compute the R_Squared value to measure trend strength
3. WHEN Slope is greater than +5 mg/dL per hour AND R_Squared is greater than 0.5, THE Basal_Rate_Optimizer SHALL classify the Glucose_Trend as rising
4. WHEN Slope is less than -5 mg/dL per hour AND R_Squared is greater than 0.5, THE Basal_Rate_Optimizer SHALL classify the Glucose_Trend as falling
5. WHEN the absolute value of Slope is less than or equal to 5 mg/dL per hour OR R_Squared is less than or equal to 0.5, THE Basal_Rate_Optimizer SHALL classify the Glucose_Trend as stable
6. WHEN analyzing a Fasting_Period, THE Basal_Rate_Optimizer SHALL calculate the CV_Percent to measure glucose variability

### Requirement 2: Time-of-Day Classification

**User Story:** As a person with diabetes, I want recommendations organized by time of day, so that I can adjust the specific basal rate segments that need modification.

#### Acceptance Criteria for Requirement 2

1. WHEN a Fasting_Period starts between 10 PM and 6 AM, THE Basal_Rate_Optimizer SHALL classify it as overnight Time_Block
2. WHEN a Fasting_Period starts between 6 AM and 12 PM, THE Basal_Rate_Optimizer SHALL classify it as morning Time_Block
3. WHEN a Fasting_Period starts between 12 PM and 6 PM, THE Basal_Rate_Optimizer SHALL classify it as afternoon Time_Block
4. WHEN a Fasting_Period starts between 6 PM and 10 PM, THE Basal_Rate_Optimizer SHALL classify it as evening Time_Block
5. WHEN generating recommendations, THE Basal_Rate_Optimizer SHALL group Fasting_Period data by Time_Block

### Requirement 3: Basal Rate Adjustment Calculation

**User Story:** As a person with diabetes, I want specific basal rate adjustment recommendations with clear magnitudes, so that I know exactly how much to change my pump settings.

#### Acceptance Criteria for Requirement 3

1. WHEN calculating a basal rate adjustment, THE Basal_Rate_Optimizer SHALL use the formula: adjustment = (Slope / ISF) * Safety_Multiplier
2. WHEN ISF is not available in Profile_Data, THE Basal_Rate_Optimizer SHALL use a default value of 50 mg/dL per unit
3. WHEN calculating adjustments, THE Basal_Rate_Optimizer SHALL use a Safety_Multiplier between 0.3 and 0.5
4. WHEN the calculated adjustment is less than 0.025 units per hour, THE Basal_Rate_Optimizer SHALL recommend no change
5. WHEN Profile_Data contains current Basal_Rate for the Time_Block, THE Basal_Rate_Optimizer SHALL calculate the new recommended rate by adding the adjustment to the current rate
6. WHEN the calculated adjustment magnitude exceeds 0.15 units per hour, THE Basal_Rate_Optimizer SHALL limit the adjustment to 0.15 units per hour
7. WHEN the calculated adjustment exceeds 20 percent of the current Basal_Rate, THE Basal_Rate_Optimizer SHALL limit the adjustment to 20 percent of the current Basal_Rate

### Requirement 4: Confidence Score Calculation

**User Story:** As a person with diabetes, I want to know how confident the system is in each recommendation, so that I can prioritize which adjustments to make first.

#### Acceptance Criteria for Requirement 4

1. WHEN calculating Confidence_Score, THE Basal_Rate_Optimizer SHALL award up to 30 points based on Fasting_Period duration (minimum of duration_hours divided by 6, maximum of 1.0)
2. WHEN calculating Confidence_Score, THE Basal_Rate_Optimizer SHALL award up to 30 points based on glucose stability using the formula: (1 - CV_Percent / 40) * 30
3. WHEN calculating Confidence_Score, THE Basal_Rate_Optimizer SHALL award up to 20 points based on R_Squared value
4. WHEN calculating Confidence_Score, THE Basal_Rate_Optimizer SHALL award up to 20 points based on consistency across multiple periods using the formula: (matching_periods / total_periods) * 20
5. WHEN Confidence_Score is between 70 and 100, THE Basal_Rate_Optimizer SHALL classify the recommendation as high confidence
6. WHEN Confidence_Score is between 50 and 69, THE Basal_Rate_Optimizer SHALL classify the recommendation as medium confidence
7. WHEN Confidence_Score is between 0 and 49, THE Basal_Rate_Optimizer SHALL classify the recommendation as low confidence

### Requirement 5: Safety Validation - Period Disqualification

**User Story:** As a person with diabetes, I want the system to exclude unreliable data from recommendations, so that I receive only safe and trustworthy guidance.

#### Acceptance Criteria for Requirement 5

1. WHEN a Fasting_Period has duration less than 4 hours, THE Basal_Rate_Optimizer SHALL disqualify it from generating recommendations
2. WHEN a Fasting_Period has CV_Percent greater than 30, THE Basal_Rate_Optimizer SHALL disqualify it from generating recommendations
3. WHEN a Fasting_Period contains glucose readings below 70 mg/dL for more than 15 consecutive minutes, THE Basal_Rate_Optimizer SHALL disqualify it from generating recommendations
4. WHEN a Fasting_Period contains any glucose reading above 250 mg/dL, THE Basal_Rate_Optimizer SHALL disqualify it from generating recommendations
5. WHEN a Fasting_Period is disqualified, THE Basal_Rate_Optimizer SHALL record the disqualification reason for user visibility

### Requirement 6: Safety Validation - Confirmation Requirements

**User Story:** As a person with diabetes, I want high-confidence recommendations to be based on multiple confirming periods, so that I can trust the recommendations are not based on isolated incidents.

#### Acceptance Criteria for Requirement 6

1. WHEN generating a high confidence recommendation, THE Basal_Rate_Optimizer SHALL require at least 2 qualifying Fasting_Period instances showing the same Glucose_Trend direction
2. WHEN counting qualifying periods for confirmation, THE Basal_Rate_Optimizer SHALL only count periods from different calendar days
3. WHEN evaluating trend consistency, THE Basal_Rate_Optimizer SHALL verify that all qualifying periods have Slope values with the same sign (positive or negative)
4. WHEN fewer than 2 qualifying periods exist for a Time_Block, THE Basal_Rate_Optimizer SHALL limit the maximum Confidence_Score to 69

### Requirement 7: Recommendation Generation

**User Story:** As a person with diabetes, I want clear recommendations for each time of day, so that I can systematically optimize my basal rates.

#### Acceptance Criteria for Requirement 7

1. WHEN generating recommendations for a Time_Block, THE Basal_Rate_Optimizer SHALL include the current Basal_Rate from Profile_Data
2. WHEN generating recommendations for a Time_Block, THE Basal_Rate_Optimizer SHALL include the recommended adjustment magnitude and direction
3. WHEN generating recommendations for a Time_Block, THE Basal_Rate_Optimizer SHALL include the calculated new Basal_Rate value
4. WHEN generating recommendations for a Time_Block, THE Basal_Rate_Optimizer SHALL include the Confidence_Score
5. WHEN generating recommendations for a Time_Block, THE Basal_Rate_Optimizer SHALL include explanatory reasoning based on Slope, CV_Percent, and number of qualifying periods
6. WHEN generating recommendations for a Time_Block, THE Basal_Rate_Optimizer SHALL include supporting data showing individual Fasting_Period measurements
7. WHEN insufficient qualifying data exists for a Time_Block, THE Basal_Rate_Optimizer SHALL generate a "NO CHANGE" recommendation with explanation

### Requirement 8: User Interface Integration

**User Story:** As a person with diabetes, I want to see basal rate recommendations in my Day to Day report, so that I can review them alongside my glucose data.

#### Acceptance Criteria for Requirement 8

1. WHEN the Day to Day report is generated, THE Basal_Rate_Optimizer SHALL display a recommendations section after the fasting periods summary
2. WHEN displaying recommendations, THE Basal_Rate_Optimizer SHALL show a prominent medical disclaimer stating recommendations are not medical advice
3. WHEN displaying recommendations for each Time_Block, THE Basal_Rate_Optimizer SHALL use color coding: green for high confidence, yellow for medium confidence, red for low confidence
4. WHEN displaying recommendations, THE Basal_Rate_Optimizer SHALL show the total number of Fasting_Period instances analyzed and the date range
5. WHEN displaying a recommendation, THE Basal_Rate_Optimizer SHALL format supporting data to show date, Slope, duration, and CV_Percent for each qualifying period
6. WHEN displaying recommendations, THE Basal_Rate_Optimizer SHALL include practical tips for implementing basal rate changes safely

### Requirement 9: Data Export

**User Story:** As a person with diabetes, I want to export recommendations to PDF and CSV formats, so that I can share them with my healthcare provider.

#### Acceptance Criteria for Requirement 9

1. WHEN the user requests PDF export, THE Basal_Rate_Optimizer SHALL generate a PDF document containing all recommendations and supporting data
2. WHEN the user requests CSV export, THE Basal_Rate_Optimizer SHALL generate a CSV file with columns for Time_Block, current rate, recommended adjustment, new rate, Confidence_Score, and reasoning
3. WHEN exporting recommendations, THE Basal_Rate_Optimizer SHALL include the medical disclaimer in the exported document
4. WHEN exporting recommendations, THE Basal_Rate_Optimizer SHALL include the analysis date range and total periods analyzed

### Requirement 10: Profile Data Integration

**User Story:** As a person with diabetes, I want the system to read my current basal rates and ISF from my Nightscout profile, so that recommendations are personalized to my settings.

#### Acceptance Criteria for Requirement 10

1. WHEN analyzing data, THE Basal_Rate_Optimizer SHALL read the user's basal rate schedule from Profile_Data
2. WHEN analyzing data, THE Basal_Rate_Optimizer SHALL read the user's ISF value from Profile_Data
3. WHEN Profile_Data is unavailable or incomplete, THE Basal_Rate_Optimizer SHALL use default values and display a warning to the user
4. WHEN multiple basal rate segments exist within a Time_Block, THE Basal_Rate_Optimizer SHALL use the rate that is active at the start of the Fasting_Period

### Requirement 11: Error Handling and Warnings

**User Story:** As a person with diabetes, I want clear warnings about data quality issues or safety concerns, so that I can make informed decisions about following recommendations.

#### Acceptance Criteria for Requirement 11

1. WHEN a Fasting_Period approaches Hypoglycemia (glucose trending toward 70 mg/dL), THE Basal_Rate_Optimizer SHALL display a warning to monitor closely after any rate increase
2. WHEN insufficient data exists for any Time_Block, THE Basal_Rate_Optimizer SHALL display a message indicating more data is needed
3. WHEN Profile_Data is missing or incomplete, THE Basal_Rate_Optimizer SHALL display a warning that default values are being used
4. WHEN calculation errors occur, THE Basal_Rate_Optimizer SHALL log the error and display a user-friendly message indicating the recommendation could not be generated
5. WHEN displaying any recommendation, THE Basal_Rate_Optimizer SHALL include a warning to test one time period at a time and wait 2-3 days between adjustments
