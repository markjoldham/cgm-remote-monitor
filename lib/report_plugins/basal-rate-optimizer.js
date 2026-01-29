'use strict';

// Support both browser and Node.js environments
var moment = (typeof window !== 'undefined' && window.moment) ? window.moment : require('moment');

/**
 * Basal Rate Optimization Plugin for Nightscout
 * 
 * Analyzes glucose trends during fasting periods to provide data-driven
 * recommendations for adjusting basal insulin rates. Uses statistical analysis
 * (linear regression) to identify whether glucose is rising, falling, or stable
 * during periods when no food is being digested.
 * 
 * Safety-focused design with:
 * - Conservative adjustment calculations using safety multipliers
 * - Multiple validation checks to disqualify unreliable data
 * - Confidence scoring to indicate recommendation reliability
 * - Requirement for multiple confirming periods before high-confidence recommendations
 * - Clear medical disclaimers and warnings
 */

var basalRateOptimizer = {
  name: 'basal-rate-optimizer',
  label: 'Basal Rate Optimizer',
  pluginType: 'report-plugin'
};

/**
 * Initialize the plugin
 */
function init() {
  return basalRateOptimizer;
}

module.exports = init;

// ============================================================================
// CORE UTILITY FUNCTIONS
// ============================================================================

/**
 * Classify a fasting period into a time-of-day block
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4
 * 
 * @param {number} startTime - Unix timestamp (ms) of fasting period start
 * @returns {string} Time block: 'overnight', 'morning', 'afternoon', or 'evening'
 */
basalRateOptimizer.classifyTimeBlock = function(startTime) {
  var startMoment = moment(startTime);
  var startHour = startMoment.hour();
  
  // Requirement 2.1: overnight (22:00 - 06:00)
  if (startHour >= 22 || startHour < 6) {
    return 'overnight';
  }
  // Requirement 2.2: morning (06:00 - 12:00)
  else if (startHour >= 6 && startHour < 12) {
    return 'morning';
  }
  // Requirement 2.3: afternoon (12:00 - 18:00)
  else if (startHour >= 12 && startHour < 18) {
    return 'afternoon';
  }
  // Requirement 2.4: evening (18:00 - 22:00)
  else {
    return 'evening';
  }
};

/**
 * Validate that a fasting period has the minimum required data
 * 
 * @param {Object} fastingPeriod - Fasting period object
 * @returns {Object} {valid: boolean, reason: string}
 */
basalRateOptimizer.validateFastingPeriodData = function(fastingPeriod) {
  if (!fastingPeriod) {
    return { valid: false, reason: 'Fasting period is null or undefined' };
  }
  
  if (!fastingPeriod.startTime || !fastingPeriod.endTime) {
    return { valid: false, reason: 'Missing start or end time' };
  }
  
  if (!fastingPeriod.glucoseReadings || !Array.isArray(fastingPeriod.glucoseReadings)) {
    return { valid: false, reason: 'Missing or invalid glucose readings array' };
  }
  
  if (fastingPeriod.glucoseReadings.length < 2) {
    return { valid: false, reason: 'Insufficient glucose readings (need at least 2)' };
  }
  
  // Validate glucose readings have required fields
  for (var i = 0; i < fastingPeriod.glucoseReadings.length; i++) {
    var reading = fastingPeriod.glucoseReadings[i];
    if (!reading.mills || typeof reading.sgv !== 'number') {
      return { valid: false, reason: 'Invalid glucose reading format' };
    }
  }
  
  return { valid: true, reason: null };
};

/**
 * Group fasting periods by time of day
 * 
 * Requirement: 2.5
 * 
 * @param {Array<Object>} fastingPeriods - Array of fasting period objects
 * @returns {Object} Periods grouped by time block
 */
basalRateOptimizer.groupByTimeOfDay = function(fastingPeriods) {
  var groups = {
    overnight: [],
    morning: [],
    afternoon: [],
    evening: []
  };
  
  if (!fastingPeriods || !Array.isArray(fastingPeriods)) {
    return groups;
  }
  
  fastingPeriods.forEach(function(period) {
    var timeBlock = basalRateOptimizer.classifyTimeBlock(period.startTime);
    groups[timeBlock].push(period);
  });
  
  return groups;
};

/**
 * Get a user-friendly label for a time block
 * 
 * @param {string} timeBlock - Time block identifier
 * @returns {string} Human-readable label
 */
basalRateOptimizer.getTimeBlockLabel = function(timeBlock) {
  var labels = {
    overnight: 'Overnight (10 PM - 6 AM)',
    morning: 'Morning (6 AM - 12 PM)',
    afternoon: 'Afternoon (12 PM - 6 PM)',
    evening: 'Evening (6 PM - 10 PM)'
  };
  
  return labels[timeBlock] || timeBlock;
};

/**
 * Format a timestamp for display
 * 
 * @param {number} timestamp - Unix timestamp (ms)
 * @param {string} format - Moment.js format string (default: 'YYYY-MM-DD HH:mm')
 * @returns {string} Formatted date/time string
 */
basalRateOptimizer.formatTimestamp = function(timestamp, format) {
  format = format || 'YYYY-MM-DD HH:mm';
  return moment(timestamp).format(format);
};

/**
 * Round a number to a specified number of decimal places
 * 
 * @param {number} value - Number to round
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {number} Rounded number
 */
basalRateOptimizer.roundTo = function(value, decimals) {
  decimals = (typeof decimals === 'number') ? decimals : 2;
  var multiplier = Math.pow(10, decimals);
  return Math.round(value * multiplier) / multiplier;
};

/**
 * Main entry point for generating basal rate recommendations
 * 
 * @param {Array<Object>} fastingPeriods - Array of fasting periods from fasting detection
 * @param {Object} profileData - User's profile data (basal rates, ISF, etc.)
 * @returns {Object} Recommendations by time block with metadata
 */
basalRateOptimizer.generateRecommendations = function(fastingPeriods, profileData) {
  console.log('🔢 BASAL RATE OPTIMIZER BUILD: v2.0-INSULIN-DELIVERY-ACCOUNTING - 2026-01-28-20:30 EST');
  console.log('Basal Rate Optimizer: Starting analysis', {
    periodCount: fastingPeriods ? fastingPeriods.length : 0,
    hasProfile: !!profileData
  });
  
  // Validate inputs
  if (!fastingPeriods || !Array.isArray(fastingPeriods) || fastingPeriods.length === 0) {
    return {
      error: 'NO_DATA',
      message: 'No fasting periods available for analysis',
      recommendations: {}
    };
  }
  
  // Group periods by time of day
  var groupedPeriods = basalRateOptimizer.groupByTimeOfDay(fastingPeriods);
  
  // Calculate date range for metadata
  var timestamps = fastingPeriods.map(function(p) { return p.startTime; });
  var startDate = basalRateOptimizer.formatTimestamp(Math.min.apply(null, timestamps), 'YYYY-MM-DD');
  var endDate = basalRateOptimizer.formatTimestamp(Math.max.apply(null, timestamps), 'YYYY-MM-DD');
  
  var result = {
    recommendations: {},
    metadata: {
      periodCount: fastingPeriods.length,
      startDate: startDate,
      endDate: endDate,
      analysisDate: basalRateOptimizer.formatTimestamp(Date.now(), 'YYYY-MM-DD HH:mm')
    }
  };
  
  // Generate recommendations for each time block
  var timeBlocks = ['overnight', 'morning', 'afternoon', 'evening'];
  timeBlocks.forEach(function(timeBlock) {
    result.recommendations[timeBlock] = basalRateOptimizer.generateRecommendation(
      timeBlock,
      groupedPeriods[timeBlock],
      profileData
    );
  });
  
  return result;
};

// ============================================================================
// STATISTICAL ANALYSIS ENGINE
// ============================================================================

/**
 * Calculate linear regression for glucose data using least squares method
 * 
 * Requirements: 1.1, 1.2
 * 
 * Given n data points (x₁, y₁), (x₂, y₂), ..., (xₙ, yₙ) where:
 *   x = time in hours from period start
 *   y = glucose value in mg/dL
 * 
 * Calculate:
 *   x̄ = mean of x values
 *   ȳ = mean of y values
 *   
 *   slope = Σ((xᵢ - x̄)(yᵢ - ȳ)) / Σ((xᵢ - x̄)²)
 *   intercept = ȳ - slope * x̄
 *   
 *   R² = 1 - (SS_res / SS_tot)
 *   where:
 *     SS_res = Σ(yᵢ - ŷᵢ)²  (residual sum of squares)
 *     SS_tot = Σ(yᵢ - ȳ)²  (total sum of squares)
 *     ŷᵢ = slope * xᵢ + intercept (predicted value)
 * 
 * @param {Array<{mills: number, sgv: number}>} glucoseReadings - CGM data points
 * @returns {{slope: number, intercept: number, rSquared: number}} Linear regression results
 * @throws {Error} If input is invalid or calculation fails
 */
