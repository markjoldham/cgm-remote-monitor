# Implementation Plan: Basal Rate Optimization

## Overview

This implementation plan breaks down the Basal Rate Optimization feature into discrete, actionable tasks. The feature will be implemented as a new report plugin (`basal-rate-optimizer.js`) that integrates with the existing Day to Day report and fasting detection system.

The implementation follows a bottom-up approach: building core statistical and safety components first, then the recommendation engine, and finally the UI integration and export functionality. Each major component includes property-based tests to validate correctness properties from the design document.

## Tasks

- [x] 1. Set up basal rate optimizer plugin structure and core utilities
  - Create `lib/report_plugins/basal-rate-optimizer.js` with plugin skeleton
  - Set up module exports and integration points with Day to Day report
  - Create utility functions for time-of-day classification and data validation
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 1.1 Write property test for time-of-day classification
  - **Property 4: Time Block Classification**
  - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**

- [x] 2. Implement statistical analysis engine
  - [x] 2.1 Implement linear regression calculation
    - Write `calculateLinearRegression()` function using least squares method
    - Calculate slope, intercept, and R² values
    - Handle edge cases (insufficient data points, identical values)
    - _Requirements: 1.1, 1.2_

  - [x] 2.2 Write property test for linear regression
    - **Property 1: Linear Regression Calculation Completeness**
    - **Validates: Requirements 1.1, 1.2**

  - [x] 2.3 Implement trend classification
    - Write `classifyTrend()` function with slope and R² thresholds
    - Return 'rising', 'falling', or 'stable' based on criteria
    - _Requirements: 1.3, 1.4, 1.5_

  - [x]* 2.4 Write property test for trend classification
    - **Property 2: Trend Classification Correctness**
    - **Validates: Requirements 1.3, 1.4, 1.5**

  - [x] 2.5 Implement coefficient of variation calculation
    - Write `calculateCV()` function for glucose variability
    - Calculate mean, standard deviation, and CV percentage
    - _Requirements: 1.6_

  - [ ]* 2.6 Write property test for CV calculation
    - **Property 3: CV Calculation**
    - **Validates: Requirements 1.6**

- [x] 3. Implement safety validation engine
  - [x] 3.1 Implement hypoglycemia detection
    - Write `detectHypoglycemia()` function
    - Check for glucose < 70 mg/dL for > 15 consecutive minutes
    - _Requirements: 5.3_

  - [x] 3.2 Implement period disqualification logic
    - Write `validateFastingPeriod()` function
    - Check duration, CV%, hypoglycemia, and hyperglycemia criteria
    - Return qualification status with reason
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ]* 3.3 Write property test for period disqualification
    - **Property 13: Period Disqualification Rules**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**

  - [ ]* 3.4 Write property test for disqualification reason recording
    - **Property 14: Disqualification Reason Recording**
    - **Validates: Requirements 5.5**

  - [x] 3.5 Implement adjustment safety limits
    - Write `applyAdjustmentLimits()` function
    - Apply absolute limit (±0.15 U/hr), percentage limit (±20%), and minimum threshold (0.025 U/hr)
    - _Requirements: 3.4, 3.6, 3.7_

  - [ ]* 3.6 Write property test for adjustment safety limits
    - **Property 10: Adjustment Safety Limits**
    - **Validates: Requirements 3.6, 3.7**

  - [ ]* 3.7 Write property test for minimum adjustment threshold
    - **Property 8: Minimum Adjustment Threshold**
    - **Validates: Requirements 3.4**

- [ ]* 4. Checkpoint - Ensure core analysis and safety tests pass
  - Run all tests for statistical analysis and safety validation
  - Verify edge cases are handled correctly
  - Ask the user if questions arise

