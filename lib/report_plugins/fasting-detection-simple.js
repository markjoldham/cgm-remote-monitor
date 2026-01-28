'use strict';

/**
 * Simplified Fasting Period Detection for Nightscout
 * Works with real-world data and browser environment
 */

var fastingDetection = {
  
  /**
   * Detect fasting periods - simplified approach
   */
  detectFastingPeriods: function(dayData, options) {
    options = options || {};
    
    // More lenient configuration for real-world data
    var config = {
      minFastingDuration: options.minFastingDuration || 2, // hours
      maxFastingDuration: options.maxFastingDuration || 16, // hours
      carbThreshold: options.carbThreshold || 2, // grams
      bolusThreshold: options.bolusThreshold || 0.2, // units
      minDataPoints: options.minDataPoints || 3
    };
    
    var treatments = dayData.treatments || [];
    var cgmData = dayData.cgmData || [];
    
    if (!treatments.length || !cgmData.length) {
      return [];
    }
    
    // Use window.moment if available, otherwise try moment
    var moment = window.moment || (typeof require !== 'undefined' ? require('moment') : null);
    if (!moment) {
      console.warn('Moment.js not available for fasting detection');
      return [];
    }
    
    var dayStart = moment(dayData.date).startOf('day');
    var dayEnd = moment(dayData.date).endOf('day');
    
    console.log('Fasting Detection - Simple Version:', {
      day: dayData.date,
      treatments: treatments.length,
      cgmData: cgmData.length,
      config: config
    });
    
    // Find significant treatments (meals)
    var significantTreatments = treatments.filter(function(t) {
      return (t.carbs && t.carbs > config.carbThreshold) || 
             (t.insulin && t.insulin > config.bolusThreshold);
    }).sort(function(a, b) {
      return a.mills - b.mills;
    });
    
    console.log('Significant treatments found:', significantTreatments.length);
    
    var fastingPeriods = [];
    
    // Simple approach: look for gaps between significant treatments
    for (var i = 0; i <= significantTreatments.length; i++) {
      var periodStart, periodEnd;
      
      if (i === 0) {
        // Period from start of day to first treatment
        periodStart = dayStart;
        periodEnd = significantTreatments.length > 0 ? 
                   moment(significantTreatments[0].mills) : dayEnd;
      } else if (i === significantTreatments.length) {
        // Period from last treatment to end of day
        periodStart = moment(significantTreatments[i-1].mills).add(2, 'hours'); // 2h after last treatment
        periodEnd = dayEnd;
      } else {
        // Period between treatments
        periodStart = moment(significantTreatments[i-1].mills).add(2, 'hours');
        periodEnd = moment(significantTreatments[i].mills);
      }
      
      var durationHours = periodEnd.diff(periodStart, 'minutes') / 60;
      
      if (durationHours >= config.minFastingDuration && durationHours <= config.maxFastingDuration) {
        // Get CGM data for this period
        var cgmInPeriod = cgmData.filter(function(reading) {
          return reading.mills >= periodStart.valueOf() && reading.mills <= periodEnd.valueOf();
        });
        
        if (cgmInPeriod.length >= config.minDataPoints) {
          var period = this.createSimplePeriod(periodStart, periodEnd, cgmInPeriod, dayData.date);
          if (period) {
            fastingPeriods.push(period);
          }
        }
      }
    }
    
    console.log('Fasting periods found:', fastingPeriods.length);
    
    return fastingPeriods.sort(function(a, b) {
      return b.score - a.score;
    });
  },
  
  /**
   * Create a simple fasting period object
   */
  createSimplePeriod: function(startTime, endTime, cgmData, date) {
    var moment = window.moment || require('moment');
    var durationHours = endTime.diff(startTime, 'minutes') / 60;
    
    if (cgmData.length === 0) return null;
    
    // Calculate basic glucose stats
    var glucoseValues = cgmData.map(function(r) { return r.sgv; });
    var sum = glucoseValues.reduce(function(a, b) { return a + b; }, 0);
    var mean = sum / glucoseValues.length;
    var min = Math.min.apply(null, glucoseValues);
    var max = Math.max.apply(null, glucoseValues);
    var range = max - min;
    
    // Calculate standard deviation
    var squaredDiffs = glucoseValues.map(function(v) { return Math.pow(v - mean, 2); });
    var avgSquaredDiff = squaredDiffs.reduce(function(a, b) { return a + b; }, 0) / glucoseValues.length;
    var stdDev = Math.sqrt(avgSquaredDiff);
    
    // Simple stability score (0-100, higher is better)
    var stability = Math.max(0, 100 - (range * 0.5 + stdDev * 2));
    
    // Determine period type
    var startHour = startTime.hour();
    var periodType = 'mixed';
    if (startHour >= 22 || startHour <= 6) {
      periodType = 'overnight';
    } else if (startHour >= 6 && startHour <= 12) {
      periodType = 'morning';
    } else if (startHour >= 12 && startHour <= 18) {
      periodType = 'afternoon';
    } else {
      periodType = 'evening';
    }
    
    // Simple quality assessment
    var quality = 'poor';
    if (durationHours >= 6 && stability >= 70 && periodType === 'overnight') {
      quality = 'excellent';
    } else if (durationHours >= 4 && stability >= 60) {
      quality = 'good';
    } else if (durationHours >= 3 && stability >= 40) {
      quality = 'fair';
    }
    
    // Simple scoring
    var score = 0;
    score += Math.min(durationHours / 6, 1) * 40; // Duration score
    score += stability * 0.4; // Stability score
    score += (periodType === 'overnight' ? 20 : periodType === 'morning' ? 15 : 10); // Type bonus
    
    return {
      startTime: startTime.toDate(),
      endTime: endTime.toDate(),
      duration: durationHours,
      periodType: periodType,
      quality: quality,
      score: Math.round(score),
      cgmReadings: cgmData.length,
      glucoseStats: {
        mean: Math.round(mean),
        min: min,
        max: max,
        range: Math.round(range),
        stdDev: Math.round(stdDev * 10) / 10,
        stability: Math.round(stability)
      }
    };
  }
};

// Export for both Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = fastingDetection;
} else if (typeof window !== 'undefined') {
  window.fastingDetection = fastingDetection;
}