basalRateOptimizer.calculateLinearRegression = function(glucoseReadings) {
  try {
    // Validate input
    if (!glucoseReadings || !Array.isArray(glucoseReadings)) {
      throw new Error('glucoseReadings must be an array');
    }
    
    if (glucoseReadings.length < 2) {
      throw new Error('Need at least 2 data points for linear regression');
    }
    
    // Validate that all readings have required fields
    for (var i = 0; i < glucoseReadings.length; i++) {
      if (!glucoseReadings[i] || typeof glucoseReadings[i].mills !== 'number' || typeof glucoseReadings[i].sgv !== 'number') {
        throw new Error('Invalid glucose reading format at index ' + i);
      }
      if (isNaN(glucoseReadings[i].mills) || isNaN(glucoseReadings[i].sgv)) {
        throw new Error('Glucose reading contains NaN values at index ' + i);
      }
    }
    
    // Convert timestamps to hours from start and extract glucose values
    var startTime = glucoseReadings[0].mills;
    var dataPoints = glucoseReadings.map(function(reading) {
      return {
        x: (reading.mills - startTime) / (1000 * 60 * 60), // Convert ms to hours
        y: reading.sgv
      };
    });
    
    var n = dataPoints.length;
    
    // Calculate means
    var sumX = 0;
    var sumY = 0;
    for (var j = 0; j < n; j++) {
      sumX += dataPoints[j].x;
      sumY += dataPoints[j].y;
    }
    var meanX = sumX / n;
    var meanY = sumY / n;
    
    // Check for NaN in means
    if (isNaN(meanX) || isNaN(meanY)) {
      throw new Error('Calculated means contain NaN values');
    }
    
    // Calculate slope using least squares formula
    var numerator = 0;   // Σ((xᵢ - x̄)(yᵢ - ȳ))
    var denominator = 0; // Σ((xᵢ - x̄)²)
    
    for (var k = 0; k < n; k++) {
      var xDiff = dataPoints[k].x - meanX;
      var yDiff = dataPoints[k].y - meanY;
      numerator += xDiff * yDiff;
      denominator += xDiff * xDiff;
    }
    
    // Handle edge case: all x values are identical (denominator = 0)
    if (denominator === 0) {
      // If all times are the same, slope is undefined/0
      // Return slope of 0 and R² of 0 (no trend)
      return {
        slope: 0,
        intercept: meanY,
        rSquared: 0
      };
    }
    
    var slope = numerator / denominator;
    var intercept = meanY - slope * meanX;
    
    // Check for NaN in slope/intercept
    if (isNaN(slope) || isNaN(intercept)) {
      throw new Error('Calculated slope or intercept contains NaN');
    }
    
    // Calculate R² (coefficient of determination)
    var ssRes = 0; // Residual sum of squares: Σ(yᵢ - ŷᵢ)²
    var ssTot = 0; // Total sum of squares: Σ(yᵢ - ȳ)²
    
    for (var m = 0; m < n; m++) {
      var predicted = slope * dataPoints[m].x + intercept;
      var residual = dataPoints[m].y - predicted;
      var totalDiff = dataPoints[m].y - meanY;
      
      ssRes += residual * residual;
      ssTot += totalDiff * totalDiff;
    }
    
    // Handle edge case: all y values are identical (ssTot = 0)
    var rSquared;
    if (ssTot === 0) {
      // If all glucose values are identical, there's no variation to explain
      // R² is technically undefined, but we'll return 1 if slope is 0 (perfect fit to horizontal line)
      // or 0 if slope is non-zero (which shouldn't happen with identical y values)
      rSquared = (slope === 0) ? 1 : 0;
    } else {
      rSquared = 1 - (ssRes / ssTot);
      
      // Clamp R² to [0, 1] range (can be slightly negative due to floating point errors)
      if (rSquared < 0) {
        rSquared = 0;
      }
      if (rSquared > 1) {
        rSquared = 1;
      }
    }
    
    // Final validation
    if (isNaN(rSquared)) {
      throw new Error('Calculated R² contains NaN');
    }
    
    return {
      slope: slope,
      intercept: intercept,
      rSquared: rSquared
    };
  } catch (error) {
    // Log error for debugging (Requirement 11.4)
    console.error('Linear regression calculation failed:', error.message, {
      readingsCount: glucoseReadings ? glucoseReadings.length : 0
    });
    // Re-throw with more context
    throw new Error('Linear regression calculation failed: ' + error.message);
  }
};

/**
 * Classify glucose trend based on slope and R² thresholds
 * 
 * Requirements: 1.3, 1.4, 1.5
 * 
 * Classification criteria:
 * - 'rising': slope > 5 mg/dL per hour AND R² > 0.5
 * - 'falling': slope < -5 mg/dL per hour AND R² > 0.5
 * - 'stable': otherwise (|slope| <= 5 OR R² <= 0.5)
 * 
 * @param {number} slope - Rate of glucose change in mg/dL per hour
 * @param {number} rSquared - Goodness of fit (0-1)
 * @returns {'rising' | 'falling' | 'stable'} Trend classification
 */
basalRateOptimizer.classifyTrend = function(slope, rSquared) {
  // Requirement 1.3: Rising trend when slope > 5 AND R² > 0.5
  if (slope > 5 && rSquared > 0.5) {
    return 'rising';
  }
  
  // Requirement 1.4: Falling trend when slope < -5 AND R² > 0.5
  if (slope < -5 && rSquared > 0.5) {
    return 'falling';
  }
  
  // Requirement 1.5: Stable trend when |slope| <= 5 OR R² <= 0.5
  return 'stable';
};

/**
 * Calculate coefficient of variation (CV%) for glucose variability
 * 
 * Requirement: 1.6
 * 
 * The coefficient of variation is a measure of relative variability,
 * expressed as a percentage. It's calculated as:
 * 
 *   CV% = (standard_deviation / mean) * 100
 * 
 * A lower CV% indicates more stable glucose levels, while a higher CV%
 * indicates more variability. For diabetes management:
 * - CV% < 36% is generally considered good glucose stability
 * - CV% > 36% indicates high variability
 * 
 * @param {Array<number>} glucoseValues - Array of glucose readings in mg/dL
 * @returns {number} Coefficient of variation as percentage
 * @throws {Error} If input is invalid or calculation fails
 */
basalRateOptimizer.calculateCV = function(glucoseValues) {
  try {
    // Validate input
    if (!glucoseValues || !Array.isArray(glucoseValues)) {
      throw new Error('glucoseValues must be an array');
    }
    
    if (glucoseValues.length === 0) {
      throw new Error('glucoseValues array cannot be empty');
    }
    
    // Validate all values are numbers
    for (var i = 0; i < glucoseValues.length; i++) {
      if (typeof glucoseValues[i] !== 'number' || isNaN(glucoseValues[i])) {
        throw new Error('Invalid glucose value at index ' + i);
      }
    }
    
    // Calculate mean
    var sum = 0;
    for (var j = 0; j < glucoseValues.length; j++) {
      sum += glucoseValues[j];
    }
    var mean = sum / glucoseValues.length;
    
    // Check for NaN in mean
    if (isNaN(mean)) {
      throw new Error('Calculated mean contains NaN');
    }
    
    // Handle edge case: mean is zero (would cause division by zero)
    if (mean === 0) {
      return 0;
    }
    
    // Calculate standard deviation
    var squaredDifferencesSum = 0;
    for (var k = 0; k < glucoseValues.length; k++) {
      var difference = glucoseValues[k] - mean;
      squaredDifferencesSum += difference * difference;
    }
    
    // Use sample standard deviation (n-1) for better estimation
    // For single value, return 0 (no variation)
    var variance;
    if (glucoseValues.length === 1) {
      variance = 0;
    } else {
      variance = squaredDifferencesSum / (glucoseValues.length - 1);
    }
    
    var standardDeviation = Math.sqrt(variance);
    
    // Check for NaN in standard deviation
    if (isNaN(standardDeviation)) {
      throw new Error('Calculated standard deviation contains NaN');
    }
    
    // Calculate CV%
    var cv = (standardDeviation / mean) * 100;
    
    // Final validation
    if (isNaN(cv) || !isFinite(cv)) {
      throw new Error('Calculated CV contains NaN or Infinity');
    }
    
    return cv;
  } catch (error) {
    // Log error for debugging (Requirement 11.4)
    console.error('CV calculation failed:', error.message, {
      valuesCount: glucoseValues ? glucoseValues.length : 0
    });
    // Re-throw with more context
    throw new Error('CV calculation failed: ' + error.message);
  }
};

// ============================================================================
// SAFETY VALIDATION ENGINE
// ============================================================================

/**
 * Detect hypoglycemia in glucose readings
 * 
 * Requirement: 5.3
 * 
 * Checks if glucose readings contain values below 70 mg/dL for more than
 * 15 consecutive minutes. This is a safety check to disqualify fasting
 * periods that may have been affected by low blood sugar.
 * 
 * @param {Array<{mills: number, sgv: number}>} glucoseReadings - CGM data points
 * @returns {boolean} True if hypoglycemia detected (< 70 mg/dL for > 15 min)
 */
basalRateOptimizer.detectHypoglycemia = function(glucoseReadings) {
  // Validate input
  if (!glucoseReadings || !Array.isArray(glucoseReadings)) {
    return false;
  }
  
  if (glucoseReadings.length === 0) {
    return false;
  }
  
  var HYPO_THRESHOLD = 70; // mg/dL
  var MIN_DURATION_MS = 15 * 60 * 1000; // 15 minutes in milliseconds
  
  var hypoStartTime = null;
  
  for (var i = 0; i < glucoseReadings.length; i++) {
    var reading = glucoseReadings[i];
    
    // Check if current reading is below hypoglycemia threshold
    if (reading.sgv < HYPO_THRESHOLD) {
      // If this is the start of a hypoglycemic period, record the time
      if (hypoStartTime === null) {
        hypoStartTime = reading.mills;
      }
      
      // Check if we've been below threshold for more than 15 minutes
      var hypoDuration = reading.mills - hypoStartTime;
      if (hypoDuration > MIN_DURATION_MS) {
        return true; // Hypoglycemia detected
      }
    } else {
      // Reading is above threshold, reset the hypo start time
      hypoStartTime = null;
    }
  }
  
  return false; // No sustained hypoglycemia detected
};

/**
 * Validate if a fasting period qualifies for recommendations
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 * 
 * Checks multiple safety criteria to ensure only reliable and safe data
 * is used for basal rate recommendations:
 * 
 * Disqualification rules:
 * - Duration < 4 hours (Requirement 5.1)
 * - CV% > 30 (Requirement 5.2)
 * - Contains hypoglycemia: glucose < 70 mg/dL for > 15 min (Requirement 5.3)
 * - Contains hyperglycemia: any glucose > 250 mg/dL (Requirement 5.4)
 * 
 * @param {Object} fastingPeriod - Fasting period with glucose data
 * @param {Object} analysis - Statistical analysis results (must include cv property)
 * @returns {{qualified: boolean, reason: string}} Qualification status with reason (Requirement 5.5)
 */
basalRateOptimizer.validateFastingPeriod = function(fastingPeriod, analysis) {
  // Validate inputs
  if (!fastingPeriod || !analysis) {
    return {
      qualified: false,
      reason: 'Invalid input: missing fasting period or analysis data'
    };
  }
  
  // Calculate duration in hours
  var durationHours = (fastingPeriod.endTime - fastingPeriod.startTime) / (1000 * 60 * 60);
  
  // Rule 1 (Requirement 5.1): Minimum duration of 4 hours
  if (durationHours < 4) {
    return {
      qualified: false,
      reason: 'Duration too short (< 4 hours)'
    };
  }
  
  // Rule 2 (Requirement 5.2): Maximum variability CV% <= 30
  if (analysis.cv > 30) {
    return {
      qualified: false,
      reason: 'Too variable (CV > 30%)'
    };
  }
  
  // Rule 3 (Requirement 5.3): No hypoglycemia (< 70 mg/dL for > 15 min)
  if (basalRateOptimizer.detectHypoglycemia(fastingPeriod.glucoseReadings)) {
    return {
      qualified: false,
      reason: 'Contains hypoglycemia'
    };
  }
  
  // Rule 4 (Requirement 5.4): No hyperglycemia (> 250 mg/dL)
  var maxGlucose = 0;
  for (var i = 0; i < fastingPeriod.glucoseReadings.length; i++) {
    if (fastingPeriod.glucoseReadings[i].sgv > maxGlucose) {
      maxGlucose = fastingPeriod.glucoseReadings[i].sgv;
    }
  }
  
  if (maxGlucose > 250) {
    return {
      qualified: false,
      reason: 'Contains hyperglycemia (> 250 mg/dL)'
    };
  }
  
  // All checks passed - period is qualified
  // Requirement 5.5: Return qualification status with reason
  return {
    qualified: true,
    reason: null
  };
};