- [x] 5. Implement recommendation engine
  - [x] 5.1 Implement basal rate adjustment calculation
    - Write `calculateAdjustment()` function
    - Apply formula: (slope / ISF) * safety_multiplier
    - Use default ISF of 50 if not provided
    - Apply safety limits and round to 0.05 U/hr increments
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 5.2 Write property test for adjustment formula
    - **Property 6: Adjustment Formula Application**
    - **Validates: Requirements 3.1, 3.3**

  - [ ]* 5.3 Write property test for ISF default fallback
    - **Property 7: ISF Default Fallback**
    - **Validates: Requirements 3.2**

  - [ ]* 5.4 Write property test for new rate calculation
    - **Property 9: New Rate Calculation**
    - **Validates: Requirements 3.5**

  - [x] 5.5 Implement confidence score calculation
    - Write `calculateConfidenceScore()` function
    - Calculate duration, stability, trend strength, and consistency components
    - Sum components to get score 0-100
    - Classify as high/medium/low confidence
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [ ]* 5.6 Write property test for confidence score components
    - **Property 11: Confidence Score Components**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

  - [ ]* 5.7 Write property test for confidence level classification
    - **Property 12: Confidence Level Classification**
    - **Validates: Requirements 4.5, 4.6, 4.7**

  - [x] 5.8 Implement time-of-day grouping
    - Write `groupByTimeOfDay()` function
    - Group fasting periods into overnight, morning, afternoon, evening
    - _Requirements: 2.5_

  - [ ]* 5.9 Write property test for time block grouping
    - **Property 5: Time Block Grouping**
    - **Validates: Requirements 2.5**

  - [x] 5.10 Implement multi-period confirmation logic
    - Check for at least 2 qualifying periods from different days
    - Verify trend consistency (same slope sign)
    - Cap confidence at 69 if insufficient periods
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ]* 5.11 Write property test for high confidence confirmation
    - **Property 15: High Confidence Confirmation Requirement**
    - **Validates: Requirements 6.1, 6.2, 6.3**

  - [ ]* 5.12 Write property test for confidence capping
    - **Property 16: Confidence Capping for Insufficient Periods**
    - **Validates: Requirements 6.4**

  - [x] 5.13 Implement main recommendation generation function
    - Write `generateRecommendation()` function
    - Orchestrate analysis, validation, calculation, and scoring
    - Handle errors and insufficient data cases
    - Generate complete recommendation objects
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [ ]* 5.14 Write property test for recommendation completeness
    - **Property 17: Recommendation Completeness**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6**

  - [ ]* 5.15 Write property test for insufficient data handling
    - **Property 18: Insufficient Data Handling**
    - **Validates: Requirements 7.7**

- [ ]* 6. Checkpoint - Ensure recommendation engine tests pass
  - Run all tests for recommendation calculation and confidence scoring
  - Verify safety limits are properly enforced
  - Ask the user if questions arise

- [x] 7. Implement profile data integration
  - [x] 7.1 Implement profile data reading
    - Write `readProfileData()` function
    - Extract basal rate schedule and ISF from Nightscout profile
    - Handle missing or incomplete profile data with defaults
    - _Requirements: 10.1, 10.2, 10.3_

  - [x] 7.2 Implement basal rate segment selection
    - Write `getCurrentBasalRate()` function
    - Find the active basal rate for a given time
    - Handle multiple segments within a time block
    - _Requirements: 10.4_

  - [ ]* 7.3 Write property test for profile data reading
    - **Property 26: Profile Data Reading**
    - **Validates: Requirements 10.1, 10.2**

  - [ ]* 7.4 Write property test for profile fallback with warning
    - **Property 27: Profile Data Fallback with Warning**
    - **Validates: Requirements 10.3**

  - [ ]* 7.5 Write property test for basal rate segment selection
    - **Property 28: Basal Rate Segment Selection**
    - **Validates: Requirements 10.4**

- [x] 8. Implement UI formatter and display generation
  - [x] 8.1 Implement HTML generation for recommendations
    - Write `generateRecommendationsHTML()` function
    - Create medical disclaimer section
    - Display analysis summary with metadata
    - Generate time block recommendation cards
    - Include safety tips section
    - _Requirements: 8.1, 8.2, 8.4, 8.6_

  - [ ]* 8.2 Write property test for medical disclaimer presence
    - **Property 19: Medical Disclaimer Presence**
    - **Validates: Requirements 8.2**

  - [ ]* 8.3 Write property test for metadata display
    - **Property 21: Metadata Display**
    - **Validates: Requirements 8.4**

  - [ ]* 8.4 Write property test for safety tips inclusion
    - **Property 23: Safety Tips Inclusion**
    - **Validates: Requirements 8.6**

  - [x] 8.5 Implement confidence color coding
    - Write `getConfidenceColor()` function
    - Return green/yellow/red based on confidence score
    - Apply color coding to recommendation displays
    - _Requirements: 8.3_

  - [ ]* 8.6 Write property test for confidence color coding
    - **Property 20: Confidence Color Coding**
    - **Validates: Requirements 8.3**

  - [x] 8.7 Implement supporting data formatting
    - Format individual period data (date, slope, duration, CV%)
    - Display in readable table format
    - _Requirements: 8.5_

  - [ ]* 8.8 Write property test for supporting data formatting
    - **Property 22: Supporting Data Formatting**
    - **Validates: Requirements 8.5**

