'use strict';

var moment = window.moment;
var _ = require('lodash');

/**
 * Fasting Period Detection Algorithm for Nightscout
 * 
 * Identifies periods where the user is likely fasting (no food intake)
 * to enable basal rate analysis during insulin-only periods.
 */

var fastingDetection = {
  
  /**
   * Detect fasting periods in a given day
   * @param {Object} dayData - Day's data including treatments and CGM readings
   * @param {Object} options - Configuration options
   * @returns {Array} Array of fasting periods with start/end times and analysis
   */
  detectFastingPeriods: function(dayData, options) {
    options = options || {};
    
    // Default configuration - more lenient for real-world data
    var config = {
      minFastingDuration: options.minFastingDuration || 2, // Reduced from 3 hours
      maxFastingDuration: options.maxFastingDuration || 12, // hours
      carbThreshold: options.carbThreshold || 3, // Reduced from 5 grams
      bolusThreshold: options.bolusThreshold || 0.3, // Reduced from 0.5 units
      iobThreshold: options.iobThreshold || 1.0, // units - max IOB to consider fasting
      glucoseStabilityThreshold: options.glucoseStabilityThreshold || 50, // Increased from 30 mg/dL
      excludeExercise: options.excludeExercise !== false, // exclude exercise periods
      nighttimeWeight: options.nighttimeWeight || 1.5 // weight nighttime periods higher
    };
    
    var treatments = dayData.treatments || [];
    var cgmData = dayData.cgmData || [];
    var dayStart = moment(dayData.date).startOf('day');
    var dayEnd = moment(dayData.date).endOf('day');
    
    console.log('Fasting Detection Debug:', {
      day: dayData.date,
      treatmentCount: treatments.length,
      cgmCount: cgmData.length,
      config: config
    });
    
    // Sort treatments by time
    treatments = _.sortBy(treatments, 'mills');
    cgmData = _.sortBy(cgmData, 'mills');
    
    var fastingPeriods = [];
    var currentPeriodStart = null;
    var lastSignificantTreatment = null;
    
    // Scan through the day in 15-minute intervals
    for (var time = dayStart.clone(); time.isBefore(dayEnd); time.add(15, 'minutes')) {
      var timeMs = time.valueOf();
      
      // Check for treatments that would break fasting
      var recentTreatments = this.getTreatmentsInWindow(treatments, timeMs, 15 * 60 * 1000); // 15 min window
      var breaksFasting = this.checkIfBreaksFasting(recentTreatments, config);
      
      if (breaksFasting) {
        // End current fasting period if it exists
        if (currentPeriodStart) {
          var period = this.createFastingPeriod(currentPeriodStart, time, dayData, config);
          if (period && this.validateFastingPeriod(period, config)) {
            fastingPeriods.push(period);
          }
          currentPeriodStart = null;
        }
        lastSignificantTreatment = time.clone();
      } else {
        // Start new fasting period if not already in one
        if (!currentPeriodStart && this.canStartFasting(timeMs, lastSignificantTreatment, config)) {
          currentPeriodStart = time.clone();
        }
      }
    }
    
    // Handle period that extends to end of day
    if (currentPeriodStart) {
      var period = this.createFastingPeriod(currentPeriodStart, dayEnd, dayData, config);
      if (period && this.validateFastingPeriod(period, config)) {
        fastingPeriods.push(period);
      }
    }
    
    // Score and rank periods
    fastingPeriods = this.scoreFastingPeriods(fastingPeriods, config);
    
    console.log('Fasting Detection Results:', {
      day: dayData.date,
      periodsFound: fastingPeriods.length,
      periods: fastingPeriods.map(function(p) {
        return {
          start: moment(p.startTime).format('HH:mm'),
          end: moment(p.endTime).format('HH:mm'),
          duration: p.duration.toFixed(1) + 'h',
          quality: p.quality
        };
      })
    });
    
    return fastingPeriods;
  },
  
  /**
   * Get treatments within a time window
   */
  getTreatmentsInWindow: function(treatments, centerTime, windowMs) {
    var startTime = centerTime - windowMs / 2;
    var endTime = centerTime + windowMs / 2;
    
    return treatments.filter(function(t) {
      return t.mills >= startTime && t.mills <= endTime;
    });
  },
  
  /**
   * Check if treatments break fasting state
   */
  checkIfBreaksFasting: function(treatments, config) {
    return treatments.some(function(t) {
      // Significant carbs
      if (t.carbs && t.carbs > config.carbThreshold) return true;
      
      // Any significant bolus (including corrections)
      if (t.insulin && t.insulin > config.bolusThreshold) return true;
      
      // Exercise (if configured to exclude)
      if (config.excludeExercise && t.eventType && 
          (t.eventType.toLowerCase().includes('exercise') || 
           t.eventType.toLowerCase().includes('activity'))) return true;
      
      return false;
    });
  },
  
  /**
   * Check if we can start a fasting period
   */
  canStartFasting: function(currentTime, lastTreatment, config) {
    if (!lastTreatment) return true;
    
    var timeSinceLastTreatment = (currentTime - lastTreatment.valueOf()) / (1000 * 60 * 60); // hours
    return timeSinceLastTreatment >= 2; // At least 2 hours since last significant treatment
  },
  
  /**
   * Create a fasting period object with analysis
   */
  createFastingPeriod: function(startTime, endTime, dayData, config) {
    var durationHours = endTime.diff(startTime, 'minutes') / 60;
    
    if (durationHours < config.minFastingDuration) {
      return null;
    }
    
    // Get CGM data for this period
    var cgmInPeriod = dayData.cgmData.filter(function(reading) {
      return reading.mills >= startTime.valueOf() && reading.mills <= endTime.valueOf();
    });
    
    if (cgmInPeriod.length < 3) {
      return null; // Not enough data
    }
    
    // Calculate glucose statistics
    var glucoseValues = cgmInPeriod.map(function(r) { return r.sgv; });
    var glucoseStats = this.calculateGlucoseStats(glucoseValues);
    
    // Determine period type
    var periodType = this.classifyPeriodType(startTime, endTime);
    
    // Transform CGM data into format expected by basal rate optimizer
    // Each reading needs: mills (timestamp) and sgv (glucose value)
    var glucoseReadings = cgmInPeriod.map(function(cgm) {
      return {
        mills: cgm.mills || cgm.date || cgm.timestamp,
        sgv: cgm.sgv || cgm.y || cgm.value
      };
    }).filter(function(reading) {
      // Filter out invalid readings
      return reading.mills && typeof reading.sgv === 'number' && reading.sgv > 0 && reading.sgv < 500;
    });
    
    return {
      startTime: startTime.toDate(),
      endTime: endTime.toDate(),
      duration: durationHours,
      periodType: periodType,
      glucoseStats: glucoseStats,
      cgmReadings: cgmInPeriod.length,
      quality: this.assessPeriodQuality(glucoseStats, durationHours, periodType, config),
      glucoseReadings: glucoseReadings  // Add glucose readings for basal rate optimizer
    };
  },
  
  /**
   * Calculate glucose statistics for a period
   */
  calculateGlucoseStats: function(glucoseValues) {
    if (glucoseValues.length === 0) return null;
    
    var sorted = glucoseValues.slice().sort(function(a, b) { return a - b; });
    var sum = glucoseValues.reduce(function(a, b) { return a + b; }, 0);
    
    return {
      mean: sum / glucoseValues.length,
      median: sorted[Math.floor(sorted.length / 2)],
      min: Math.min.apply(null, glucoseValues),
      max: Math.max.apply(null, glucoseValues),
      range: Math.max.apply(null, glucoseValues) - Math.min.apply(null, glucoseValues),
      stdDev: this.calculateStdDev(glucoseValues),
      trend: this.calculateTrend(glucoseValues),
      stability: this.calculateStability(glucoseValues)
    };
  },
  
  /**
   * Calculate standard deviation
   */
  calculateStdDev: function(values) {
    var mean = values.reduce(function(a, b) { return a + b; }, 0) / values.length;
    var squaredDiffs = values.map(function(v) { return Math.pow(v - mean, 2); });
    var avgSquaredDiff = squaredDiffs.reduce(function(a, b) { return a + b; }, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  },
  
  /**
   * Calculate glucose trend (slope)
   */
  calculateTrend: function(values) {
    if (values.length < 2) return 0;
    
    var n = values.length;
    var sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    
    for (var i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumXX += i * i;
    }
    
    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  },
  
  /**
   * Calculate glucose stability score (0-100, higher is more stable)
   */
  calculateStability: function(values) {
    if (values.length < 2) return 0;
    
    var range = Math.max.apply(null, values) - Math.min.apply(null, values);
    var stdDev = this.calculateStdDev(values);
    
    // Stability decreases with range and standard deviation
    var stabilityScore = Math.max(0, 100 - (range * 0.5 + stdDev * 2));
    return Math.round(stabilityScore);
  },
  
  /**
   * Classify the type of fasting period
   */
  classifyPeriodType: function(startTime, endTime) {
    var startHour = startTime.hour();
    var endHour = endTime.hour();
    
    // Overnight fasting (most valuable for basal testing)
    if (startHour >= 22 || startHour <= 6 || endHour <= 8) {
      return 'overnight';
    }
    
    // Morning fasting
    if (startHour >= 6 && endHour <= 12) {
      return 'morning';
    }
    
    // Afternoon fasting
    if (startHour >= 12 && endHour <= 18) {
      return 'afternoon';
    }
    
    // Evening fasting
    if (startHour >= 18 && endHour <= 22) {
      return 'evening';
    }
    
    return 'mixed';
  },
  
  /**
   * Validate if a fasting period meets quality criteria
   */
  validateFastingPeriod: function(period, config) {
    if (!period || !period.glucoseStats) return false;
    
    // Duration check
    if (period.duration < config.minFastingDuration || 
        period.duration > config.maxFastingDuration) {
      return false;
    }
    
    // Minimum data points - more lenient
    if (period.cgmReadings < 3) return false; // At least 3 readings (15 min of data)
    
    // Remove glucose stability check as it's too restrictive for real data
    // if (period.glucoseStats.range > config.glucoseStabilityThreshold * 2) return false;
    
    return true;
  },
  
  /**
   * Score fasting periods for quality and usefulness
   */
  scoreFastingPeriods: function(periods, config) {
    return periods.map(function(period) {
      var score = 0;
      
      // Duration score (longer is better, up to optimal range)
      var durationScore = Math.min(period.duration / 6, 1) * 30; // Max 30 points for 6+ hours
      score += durationScore;
      
      // Stability score
      score += period.glucoseStats.stability * 0.4; // Max 40 points
      
      // Period type bonus
      var typeBonus = {
        'overnight': 20,
        'morning': 15,
        'afternoon': 10,
        'evening': 10,
        'mixed': 5
      };
      score += typeBonus[period.periodType] || 0;
      
      // Data quality bonus
      var dataQualityBonus = Math.min(period.cgmReadings / 24, 1) * 10; // Max 10 points for 2+ hours of data
      score += dataQualityBonus;
      
      period.score = Math.round(score);
      period.quality = period.score >= 70 ? 'excellent' : 
                      period.score >= 50 ? 'good' : 
                      period.score >= 30 ? 'fair' : 'poor';
      
      return period;
    }).sort(function(a, b) {
      return b.score - a.score; // Sort by score descending
    });
  },
  
  /**
   * Assess overall period quality
   */
  assessPeriodQuality: function(glucoseStats, duration, periodType, config) {
    if (!glucoseStats) return 'poor';
    
    var qualityScore = 0;
    
    // Stability contributes most to quality
    qualityScore += glucoseStats.stability * 0.6;
    
    // Duration quality
    var optimalDuration = periodType === 'overnight' ? 8 : 4;
    var durationQuality = Math.min(duration / optimalDuration, 1) * 40;
    qualityScore += durationQuality;
    
    if (qualityScore >= 80) return 'excellent';
    if (qualityScore >= 60) return 'good';
    if (qualityScore >= 40) return 'fair';
    return 'poor';
  }
};

module.exports = fastingDetection;