/**
 * Apply adjustment limits to ensure safety
 * 
 * Requirements: 3.4, 3.6, 3.7
 * 
 * Applies multiple safety limits to calculated basal rate adjustments:
 * 
 * 1. Absolute limit: ±0.15 U/hr (Requirement 3.6)
 * 2. Percentage limit: ±20% of current basal rate (Requirement 3.7)
 * 3. Minimum threshold: 0.025 U/hr (Requirement 3.4)
 * 
 * If the adjustment is below the minimum threshold, it's set to 0 (no change).
 * If it exceeds either the absolute or percentage limit, it's capped at the limit.
 * 
 * @param {number} calculatedAdjustment - Raw calculated adjustment in U/hr
 * @param {number} currentBasalRate - Current basal rate from profile in U/hr
 * @returns {number} Limited adjustment in U/hr
 */
basalRateOptimizer.applyAdjustmentLimits = function(calculatedAdjustment, currentBasalRate) {
  // Validate inputs
  if (typeof calculatedAdjustment !== 'number' || typeof currentBasalRate !== 'number') {
    return 0;
  }
  
  var limitedAdjustment = calculatedAdjustment;
  
  // Requirement 3.6: Absolute limit of ±0.15 U/hr
  var ABSOLUTE_LIMIT = 0.15;
  if (Math.abs(limitedAdjustment) > ABSOLUTE_LIMIT) {
    limitedAdjustment = Math.sign(limitedAdjustment) * ABSOLUTE_LIMIT;
  }
  
  // Requirement 3.7: Percentage limit of ±20% of current rate
  var PERCENTAGE_LIMIT = 0.20;
  var maxPercentageChange = currentBasalRate * PERCENTAGE_LIMIT;
  if (Math.abs(limitedAdjustment) > maxPercentageChange) {
    limitedAdjustment = Math.sign(limitedAdjustment) * maxPercentageChange;
  }
  
  // Requirement 3.4: Minimum threshold of 0.05 U/hr (user preference)
  var MIN_THRESHOLD = 0.05;
  if (Math.abs(limitedAdjustment) < MIN_THRESHOLD) {
    limitedAdjustment = 0;
  }
  
  return limitedAdjustment;
};

/**
 * Calculate actual insulin delivered during a fasting period
 * 
 * Analyzes treatment data to determine total insulin delivered including:
 * - Programmed basal rate
 * - Temp basals (rate adjustments)
 * - SMBs (Super Micro Boluses)
 * - Correction boluses
 * 
 * Returns the difference between actual delivery and what the programmed
 * basal would have delivered, which indicates if automation is compensating
 * for an incorrect basal rate.
 * 
 * @param {Object} fastingPeriod - Fasting period with treatments array
 * @param {number} programmedBasalRate - The programmed basal rate in U/hr
 * @returns {Object} {actualInsulin: number, programmedInsulin: number, extraInsulin: number, hasAutomation: boolean}
 */
basalRateOptimizer.calculateInsulinDelivery = function(fastingPeriod, programmedBasalRate) {
  var durationHours = (fastingPeriod.endTime - fastingPeriod.startTime) / (1000 * 60 * 60);
  var programmedInsulin = programmedBasalRate * durationHours;
  
  if (!fastingPeriod.treatments || fastingPeriod.treatments.length === 0) {
    // No treatment data available - assume only programmed basal was delivered
    return {
      actualInsulin: programmedInsulin,
      programmedInsulin: programmedInsulin,
      extraInsulin: 0,
      hasAutomation: false,
      details: 'No treatment data available'
    };
  }
  
  var totalInsulin = 0;
  var tempBasalInsulin = 0;
  var bolusInsulin = 0;
  var hasAutomation = false;
  
  // Process each treatment
  fastingPeriod.treatments.forEach(function(treatment) {
    // Temp basal adjustments
    if (treatment.eventType === 'Temp Basal' || treatment.rate !== undefined) {
      hasAutomation = true;
      var rate = treatment.rate || treatment.absolute || 0;
      var durationMin = treatment.duration || 30; // Default 30 min if not specified
      var durationHr = durationMin / 60;
      tempBasalInsulin += rate * durationHr;
    }
    
    // Boluses (SMBs, corrections, etc.)
    if (treatment.insulin || treatment.bolus) {
      var insulinAmount = treatment.insulin || treatment.bolus || 0;
      // Only count if it's not a meal bolus (those should have been filtered by fasting detection)
      if (!treatment.carbs && !treatment.carbohydrate) {
        hasAutomation = true;
        bolusInsulin += insulinAmount;
      }
    }
  });
  
  // If we have temp basal data, use it; otherwise assume programmed basal
  var actualInsulin = hasAutomation ? (tempBasalInsulin + bolusInsulin) : programmedInsulin;
  var extraInsulin = actualInsulin - programmedInsulin;
  
  return {
    actualInsulin: actualInsulin,
    programmedInsulin: programmedInsulin,
    extraInsulin: extraInsulin,
    hasAutomation: hasAutomation,
    tempBasalInsulin: tempBasalInsulin,
    bolusInsulin: bolusInsulin,
    details: hasAutomation ? 
      'Temp basal: ' + tempBasalInsulin.toFixed(2) + 'U, Boluses: ' + bolusInsulin.toFixed(2) + 'U' :
      'Only programmed basal'
  };
};

// ============================================================================
// RECOMMENDATION ENGINE
// ============================================================================

/**
 * Calculate basal rate adjustment accounting for automated insulin delivery
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 * 
 * Calculates the recommended basal rate adjustment based on glucose slope
 * during fasting periods, accounting for extra insulin delivered by automation
 * (temp basals, SMBs). 
 * 
 * Key insight: If glucose is stable/rising DESPITE extra insulin being delivered,
 * the base basal rate is too low and needs to be increased more aggressively.
 * 
 * Formula:
 *   base_adjustment = (slope / ISF) * safety_multiplier
 *   automation_adjustment = (extraInsulin / duration) if glucose not falling
 *   total_adjustment = base_adjustment + automation_adjustment
 * 
 * @param {number} slope - Glucose rate of change in mg/dL per hour
 * @param {number} isf - Insulin sensitivity factor (mg/dL per unit)
 * @param {number} currentBasalRate - Current basal rate in U/hr
 * @param {Object} insulinDelivery - Result from calculateInsulinDelivery (optional)
 * @param {number} duration - Fasting period duration in hours (optional)
 * @returns {number} Recommended adjustment in U/hr
 */
basalRateOptimizer.calculateAdjustment = function(slope, isf, currentBasalRate, insulinDelivery, duration) {
  try {
    // Validate inputs
    if (typeof slope !== 'number' || isNaN(slope)) {
      throw new Error('Invalid slope value');
    }
    
    if (typeof currentBasalRate !== 'number' || isNaN(currentBasalRate) || currentBasalRate < 0) {
      throw new Error('Invalid current basal rate');
    }
    
    // Requirement 3.2: Use default ISF of 50 if not provided
    var effectiveISF = (typeof isf === 'number' && isf > 0 && !isNaN(isf)) ? isf : 50;
    
    // Requirement 3.3: Use safety multiplier
    // Using 0.7 for more aggressive recommendations (user preference)
    var SAFETY_MULTIPLIER = 0.7;
    
    // Requirement 3.1: Apply formula: adjustment = (slope / ISF) * safety_multiplier
    var baseAdjustment = (slope / effectiveISF) * SAFETY_MULTIPLIER;
    
    // Account for automated insulin delivery
    var automationAdjustment = 0;
    if (insulinDelivery && insulinDelivery.hasAutomation && duration > 0) {
      var extraInsulinPerHour = insulinDelivery.extraInsulin / duration;
      
      // If glucose is NOT falling (slope >= -5) and extra insulin was delivered,
      // the basal rate is too low - add the extra insulin to the adjustment
      if (slope >= -5) {
        automationAdjustment = extraInsulinPerHour;
        console.log('💉 Automation adjustment: +' + automationAdjustment.toFixed(3) + ' U/hr (extra insulin needed to maintain glucose)');
      } else {
        // Glucose is falling despite extra insulin - this is complex
        // The fall might be due to the extra insulin, so be conservative
        automationAdjustment = extraInsulinPerHour * 0.5; // Only add half
        console.log('💉 Automation adjustment: +' + automationAdjustment.toFixed(3) + ' U/hr (50% of extra insulin, glucose falling)');
      }
    }
    
    var adjustment = baseAdjustment + automationAdjustment;
    
    // Check for NaN or Infinity
    if (isNaN(adjustment) || !isFinite(adjustment)) {
      throw new Error('Calculated adjustment is NaN or Infinity');
    }
    
    // Apply safety limits (Requirements 3.4, 3.6, 3.7)
    adjustment = basalRateOptimizer.applyAdjustmentLimits(adjustment, currentBasalRate);
    
    // Round to nearest 0.05 U/hr (typical insulin pump increment)
    adjustment = Math.round(adjustment / 0.05) * 0.05;
    
    // Final validation
    if (isNaN(adjustment) || !isFinite(adjustment)) {
      throw new Error('Final adjustment is NaN or Infinity');
    }
    
    return adjustment;
  } catch (error) {
    // Log error for debugging (Requirement 11.4)
    console.error('Adjustment calculation failed:', error.message, {
      slope: slope,
      isf: isf,
      currentBasalRate: currentBasalRate
    });
    // Return 0 (no change) on error rather than throwing
    return 0;
  }
};

/**
 * Calculate confidence score for a recommendation
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7
 * 
 * Calculates a confidence score (0-100) based on four components:
 * 
 * 1. Duration component (max 30 points): Based on average fasting period duration
 *    - Formula: min(avgDuration / 6, 1.0) * 30
 *    - Longer periods provide more reliable data
 * 
 * 2. Stability component (max 30 points): Based on glucose variability (CV%)
 *    - Formula: max(0, (1 - avgCV / 40)) * 30
 *    - Lower CV% indicates more stable, reliable data
 * 
 * 3. Trend strength component (max 20 points): Based on R² value
 *    - Formula: avgRSquared * 20
 *    - Higher R² indicates stronger, more consistent trend
 * 
 * 4. Consistency component (max 20 points): Based on proportion of qualifying periods
 *    - Formula: (qualifyingPeriods / totalPeriods) * 20
 *    - More qualifying periods indicate more consistent pattern
 * 
 * The confidence level is classified as:
 * - High: score >= 70
 * - Medium: score >= 50 and < 70
 * - Low: score < 50
 * 
 * @param {Array<Object>} qualifyingPeriods - Periods supporting the recommendation
 *   Each period should have: duration (hours), cv (%), rSquared (0-1)
 * @param {Object} analysis - Aggregated analysis data
 *   Must include: totalPeriodsInTimeBlock (number)
 * @returns {{score: number, level: string}} Confidence score (0-100) and level ('high'/'medium'/'low')
 */