- [x] 9. Implement error handling and warnings
  - [x] 9.1 Implement warning generation logic
    - Add near-hypoglycemia warnings
    - Add insufficient data messages
    - Add missing profile warnings
    - Add implementation safety warnings
    - _Requirements: 11.1, 11.2, 11.3, 11.5_

  - [ ]* 9.2 Write property test for near-hypoglycemia warning
    - **Property 29: Near-Hypoglycemia Warning**
    - **Validates: Requirements 11.1**

  - [ ]* 9.3 Write property test for insufficient data messaging
    - **Property 30: Insufficient Data Messaging**
    - **Validates: Requirements 11.2**

  - [ ]* 9.4 Write property test for missing profile warning
    - **Property 31: Missing Profile Warning**
    - **Validates: Requirements 11.3**

  - [ ]* 9.5 Write property test for implementation safety warning
    - **Property 33: Implementation Safety Warning**
    - **Validates: Requirements 11.5**

  - [x] 9.6 Implement error handling for calculation failures
    - Add try-catch blocks around calculations
    - Log errors for debugging
    - Display user-friendly error messages
    - _Requirements: 11.4_

  - [ ]* 9.7 Write property test for calculation error handling
    - **Property 32: Calculation Error Handling**
    - **Validates: Requirements 11.4**

- [x] 10. Implement export functionality
  - [x] 10.1 Implement CSV export
    - Write `exportToCSV()` function
    - Create CSV with columns: time block, current rate, adjustment, new rate, confidence, reasoning
    - Include medical disclaimer and metadata
    - _Requirements: 9.2, 9.3, 9.4_

  - [ ]* 10.2 Write property test for CSV export disclaimer
    - **Property 24: Export Disclaimer Inclusion**
    - **Validates: Requirements 9.3**

  - [ ]* 10.3 Write property test for CSV export metadata
    - **Property 25: Export Metadata Inclusion**
    - **Validates: Requirements 9.4**

  - [ ]* 10.4 Implement PDF export
    - Write `exportToPDF()` function
    - Generate PDF with all recommendations and supporting data
    - Include medical disclaimer and metadata
    - Use existing PDF generation library (if available) or integrate new one
    - _Requirements: 9.1, 9.3, 9.4_

  - [ ]* 10.5 Write unit tests for PDF export
    - Test PDF generation with sample data
    - Verify disclaimer and metadata inclusion
    - _Requirements: 9.1, 9.3, 9.4_

- [x] 11. Integrate with Day to Day report
  - [x] 11.1 Add basal rate optimizer call to Day to Day report
    - Modify `lib/report_plugins/daytoday.js` to call basal rate optimizer
    - Pass fasting period data and profile data
    - Insert recommendations section after fasting periods summary
    - _Requirements: 8.1_

  - [x] 11.2 Add export buttons to UI
    - Add PDF and CSV export buttons to recommendations section
    - Wire up button click handlers to export functions
    - _Requirements: 9.1, 9.2_

  - [ ]* 11.3 Write integration tests for Day to Day report
    - Test end-to-end flow from fasting data to recommendations display
    - Verify recommendations appear in correct location
    - Test with various data scenarios (sufficient data, insufficient data, missing profile)
    - _Requirements: 8.1_

- [ ]* 12. Add CSS styling for recommendations display
  - Create styles for recommendation cards
  - Style confidence color coding (green/yellow/red)
  - Style medical disclaimer (prominent warning box)
  - Style supporting data tables
  - Style export buttons
  - Ensure responsive design for mobile devices
  - _Requirements: 8.2, 8.3_

- [ ]* 13. Final checkpoint - End-to-end testing and validation
  - Run complete test suite (unit tests and property tests)
  - Test with real Nightscout data (if available)
  - Verify all safety checks are working
  - Verify all warnings are displayed correctly
  - Test export functionality (PDF and CSV)
  - Ensure all tests pass, ask the user if questions arise

## Notes

- All tasks are required for comprehensive implementation with full test coverage
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples, edge cases, and integration points
- The implementation uses JavaScript and integrates with the existing Nightscout report plugin architecture
- Property-based tests will use the fast-check library with minimum 100 iterations per test
- Each property test is tagged with: `Feature: basal-rate-optimization, Property {N}: {description}`