basalRateOptimizer.calculateConfidenceScore = function(qualifyingPeriods, analysis) {
  try {
    // Validate inputs
    if (!qualifyingPeriods || !Array.isArray(qualifyingPeriods) || qualifyingPeriods.length === 0) {
      return { score: 0, level: 'low' };
    }
    
    if (!analysis || typeof analysis.totalPeriodsInTimeBlock !== 'number') {
      return { score: 0, level: 'low' };
    }
    
    var score = 0;
    
    // Requirement 4.1: Duration component (max 30 points)
    // Calculate average duration across qualifying periods
    var totalDuration = 0;
    for (var i = 0; i < qualifyingPeriods.length; i++) {
      var duration = qualifyingPeriods[i].duration || 0;
      if (typeof duration !== 'number' || isNaN(duration)) {
        throw new Error('Invalid duration value at index ' + i);
      }
      totalDuration += duration;
    }
    var avgDuration = totalDuration / qualifyingPeriods.length;
    
    if (isNaN(avgDuration)) {
      throw new Error('Average duration is NaN');
    }
    
    var durationScore = Math.min(avgDuration / 6, 1.0) * 30;
    score += durationScore;
    
    // Requirement 4.2: Stability component (max 30 points)
    // Calculate average CV% across qualifying periods
    var totalCV = 0;
    for (var j = 0; j < qualifyingPeriods.length; j++) {
      var cv = qualifyingPeriods[j].cv || 0;
      if (typeof cv !== 'number' || isNaN(cv)) {
        throw new Error('Invalid CV value at index ' + j);
      }
      totalCV += cv;
    }
    var avgCV = totalCV / qualifyingPeriods.length;
    
    if (isNaN(avgCV)) {
      throw new Error('Average CV is NaN');
    }
    
    var stabilityScore = Math.max(0, (1 - avgCV / 40)) * 30;
    score += stabilityScore;
    
    // Requirement 4.3: Trend strength component (max 20 points)
    // Calculate average R² across qualifying periods
    var totalRSquared = 0;
    for (var k = 0; k < qualifyingPeriods.length; k++) {
      var rSquared = qualifyingPeriods[k].rSquared || 0;
      if (typeof rSquared !== 'number' || isNaN(rSquared)) {
        throw new Error('Invalid R² value at index ' + k);
      }
      totalRSquared += rSquared;
    }
    var avgRSquared = totalRSquared / qualifyingPeriods.length;
    
    if (isNaN(avgRSquared)) {
      throw new Error('Average R² is NaN');
    }
    
    var trendScore = avgRSquared * 20;
    score += trendScore;
    
    // Requirement 4.4: Consistency component (max 20 points)
    // Based on proportion of qualifying periods to total periods
    var totalPeriods = analysis.totalPeriodsInTimeBlock;
    var consistencyScore = 0;
    if (totalPeriods > 0) {
      consistencyScore = (qualifyingPeriods.length / totalPeriods) * 20;
    }
    score += consistencyScore;
    
    // Round to integer
    score = Math.round(score);
    
    // Ensure score is in valid range [0, 100]
    if (score < 0) score = 0;
    if (score > 100) score = 100;
    
    // Final validation
    if (isNaN(score)) {
      throw new Error('Final confidence score is NaN');
    }
    
    // Classify confidence level (Requirements 4.5, 4.6, 4.7)
    var level;
    if (score >= 70) {
      level = 'high';    // Requirement 4.5
    } else if (score >= 50) {
      level = 'medium';  // Requirement 4.6
    } else {
      level = 'low';     // Requirement 4.7
    }
    
    return {
      score: score,
      level: level
    };
  } catch (error) {
    // Log error for debugging (Requirement 11.4)
    console.error('Confidence score calculation failed:', error.message, {
      qualifyingPeriodsCount: qualifyingPeriods ? qualifyingPeriods.length : 0
    });
    // Return low confidence on error
    return { score: 0, level: 'low' };
  }
};

/**
 * Validate multi-period confirmation requirements
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4
 * 
 * For high-confidence recommendations, ensures that:
 * 1. At least 2 qualifying periods exist (Requirement 6.1)
 * 2. Periods are from different calendar days (Requirement 6.2)
 * 3. All periods show consistent trend direction (same slope sign) (Requirement 6.3)
 * 4. If insufficient periods, caps confidence at 69 (Requirement 6.4)
 * 
 * @param {Array<Object>} qualifyingPeriods - Periods supporting the recommendation
 *   Each period should have: startTime (timestamp), slope (number)
 * @param {number} confidenceScore - Calculated confidence score
 * @returns {{confirmed: boolean, cappedScore: number, reason: string}} Confirmation result
 */
basalRateOptimizer.validateMultiPeriodConfirmation = function(qualifyingPeriods, confidenceScore) {
  // Validate inputs
  if (!qualifyingPeriods || !Array.isArray(qualifyingPeriods)) {
    return {
      confirmed: false,
      cappedScore: Math.min(confidenceScore, 69),
      reason: 'Invalid qualifying periods data'
    };
  }
  
  // Requirement 6.1: Need at least 2 qualifying periods for high confidence
  if (qualifyingPeriods.length < 2) {
    return {
      confirmed: false,
      cappedScore: Math.min(confidenceScore, 69), // Requirement 6.4
      reason: 'Insufficient qualifying periods (need at least 2)'
    };
  }
  
  // Requirement 6.2: Periods must be from different calendar days
  var uniqueDays = {};
  for (var i = 0; i < qualifyingPeriods.length; i++) {
    var period = qualifyingPeriods[i];
    var dayKey = moment(period.startTime).format('YYYY-MM-DD');
    uniqueDays[dayKey] = true;
  }
  
  var uniqueDayCount = Object.keys(uniqueDays).length;
  if (uniqueDayCount < 2) {
    return {
      confirmed: false,
      cappedScore: Math.min(confidenceScore, 69), // Requirement 6.4
      reason: 'Periods not from different days (need at least 2 different days)'
    };
  }
  
  // Requirement 6.3: Verify trend consistency (same slope sign)
  // Get the sign of the first period's slope
  var firstSlope = qualifyingPeriods[0].slope;
  var expectedSign = Math.sign(firstSlope);
  
  // Check if all periods have the same slope sign
  for (var j = 0; j < qualifyingPeriods.length; j++) {
    var currentSlope = qualifyingPeriods[j].slope;
    var currentSign = Math.sign(currentSlope);
    
    // If signs don't match (and neither is zero), trends are inconsistent
    if (expectedSign !== 0 && currentSign !== 0 && expectedSign !== currentSign) {
      return {
        confirmed: false,
        cappedScore: Math.min(confidenceScore, 69), // Requirement 6.4
        reason: 'Inconsistent trend directions across periods'
      };
    }
  }
  
  // All checks passed - multi-period confirmation successful
  return {
    confirmed: true,
    cappedScore: confidenceScore, // No capping needed
    reason: null
  };
};

// ============================================================================
// PROFILE DATA INTEGRATION
// ============================================================================

/**
 * Read profile data from Nightscout profile object
 * 
 * Requirements: 10.1, 10.2, 10.3
 * 
 * Extracts basal rate schedule and ISF from the Nightscout profile object.
 * The profile object uses methods like getBasal(time) and getSensitivity(time)
 * to get values at specific times. This function converts that into a simpler
 * structure for the basal rate optimizer.
 * 
 * @param {Object} profile - Nightscout profile object with getBasal() and getSensitivity() methods
 * @param {number} referenceTime - Optional reference time (ms) for profile lookup, defaults to now
 * @returns {Object} Profile data with basalSchedule and isf, or defaults with warnings
 */
basalRateOptimizer.readProfileData = function(profile, referenceTime) {
  var result = {
    basalSchedule: [],
    isf: null,
    warnings: []
  };
  
  // Use current time if not specified
  referenceTime = referenceTime || Date.now();
  
  // Requirement 10.3: Handle missing or incomplete profile data with defaults
  if (!profile) {
    result.warnings.push('No profile data available. Using default values.');
    result.basalSchedule = [{ time: '00:00', value: 1.0 }];
    result.isf = 50;
    return result;
  }
  
  // Requirement 10.2: Read ISF value from profile
  try {
    var isf = profile.getSensitivity ? profile.getSensitivity(referenceTime) : null;
    if (typeof isf === 'number' && isf > 0) {
      result.isf = isf;
    } else {
      result.warnings.push('ISF not found in profile. Using default value of 50 mg/dL per unit.');
      result.isf = 50;
    }
  } catch (error) {
    console.error('Error reading ISF from profile:', error);
    result.warnings.push('Error reading ISF from profile. Using default value of 50 mg/dL per unit.');
    result.isf = 50;
  }
  
  // Requirement 10.1: Read basal rate schedule from profile
  // We need to sample the basal rates at different times throughout the day
  // to build a schedule. We'll sample every hour (24 samples).
  try {
    if (profile.getBasal) {
      var basalRates = [];
      var dayStart = moment(referenceTime).startOf('day').valueOf();
      
      // Sample basal rates every hour
      for (var hour = 0; hour < 24; hour++) {
        var timeMs = dayStart + (hour * 60 * 60 * 1000);
        var basal = profile.getBasal(timeMs);
        
        if (typeof basal === 'number' && basal >= 0) {
          basalRates.push({
            hour: hour,
            value: basal
          });
        }
      }
      
      // Convert to schedule format by detecting changes
      // Only add entries when the basal rate changes
      if (basalRates.length > 0) {
        var currentRate = basalRates[0].value;
        result.basalSchedule.push({
          time: '00:00',
          value: currentRate
        });
        
        for (var i = 1; i < basalRates.length; i++) {
          if (basalRates[i].value !== currentRate) {
            currentRate = basalRates[i].value;
            var hourStr = basalRates[i].hour.toString().padStart(2, '0');
            result.basalSchedule.push({
              time: hourStr + ':00',
              value: currentRate
            });
          }
        }
      } else {
        result.warnings.push('No basal rates found in profile. Using default value of 1.0 U/hr.');
        result.basalSchedule = [{ time: '00:00', value: 1.0 }];
      }
    } else {
      result.warnings.push('Profile does not support getBasal(). Using default basal rate of 1.0 U/hr.');
      result.basalSchedule = [{ time: '00:00', value: 1.0 }];
    }
  } catch (error) {
    console.error('Error reading basal schedule from profile:', error);
    result.warnings.push('Error reading basal schedule from profile. Using default value of 1.0 U/hr.');
    result.basalSchedule = [{ time: '00:00', value: 1.0 }];
  }
  
  return result;
};

/**
 * Get current basal rate for a time block from profile data
 * 
 * Requirement: 10.4
 * 
 * Finds the active basal rate for a given time block. When multiple basal rate
 * segments exist within a time block, uses the rate that is active at the start
 * of the fasting period (represented by the middle of the time block).
 * 
 * @param {string} timeBlock - Time block identifier ('overnight', 'morning', 'afternoon', 'evening')
 * @param {Object} profileData - Profile data with basalSchedule array
 * @returns {number} Basal rate in U/hr, or 1.0 as default
 */
basalRateOptimizer.getCurrentBasalRate = function(timeBlock, profileData) {
  // Default basal rate if profile data is not available
  var DEFAULT_BASAL_RATE = 1.0;
  
  // Validate profile data
  if (!profileData || !profileData.basalSchedule || !Array.isArray(profileData.basalSchedule)) {
    return DEFAULT_BASAL_RATE;
  }
  
  // Map time blocks to representative hours (middle of the block)
  // Requirement 10.4: Use the rate active at the start of the fasting period
  var timeBlockHours = {
    overnight: 2,   // 2 AM (middle of 10 PM - 6 AM)
    morning: 9,     // 9 AM (middle of 6 AM - 12 PM)
    afternoon: 15,  // 3 PM (middle of 12 PM - 6 PM)
    evening: 20     // 8 PM (middle of 6 PM - 10 PM)
  };
  
  var targetHour = timeBlockHours[timeBlock];
  if (typeof targetHour === 'undefined') {
    return DEFAULT_BASAL_RATE;
  }
  
  // Find the active basal rate segment for this time
  // Basal schedule is sorted by time, find the last segment that starts before or at target hour
  var activeRate = DEFAULT_BASAL_RATE;
  
  for (var i = 0; i < profileData.basalSchedule.length; i++) {
    var segment = profileData.basalSchedule[i];
    
    // Parse time string (format: "HH:MM")
    var timeParts = segment.time.split(':');
    var segmentHour = parseInt(timeParts[0], 10);
    
    // If this segment starts at or before our target hour, it might be active
    if (segmentHour <= targetHour) {
      activeRate = segment.value;
    } else {
      // Segments are sorted, so we've passed our target hour
      break;
    }
  }
  
  return activeRate;
};

/**
 * Get ISF (Insulin Sensitivity Factor) from profile data
 * 
 * Helper function to extract ISF value from profile.
 * 
 * @param {Object} profileData - User's profile data
 * @returns {number} ISF in mg/dL per unit, or 50 as default
 */
basalRateOptimizer.getISF = function(profileData) {
  var DEFAULT_ISF = 50;
  
  if (!profileData || typeof profileData.isf !== 'number' || profileData.isf <= 0) {
    return DEFAULT_ISF;
  }
  
  return profileData.isf;
};

// ============================================================================
// RECOMMENDATION ENGINE
// ============================================================================

/**
 * Generate recommendation for a time block
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7
 * 
 * Main function that orchestrates the complete recommendation generation process:
 * 1. Analyzes each fasting period (statistical analysis)
 * 2. Validates periods (safety checks)
 * 3. Filters qualifying periods
 * 4. Calculates adjustment and confidence score
 * 5. Validates multi-period confirmation
 * 6. Generates complete recommendation object
 * 
 * @param {string} timeBlock - Time block identifier ('overnight', 'morning', 'afternoon', 'evening')
 * @param {Array<Object>} periods - Fasting periods for this time block
 * @param {Object} profileData - User's profile settings (basal rates, ISF)
 * @returns {Object} Complete recommendation with all required fields
 */
basalRateOptimizer.generateRecommendation = function(timeBlock, periods, profileData) {
  try {
    // Validate inputs
    if (!timeBlock || !periods || !Array.isArray(periods)) {
      return {
        timeBlock: timeBlock,
        timeBlockLabel: basalRateOptimizer.getTimeBlockLabel(timeBlock),
        error: 'INVALID_INPUT',
        message: 'Invalid input parameters',
        recommendation: 'NO CHANGE - Invalid data'
      };
    }
    
    // Requirement 7.7: Handle insufficient data
    if (periods.length === 0) {
      var noDataWarnings = [
        basalRateOptimizer.generateInsufficientDataWarning(0, 0),
        basalRateOptimizer.generateImplementationSafetyWarning()
      ];
      
      // Add profile warnings if available
      if (profileData && profileData.warnings && profileData.warnings.length > 0) {
        var profileWarning = basalRateOptimizer.generateMissingProfileWarning(profileData.warnings);
        if (profileWarning) {
          noDataWarnings.unshift(profileWarning);
        }
      }
      
      return {
        timeBlock: timeBlock,
        timeBlockLabel: basalRateOptimizer.getTimeBlockLabel(timeBlock),
        error: 'NO_DATA',
        message: 'No fasting periods found for this time block',
        recommendation: 'NO CHANGE - Need more data',
        currentBasalRate: basalRateOptimizer.getCurrentBasalRate(timeBlock, profileData),
        adjustment: 0,
        newBasalRate: basalRateOptimizer.getCurrentBasalRate(timeBlock, profileData),
        confidenceScore: 0,
        confidenceLevel: 'low',
        warnings: noDataWarnings
      };
    }
    
    // Analyze and validate each period
    var analyzedPeriods = [];
    
    console.log('Basal Rate Optimizer: Analyzing', periods.length, 'periods for', timeBlock);
    
    for (var i = 0; i < periods.length; i++) {
      var period = periods[i];
      
      try {
        // Validate period data structure
        var dataValidation = basalRateOptimizer.validateFastingPeriodData(period);
        if (!dataValidation.valid) {
          console.log('Period', i, 'failed data validation:', dataValidation.reason);
          continue; // Skip invalid periods
        }
        
        // Calculate linear regression
        var regression = basalRateOptimizer.calculateLinearRegression(period.glucoseReadings);
        
        // Classify trend
        var trend = basalRateOptimizer.classifyTrend(regression.slope, regression.rSquared);
        
        // Calculate CV%
        var glucoseValues = period.glucoseReadings.map(function(r) { return r.sgv; });
        var cv = basalRateOptimizer.calculateCV(glucoseValues);
        
        // Calculate duration in hours
        var duration = (period.endTime - period.startTime) / (1000 * 60 * 60);
        
        // Create analysis object
        var analysis = {
          slope: regression.slope,
          intercept: regression.intercept,
          rSquared: regression.rSquared,
          trend: trend,
          cv: cv,
          duration: duration,
          startTime: period.startTime,
          date: moment(period.startTime).format('YYYY-MM-DD')
        };
        
        // Validate period for qualification
        var validation = basalRateOptimizer.validateFastingPeriod(period, analysis);
        
        analysis.qualified = validation.qualified;
        analysis.disqualificationReason = validation.reason;
        
        if (!validation.qualified) {
          console.log('Period', i, 'disqualified:', validation.reason, {
            duration: analysis.duration,
            cv: analysis.cv,
            slope: analysis.slope
          });
        } else {
          console.log('Period', i, 'QUALIFIED:', {
            duration: analysis.duration,
            cv: analysis.cv,
            slope: analysis.slope,
            trend: analysis.trend
          });
        }
        
        analyzedPeriods.push(analysis);
        
      } catch (error) {
        console.error('Error analyzing period:', error);
        // Continue with other periods
      }
    }
    
    // Filter to get only qualifying periods
    var qualifyingPeriods = analyzedPeriods.filter(function(p) { return p.qualified; });
    
    console.log('Basal Rate Optimizer:', timeBlock, '- Total periods:', periods.length, 
                'Analyzed:', analyzedPeriods.length, 'Qualifying:', qualifyingPeriods.length);
    
    // Requirement 7.7: Handle insufficient qualifying data
    if (qualifyingPeriods.length === 0) {
      var noQualifyingWarnings = [
        basalRateOptimizer.generateInsufficientDataWarning(0, periods.length),
        basalRateOptimizer.generateImplementationSafetyWarning()
      ];
      
      // Add profile warnings if available
      if (profileData && profileData.warnings && profileData.warnings.length > 0) {
        var noQualifyingProfileWarning = basalRateOptimizer.generateMissingProfileWarning(profileData.warnings);
        if (noQualifyingProfileWarning) {
          noQualifyingWarnings.unshift(noQualifyingProfileWarning);
        }
      }
      
      return {
        timeBlock: timeBlock,
        timeBlockLabel: basalRateOptimizer.getTimeBlockLabel(timeBlock),
        error: 'NO_QUALIFYING_DATA',
        message: 'No qualifying fasting periods found. Periods may be too short, too variable, or contain hypo/hyperglycemia.',
        recommendation: 'NO CHANGE - Need more qualifying data',
        currentBasalRate: basalRateOptimizer.getCurrentBasalRate(timeBlock, profileData),
        adjustment: 0,
        newBasalRate: basalRateOptimizer.getCurrentBasalRate(timeBlock, profileData),
        confidenceScore: 0,
        confidenceLevel: 'low',
        totalPeriods: periods.length,
        qualifyingPeriods: 0,
        warnings: noQualifyingWarnings
      };
    }
    
    // Calculate average slope across qualifying periods
    var totalSlope = 0;
    var totalExtraInsulin = 0;
    var totalDuration = 0;
    var periodsWithAutomation = 0;
    
    for (var j = 0; j < qualifyingPeriods.length; j++) {
      totalSlope += qualifyingPeriods[j].slope;
      
      // Calculate insulin delivery for this period
      var period = periods[j]; // Get original period with treatments
      if (period && period.treatments) {
        var currentBasalForPeriod = basalRateOptimizer.getCurrentBasalRate(timeBlock, profileData);
        var insulinDelivery = basalRateOptimizer.calculateInsulinDelivery(period, currentBasalForPeriod);
        
        if (insulinDelivery.hasAutomation) {
          totalExtraInsulin += insulinDelivery.extraInsulin;
          totalDuration += period.duration;
          periodsWithAutomation++;
          
          console.log('💉 Period', j, 'insulin delivery:', insulinDelivery.details, 
                      'Extra:', insulinDelivery.extraInsulin.toFixed(2), 'U');
        }
      }
    }
    
    var avgSlope = totalSlope / qualifyingPeriods.length;
    
    // Calculate average insulin delivery data
    var avgInsulinDelivery = null;
    if (periodsWithAutomation > 0 && totalDuration > 0) {
      avgInsulinDelivery = {
        extraInsulin: totalExtraInsulin / periodsWithAutomation,
        hasAutomation: true,
        periodsWithAutomation: periodsWithAutomation
      };
      console.log('💉 Average extra insulin across', periodsWithAutomation, 'periods:', 
                  (totalExtraInsulin / periodsWithAutomation).toFixed(2), 'U');
    }
    
    // Get profile data
    var currentBasalRate = basalRateOptimizer.getCurrentBasalRate(timeBlock, profileData);
    var isf = basalRateOptimizer.getISF(profileData);
    
    // Calculate average duration for adjustment calculation
    var avgDuration = totalDuration > 0 ? totalDuration / periodsWithAutomation : 
                      qualifyingPeriods.reduce(function(sum, p) { return sum + p.duration; }, 0) / qualifyingPeriods.length;
    
    // Calculate adjustment accounting for automated insulin delivery (Requirement 7.2)
    var adjustment = basalRateOptimizer.calculateAdjustment(avgSlope, isf, currentBasalRate, avgInsulinDelivery, avgDuration);
    
    // Calculate new basal rate (Requirement 7.3)
    var newBasalRate = currentBasalRate + adjustment;
    newBasalRate = basalRateOptimizer.roundTo(newBasalRate, 2);
    
    // Calculate confidence score (Requirement 7.4)
    var confidenceResult = basalRateOptimizer.calculateConfidenceScore(
      qualifyingPeriods,
      { totalPeriodsInTimeBlock: periods.length }
    );
    
    // Validate multi-period confirmation and apply confidence capping if needed
    var confirmation = basalRateOptimizer.validateMultiPeriodConfirmation(
      qualifyingPeriods,
      confidenceResult.score
    );
    
    var finalConfidenceScore = confirmation.cappedScore;
    
    // Reclassify confidence level based on capped score
    var finalConfidenceLevel;
    if (finalConfidenceScore >= 70) {
      finalConfidenceLevel = 'high';
    } else if (finalConfidenceScore >= 50) {
      finalConfidenceLevel = 'medium';
    } else {
      finalConfidenceLevel = 'low';
    }
    
    // Generate reasoning text (Requirement 7.5)
    var reasoning = {
      avgSlope: basalRateOptimizer.roundTo(avgSlope, 2),
      avgCV: basalRateOptimizer.roundTo(
        qualifyingPeriods.reduce(function(sum, p) { return sum + p.cv; }, 0) / qualifyingPeriods.length,
        1
      ),
      qualifyingPeriods: qualifyingPeriods.length,
      totalPeriods: periods.length,
      trendDirection: avgSlope > 5 ? 'rising' : (avgSlope < -5 ? 'falling' : 'stable'),
      confirmationStatus: confirmation.confirmed ? 'confirmed' : confirmation.reason
    };
    
    // Generate supporting data (Requirement 7.6)
    var supportingData = qualifyingPeriods.map(function(p) {
      return {
        date: p.date,
        slope: basalRateOptimizer.roundTo(p.slope, 2),
        duration: basalRateOptimizer.roundTo(p.duration, 1),
        cv: basalRateOptimizer.roundTo(p.cv, 1)
      };
    });
    
    // Generate recommendation text
    var recommendationText;
    if (adjustment === 0) {
      recommendationText = 'NO CHANGE - Current basal rate appears appropriate';
    } else if (adjustment > 0) {
      recommendationText = 'INCREASE by ' + basalRateOptimizer.roundTo(adjustment, 2) + ' U/hr';
    } else {
      recommendationText = 'DECREASE by ' + basalRateOptimizer.roundTo(Math.abs(adjustment), 2) + ' U/hr';
    }
    
    // Generate warnings (Requirements 11.1, 11.2, 11.3, 11.5)
    // Need to pass the original periods with glucose readings for near-hypo detection
    var periodsWithGlucose = qualifyingPeriods.map(function(analyzedPeriod) {
      // Find the original period that matches this analyzed period
      for (var k = 0; k < periods.length; k++) {
        if (periods[k].startTime === analyzedPeriod.startTime) {
          return periods[k];
        }
      }
      return null;
    }).filter(function(p) { return p !== null; });
    
    var warnings = basalRateOptimizer.generateWarnings({
      qualifyingPeriods: periodsWithGlucose,
      totalPeriods: periods.length,
      profileWarnings: profileData ? profileData.warnings : [],
      adjustment: adjustment
    });
    
    // Return complete recommendation object (Requirements 7.1-7.6)
    return {
      timeBlock: timeBlock,
      timeBlockLabel: basalRateOptimizer.getTimeBlockLabel(timeBlock),
      currentBasalRate: currentBasalRate,           // Requirement 7.1
      adjustment: adjustment,                        // Requirement 7.2
      newBasalRate: newBasalRate,                   // Requirement 7.3
      confidenceScore: finalConfidenceScore,        // Requirement 7.4
      confidenceLevel: finalConfidenceLevel,        // Requirement 7.4
      recommendation: recommendationText,
      reasoning: reasoning,                          // Requirement 7.5
      supportingData: supportingData,               // Requirement 7.6
      totalPeriods: periods.length,
      qualifyingPeriods: qualifyingPeriods.length,
      warnings: warnings                             // Requirements 11.1, 11.2, 11.3, 11.5
    };
    
  } catch (error) {
    // Requirement 11.4: Log error and display user-friendly message
    console.error('Error generating recommendation for ' + timeBlock + ':', error);
    
    var errorWarnings = [
      basalRateOptimizer.generateCalculationErrorMessage(error),
      basalRateOptimizer.generateImplementationSafetyWarning()
    ];
    
    // Add profile warnings if available
    if (profileData && profileData.warnings && profileData.warnings.length > 0) {
      var errorProfileWarning = basalRateOptimizer.generateMissingProfileWarning(profileData.warnings);
      if (errorProfileWarning) {
        errorWarnings.unshift(errorProfileWarning);
      }
    }
    
    return {
      timeBlock: timeBlock,
      timeBlockLabel: basalRateOptimizer.getTimeBlockLabel(timeBlock),
      error: 'CALCULATION_ERROR',
      message: 'An error occurred while generating the recommendation: ' + error.message,
      recommendation: 'NO CHANGE - Calculation error',
      currentBasalRate: basalRateOptimizer.getCurrentBasalRate(timeBlock, profileData),
      adjustment: 0,
      newBasalRate: basalRateOptimizer.getCurrentBasalRate(timeBlock, profileData),
      confidenceScore: 0,
      confidenceLevel: 'low',
      warnings: errorWarnings
    };
  }
};

// ============================================================================
// ERROR HANDLING AND WARNING GENERATION
// ============================================================================

/**
 * Check if glucose is approaching hypoglycemia (near 70 mg/dL)
 * 
 * Requirement: 11.1
 * 
 * Detects if glucose readings are trending toward hypoglycemia (within 10 mg/dL
 * of the 70 mg/dL threshold). This is used to generate warnings about monitoring
 * closely after any rate increase.
 * 
 * @param {Array<{mills: number, sgv: number}>} glucoseReadings - CGM data points
 * @returns {boolean} True if glucose is approaching hypoglycemia
 */
basalRateOptimizer.detectNearHypoglycemia = function(glucoseReadings) {
  if (!glucoseReadings || !Array.isArray(glucoseReadings) || glucoseReadings.length === 0) {
    return false;
  }
  
  var HYPO_THRESHOLD = 70; // mg/dL
  var NEAR_HYPO_MARGIN = 10; // mg/dL - within 10 mg/dL of threshold
  var NEAR_HYPO_THRESHOLD = HYPO_THRESHOLD + NEAR_HYPO_MARGIN; // 80 mg/dL
  
  // Check if any readings are between 70 and 80 mg/dL
  for (var i = 0; i < glucoseReadings.length; i++) {
    var reading = glucoseReadings[i];
    if (reading.sgv >= HYPO_THRESHOLD && reading.sgv <= NEAR_HYPO_THRESHOLD) {
      return true;
    }
  }
  
  return false;
};

/**
 * Generate near-hypoglycemia warning
 * 
 * Requirement: 11.1
 * 
 * Creates a warning message when glucose is approaching hypoglycemia,
 * advising the user to monitor closely after any rate increase.
 * 
 * @param {Array<Object>} qualifyingPeriods - Periods supporting the recommendation
 * @returns {string|null} Warning message or null if no warning needed
 */
basalRateOptimizer.generateNearHypoglycemiaWarning = function(qualifyingPeriods) {
  if (!qualifyingPeriods || !Array.isArray(qualifyingPeriods)) {
    return null;
  }
  
  // Check each qualifying period for near-hypoglycemia
  for (var i = 0; i < qualifyingPeriods.length; i++) {
    var period = qualifyingPeriods[i];
    if (period.glucoseReadings && basalRateOptimizer.detectNearHypoglycemia(period.glucoseReadings)) {
      return '⚠️ WARNING: Some fasting periods show glucose approaching hypoglycemia (70-80 mg/dL). ' +
             'Monitor blood glucose closely after any basal rate increase. Consider consulting your ' +
             'healthcare provider before implementing this recommendation.';
    }
  }
  
  return null;
};

/**
 * Generate insufficient data warning
 * 
 * Requirement: 11.2
 * 
 * Creates a message indicating that more data is needed for a reliable
 * recommendation when there are too few qualifying periods.
 * 
 * @param {number} qualifyingCount - Number of qualifying periods
 * @param {number} totalCount - Total number of periods in time block
 * @returns {string} Warning message
 */
basalRateOptimizer.generateInsufficientDataWarning = function(qualifyingCount, totalCount) {
  if (qualifyingCount === 0) {
    return '📊 Insufficient data: No qualifying fasting periods found for this time block. ' +
           'Periods may be too short, too variable, or contain hypo/hyperglycemia. ' +
           'Continue monitoring to collect more qualifying data.';
  } else if (qualifyingCount === 1) {
    return '📊 Limited data: Only 1 qualifying fasting period found. ' +
           'At least 2 periods from different days are needed for a high-confidence recommendation. ' +
           'Continue monitoring to collect more data.';
  } else {
    return '📊 Limited data: Only ' + qualifyingCount + ' qualifying periods found out of ' + totalCount + ' total. ' +
           'More qualifying data would improve recommendation confidence.';
  }
};

/**
 * Generate missing profile warning
 * 
 * Requirement: 11.3
 * 
 * Creates a warning message when profile data is missing or incomplete,
 * indicating that default values are being used.
 * 
 * @param {Array<string>} profileWarnings - Array of profile-related warnings
 * @returns {string|null} Warning message or null if no warning needed
 */
basalRateOptimizer.generateMissingProfileWarning = function(profileWarnings) {
  if (!profileWarnings || !Array.isArray(profileWarnings) || profileWarnings.length === 0) {
    return null;
  }
  
  return '⚙️ Profile Warning: ' + profileWarnings.join(' ') + ' ' +
         'For more accurate recommendations, please update your Nightscout profile with your ' +
         'current basal rate schedule and insulin sensitivity factor (ISF).';
};

/**
 * Generate implementation safety warning
 * 
 * Requirement: 11.5
 * 
 * Creates a standard warning about safe implementation practices that should
 * be displayed with any recommendation.
 * 
 * @returns {string} Safety warning message
 */
basalRateOptimizer.generateImplementationSafetyWarning = function() {
  return '⚠️ Implementation Safety: Test one time period at a time and wait 2-3 days between ' +
         'adjustments to clearly observe the effect of each change. Always monitor blood glucose ' +
         'closely after making any basal rate adjustment.';
};

/**
 * Generate calculation error message
 * 
 * Requirement: 11.4
 * 
 * Creates a user-friendly error message when calculation errors occur,
 * indicating that the recommendation could not be generated.
 * 
 * @param {Error} error - The error object
 * @returns {string} User-friendly error message
 */
basalRateOptimizer.generateCalculationErrorMessage = function(error) {
  var errorType = 'unknown error';
  
  if (error && error.message) {
    // Extract a user-friendly description from the error message
    if (error.message.includes('regression')) {
      errorType = 'statistical analysis error';
    } else if (error.message.includes('data')) {
      errorType = 'data validation error';
    } else if (error.message.includes('division') || error.message.includes('NaN')) {
      errorType = 'calculation error';
    }
  }
  
  return '❌ Calculation Error: Unable to generate recommendation due to ' + errorType + '. ' +
         'This may be caused by insufficient or invalid data. Please try again with more data, ' +
         'or contact support if the problem persists.';
};

/**
 * Collect and generate all warnings for a recommendation
 * 
 * Requirements: 11.1, 11.2, 11.3, 11.5
 * 
 * Aggregates all applicable warnings for a recommendation based on the
 * analysis results and data quality.
 * 
 * @param {Object} params - Parameters object
 * @param {Array<Object>} params.qualifyingPeriods - Qualifying periods with glucose data
 * @param {number} params.totalPeriods - Total periods in time block
 * @param {Array<string>} params.profileWarnings - Profile-related warnings
 * @param {number} params.adjustment - Recommended adjustment value
 * @returns {Array<string>} Array of warning messages
 */
basalRateOptimizer.generateWarnings = function(params) {
  var warnings = [];
  
  if (!params) {
    return warnings;
  }
  
  var qualifyingPeriods = params.qualifyingPeriods || [];
  var totalPeriods = params.totalPeriods || 0;
  var profileWarnings = params.profileWarnings || [];
  var adjustment = params.adjustment || 0;
  
  // Requirement 11.1: Near-hypoglycemia warning (only if recommending an increase)
  if (adjustment > 0) {
    var nearHypoWarning = basalRateOptimizer.generateNearHypoglycemiaWarning(qualifyingPeriods);
    if (nearHypoWarning) {
      warnings.push(nearHypoWarning);
    }
  }
  
  // Requirement 11.2: Insufficient data warning
  if (qualifyingPeriods.length < 2) {
    var insufficientDataWarning = basalRateOptimizer.generateInsufficientDataWarning(
      qualifyingPeriods.length,
      totalPeriods
    );
    warnings.push(insufficientDataWarning);
  }
  
  // Requirement 11.3: Missing profile warning
  if (profileWarnings.length > 0) {
    var profileWarning = basalRateOptimizer.generateMissingProfileWarning(profileWarnings);
    if (profileWarning) {
      warnings.push(profileWarning);
    }
  }
  
  // Requirement 11.5: Implementation safety warning (always included)
  warnings.push(basalRateOptimizer.generateImplementationSafetyWarning());
  
  return warnings;
};

// ============================================================================
// UI FORMATTER AND DISPLAY GENERATION
// ============================================================================

/**
 * Get color coding for confidence level
 * 
 * Requirement: 8.3
 * 
 * Returns color code based on confidence score:
 * - Green: High confidence (>= 70)
 * - Yellow: Medium confidence (>= 50 and < 70)
 * - Red: Low confidence (< 50)
 * 
 * @param {number} confidenceScore - Score 0-100
 * @returns {string} Color code ('green', 'yellow', 'red')
 */
basalRateOptimizer.getConfidenceColor = function(confidenceScore) {
  if (typeof confidenceScore !== 'number') {
    return 'red';
  }
  
  if (confidenceScore >= 70) {
    return 'green';  // High confidence
  } else if (confidenceScore >= 50) {
    return 'yellow'; // Medium confidence
  } else {
    return 'red';    // Low confidence
  }
};

/**
 * Format supporting data for display
 * 
 * Requirement: 8.5
 * 
 * Formats individual period data (date, slope, duration, CV%) into a readable
 * HTML table format for display in the recommendations section.
 * 
 * @param {Array<Object>} supportingData - Array of period data objects
 *   Each object should have: date, slope, duration, cv
 * @returns {string} HTML table string
 */
basalRateOptimizer.formatSupportingData = function(supportingData) {
  if (!supportingData || !Array.isArray(supportingData) || supportingData.length === 0) {
    return '<p><em>No supporting data available</em></p>';
  }
  
  var html = '<table class="basal-optimizer-supporting-data">';
  html += '<thead>';
  html += '<tr>';
  html += '<th>Date</th>';
  html += '<th>Slope (mg/dL/hr)</th>';
  html += '<th>Duration (hrs)</th>';
  html += '<th>CV%</th>';
  html += '</tr>';
  html += '</thead>';
  html += '<tbody>';
  
  supportingData.forEach(function(data) {
    html += '<tr>';
    html += '<td>' + (data.date || 'N/A') + '</td>';
    html += '<td>' + (typeof data.slope === 'number' ? data.slope.toFixed(2) : 'N/A') + '</td>';
    html += '<td>' + (typeof data.duration === 'number' ? data.duration.toFixed(1) : 'N/A') + '</td>';
    html += '<td>' + (typeof data.cv === 'number' ? data.cv.toFixed(1) : 'N/A') + '</td>';
    html += '</tr>';
  });
  
  html += '</tbody>';
  html += '</table>';
  
  return html;
};

/**
 * Generate HTML for a single time block recommendation card
 * 
 * Helper function for generateRecommendationsHTML
 * 
 * @param {Object} recommendation - Recommendation object for a time block
 * @returns {string} HTML string for the recommendation card
 */
basalRateOptimizer.generateTimeBlockHTML = function(recommendation) {
  if (!recommendation) {
    return '';
  }
  
  var color = basalRateOptimizer.getConfidenceColor(recommendation.confidenceScore);
  var colorClass = 'confidence-' + color;
  
  var html = '<div class="basal-optimizer-time-block ' + colorClass + '">';
  
  // Header with time block label
  html += '<h4>' + recommendation.timeBlockLabel + '</h4>';
  
  // Confidence badge
  var confidenceLabel = recommendation.confidenceLevel || 'low';
  html += '<div class="confidence-badge confidence-' + color + '">';
  html += confidenceLabel.toUpperCase() + ' CONFIDENCE (' + (recommendation.confidenceScore || 0) + ')';
  html += '</div>';
  
  // Current and recommended rates
  html += '<div class="basal-rates">';
  html += '<div class="rate-item">';
  html += '<span class="rate-label">Current Rate:</span> ';
  html += '<span class="rate-value">' + (recommendation.currentBasalRate || 0).toFixed(2) + ' U/hr</span>';
  html += '</div>';
  
  if (recommendation.adjustment !== 0) {
    html += '<div class="rate-item">';
    html += '<span class="rate-label">Adjustment:</span> ';
    var adjustmentSign = recommendation.adjustment > 0 ? '+' : '';
    html += '<span class="rate-value adjustment">' + adjustmentSign + (recommendation.adjustment || 0).toFixed(2) + ' U/hr</span>';
    html += '</div>';
    
    html += '<div class="rate-item">';
    html += '<span class="rate-label">New Rate:</span> ';
    html += '<span class="rate-value new-rate">' + (recommendation.newBasalRate || 0).toFixed(2) + ' U/hr</span>';
    html += '</div>';
  }
  html += '</div>';
  
  // Recommendation text
  html += '<div class="recommendation-text">';
  html += '<strong>Recommendation:</strong> ' + (recommendation.recommendation || 'NO CHANGE');
  html += '</div>';
  
  // Reasoning
  if (recommendation.reasoning) {
    html += '<div class="reasoning">';
    html += '<strong>Analysis:</strong><br>';
    html += 'Average slope: ' + (recommendation.reasoning.avgSlope || 0) + ' mg/dL/hr<br>';
    html += 'Average CV: ' + (recommendation.reasoning.avgCV || 0) + '%<br>';
    html += 'Qualifying periods: ' + (recommendation.reasoning.qualifyingPeriods || 0) + ' of ' + (recommendation.reasoning.totalPeriods || 0) + '<br>';
    html += 'Trend: ' + (recommendation.reasoning.trendDirection || 'stable');
    html += '</div>';
  }
  
  // Supporting data
  if (recommendation.supportingData && recommendation.supportingData.length > 0) {
    html += '<div class="supporting-data">';
    html += '<strong>Supporting Data:</strong>';
    html += basalRateOptimizer.formatSupportingData(recommendation.supportingData);
    html += '</div>';
  }
  
  // Error or warning messages
  if (recommendation.error || recommendation.message) {
    html += '<div class="message">';
    html += '<em>' + (recommendation.message || 'Error: ' + recommendation.error) + '</em>';
    html += '</div>';
  }
  
  // Display warnings (Requirements 11.1, 11.2, 11.3, 11.5)
  if (recommendation.warnings && Array.isArray(recommendation.warnings) && recommendation.warnings.length > 0) {
    html += '<div class="warnings-section">';
    recommendation.warnings.forEach(function(warning) {
      html += '<div class="warning-message">' + warning + '</div>';
    });
    html += '</div>';
  }
  
  html += '</div>'; // Close time-block div
  
  return html;
};

/**
 * Generate HTML for recommendations section
 * 
 * Requirements: 8.1, 8.2, 8.4, 8.6
 * 
 * Creates the complete HTML display for basal rate optimization recommendations,
 * including:
 * - Medical disclaimer (Requirement 8.2)
 * - Analysis summary with metadata (Requirement 8.4)
 * - Time block recommendation cards
 * - Safety tips section (Requirement 8.6)
 * 
 * @param {Object} recommendations - Recommendations by time block
 * @param {Object} metadata - Analysis metadata (date range, period count)
 * @returns {string} HTML string for the complete recommendations section
 */
basalRateOptimizer.generateRecommendationsHTML = function(recommendations, metadata) {
  if (!recommendations || !metadata) {
    return '<div class="basal-rate-recommendations"><p>No recommendations available.</p></div>';
  }
  
  var html = '<div class="basal-rate-recommendations">';
  
  // Title
  html += '<h3>Basal Rate Optimization Recommendations</h3>';
  
  // Requirement 8.2: Medical disclaimer
  html += '<div class="disclaimer warning-box">';
  html += '<strong>⚠️ IMPORTANT MEDICAL DISCLAIMER</strong><br>';
  html += 'These are data-driven suggestions based on statistical analysis, NOT medical advice. ';
  html += 'Always consult with your healthcare provider before making any changes to your insulin therapy. ';
  html += 'Your healthcare provider should review these recommendations and approve any adjustments ';
  html += 'based on your individual medical situation, history, and other factors not captured in this analysis.';
  html += '</div>';
  
  // Requirement 8.4: Analysis summary with metadata
  html += '<div class="analysis-summary">';
  html += '<strong>📊 Analysis Summary</strong><br>';
  html += 'Based on <strong>' + (metadata.periodCount || 0) + '</strong> fasting periods<br>';
  html += 'Date range: <strong>' + (metadata.startDate || 'N/A') + '</strong> to <strong>' + (metadata.endDate || 'N/A') + '</strong><br>';
  html += 'Analysis generated: <strong>' + (metadata.analysisDate || 'N/A') + '</strong>';
  html += '</div>';
  
  // Time block recommendation cards
  html += '<div class="time-blocks">';
  
  var timeBlocks = ['overnight', 'morning', 'afternoon', 'evening'];
  timeBlocks.forEach(function(timeBlock) {
    if (recommendations[timeBlock]) {
      html += basalRateOptimizer.generateTimeBlockHTML(recommendations[timeBlock]);
    }
  });
  
  html += '</div>'; // Close time-blocks div
  
  // Requirement 8.6: Safety tips section
  html += '<div class="safety-tips">';
  html += '<h4>💡 Safety Tips for Implementing Changes</h4>';
  html += '<ul>';
  html += '<li><strong>Test one time period at a time</strong> - Only adjust one basal rate segment at a time to clearly see the effect</li>';
  html += '<li><strong>Wait 2-3 days between adjustments</strong> - Give your body time to adjust and collect enough data to evaluate the change</li>';
  html += '<li><strong>Monitor for hypoglycemia</strong> - After any rate increase, watch closely for low blood sugar, especially during sleep</li>';
  html += '<li><strong>Keep detailed notes</strong> - Document all changes made, dates, and observed effects for discussion with your healthcare provider</li>';
  html += '<li><strong>Start with high-confidence recommendations</strong> - Prioritize adjustments with green (high confidence) ratings</li>';
  html += '<li><strong>Be conservative</strong> - When in doubt, make smaller adjustments than recommended and reassess</li>';
  html += '</ul>';
  html += '</div>';
  
  // Task 11.2: Add export buttons (Requirements 9.1, 9.2)
  html += '<div class="export-buttons">';
  html += '<button class="export-button" onclick="exportBasalRecommendationsToCSV()">📥 Export to CSV</button>';
  html += '<button class="export-button" onclick="exportBasalRecommendationsToPDF()">📄 Export to PDF</button>';
  html += '</div>';
  
  html += '</div>'; // Close basal-rate-recommendations div
  
  return html;
};

// ============================================================================
// EXPORT FUNCTIONALITY
// ============================================================================

/**
 * Export recommendations to CSV format
 * 
 * Requirements: 9.2, 9.3, 9.4
 * 
 * Generates a CSV file with columns for time block, current rate, adjustment,
 * new rate, confidence score, and reasoning. Includes medical disclaimer and
 * metadata at the top of the file.
 * 
 * CSV Format:
 * - Header rows with disclaimer and metadata (Requirement 9.3, 9.4)
 * - Column headers
 * - Data rows for each time block (Requirement 9.2)
 * 
 * @param {Object} recommendations - Recommendations by time block
 * @param {Object} metadata - Analysis metadata (date range, period count)
 * @returns {string} CSV string ready for download
 */
basalRateOptimizer.exportToCSV = function(recommendations, metadata) {
  if (!recommendations || !metadata) {
    return 'Error: No recommendations available for export';
  }
  
  var csv = [];
  var DELIMITER = ',';
  var NEWLINE = '\r\n'; // Windows-style line endings for better compatibility
  
  // Helper function to escape CSV values
  function escapeCSV(value) {
    if (value === null || value === undefined) {
      return '';
    }
    
    var stringValue = String(value);
    
    // If value contains comma, quote, or newline, wrap in quotes and escape quotes
    if (stringValue.includes(DELIMITER) || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
      return '"' + stringValue.replace(/"/g, '""') + '"';
    }
    
    return stringValue;
  }
  
  // Requirement 9.3: Include medical disclaimer
  csv.push('BASAL RATE OPTIMIZATION RECOMMENDATIONS');
  csv.push('');
  csv.push('IMPORTANT MEDICAL DISCLAIMER:');
  csv.push('These are data-driven suggestions based on statistical analysis, NOT medical advice.');
  csv.push('Always consult with your healthcare provider before making any changes to your insulin therapy.');
  csv.push('Your healthcare provider should review these recommendations and approve any adjustments');
  csv.push('based on your individual medical situation, history, and other factors not captured in this analysis.');
  csv.push('');
  
  // Requirement 9.4: Include analysis metadata
  csv.push('ANALYSIS METADATA:');
  csv.push('Total Fasting Periods Analyzed' + DELIMITER + escapeCSV(metadata.periodCount || 0));
  csv.push('Date Range Start' + DELIMITER + escapeCSV(metadata.startDate || 'N/A'));
  csv.push('Date Range End' + DELIMITER + escapeCSV(metadata.endDate || 'N/A'));
  csv.push('Analysis Generated' + DELIMITER + escapeCSV(metadata.analysisDate || 'N/A'));
  csv.push('');
  
  // Requirement 9.2: Column headers
  csv.push('RECOMMENDATIONS:');
  var headers = [
    'Time Block',
    'Current Rate (U/hr)',
    'Adjustment (U/hr)',
    'New Rate (U/hr)',
    'Confidence Score',
    'Confidence Level',
    'Recommendation',
    'Avg Slope (mg/dL/hr)',
    'Avg CV (%)',
    'Qualifying Periods',
    'Total Periods',
    'Trend Direction',
    'Warnings'
  ];
  csv.push(headers.map(escapeCSV).join(DELIMITER));
  
  // Requirement 9.2: Data rows for each time block
  var timeBlocks = ['overnight', 'morning', 'afternoon', 'evening'];
  
  timeBlocks.forEach(function(timeBlock) {
    var rec = recommendations[timeBlock];
    
    if (!rec) {
      return; // Skip if no recommendation for this time block
    }
    
    var row = [];
    
    // Time Block
    row.push(escapeCSV(rec.timeBlockLabel || basalRateOptimizer.getTimeBlockLabel(timeBlock)));
    
    // Current Rate
    row.push(escapeCSV(rec.currentBasalRate !== undefined ? rec.currentBasalRate.toFixed(2) : 'N/A'));
    
    // Adjustment
    var adjustmentStr = 'N/A';
    if (rec.adjustment !== undefined) {
      var sign = rec.adjustment > 0 ? '+' : '';
      adjustmentStr = sign + rec.adjustment.toFixed(2);
    }
    row.push(escapeCSV(adjustmentStr));
    
    // New Rate
    row.push(escapeCSV(rec.newBasalRate !== undefined ? rec.newBasalRate.toFixed(2) : 'N/A'));
    
    // Confidence Score
    row.push(escapeCSV(rec.confidenceScore !== undefined ? rec.confidenceScore : 'N/A'));
    
    // Confidence Level
    row.push(escapeCSV(rec.confidenceLevel || 'N/A'));
    
    // Recommendation
    row.push(escapeCSV(rec.recommendation || 'NO CHANGE'));
    
    // Reasoning fields
    if (rec.reasoning) {
      row.push(escapeCSV(rec.reasoning.avgSlope !== undefined ? rec.reasoning.avgSlope : 'N/A'));
      row.push(escapeCSV(rec.reasoning.avgCV !== undefined ? rec.reasoning.avgCV : 'N/A'));
      row.push(escapeCSV(rec.reasoning.qualifyingPeriods !== undefined ? rec.reasoning.qualifyingPeriods : 'N/A'));
      row.push(escapeCSV(rec.reasoning.totalPeriods !== undefined ? rec.reasoning.totalPeriods : 'N/A'));
      row.push(escapeCSV(rec.reasoning.trendDirection || 'N/A'));
    } else {
      row.push('N/A');
      row.push('N/A');
      row.push('N/A');
      row.push('N/A');
      row.push('N/A');
    }
    
    // Warnings - combine all warnings into one cell
    var warningsText = 'None';
    if (rec.warnings && Array.isArray(rec.warnings) && rec.warnings.length > 0) {
      // Remove emoji and clean up warnings for CSV
      warningsText = rec.warnings.map(function(w) {
        // Remove common emoji characters used in warnings
        return w.replace(/⚠️|📊|⚙️|❌|💡/g, '').trim();
      }).join('; ');
    }
    row.push(escapeCSV(warningsText));
    
    csv.push(row.join(DELIMITER));
  });
  
  // Add supporting data section
  csv.push('');
  csv.push('SUPPORTING DATA:');
  csv.push('Time Block' + DELIMITER + 'Date' + DELIMITER + 'Slope (mg/dL/hr)' + DELIMITER + 'Duration (hours)' + DELIMITER + 'CV (%)');
  
  timeBlocks.forEach(function(timeBlock) {
    var rec = recommendations[timeBlock];
    
    if (!rec || !rec.supportingData || !Array.isArray(rec.supportingData) || rec.supportingData.length === 0) {
      return; // Skip if no supporting data
    }
    
    var timeBlockLabel = rec.timeBlockLabel || basalRateOptimizer.getTimeBlockLabel(timeBlock);
    
    rec.supportingData.forEach(function(data) {
      var supportingRow = [
        escapeCSV(timeBlockLabel),
        escapeCSV(data.date || 'N/A'),
        escapeCSV(data.slope !== undefined ? data.slope : 'N/A'),
        escapeCSV(data.duration !== undefined ? data.duration : 'N/A'),
        escapeCSV(data.cv !== undefined ? data.cv : 'N/A')
      ];
      csv.push(supportingRow.join(DELIMITER));
    });
  });
  
  // Add safety tips at the end
  csv.push('');
  csv.push('SAFETY TIPS:');
  csv.push('1. Test one time period at a time - Only adjust one basal rate segment at a time');
  csv.push('2. Wait 2-3 days between adjustments - Give your body time to adjust');
  csv.push('3. Monitor for hypoglycemia - Watch closely for low blood sugar after rate increases');
  csv.push('4. Keep detailed notes - Document all changes and observed effects');
  csv.push('5. Start with high-confidence recommendations - Prioritize green (high confidence) ratings');
  csv.push('6. Be conservative - Make smaller adjustments when in doubt');
  
  // Join all lines with newlines
  return csv.join(NEWLINE);
};

/**
 * Export the plugin for use in Day to Day report
 */
basalRateOptimizer.init = init;
