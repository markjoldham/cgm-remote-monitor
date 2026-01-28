'use strict';

/**
 * Simplified Fasting Period Detection for Nightscout
 * Works with real-world data and browser environment
 */

var fastingDetection = {
  
  /**
   * Detect fasting periods - simplified approach for real Nightscout data
   */
  detectFastingPeriods: function(dayData, options) {
    options = options || {};
    
    // More lenient configuration for real-world data
    var config = {
      minFastingDuration: options.minFastingDuration || 2, // hours
      maxFastingDuration: options.maxFastingDuration || 16, // hours
      carbThreshold: options.carbThreshold || 1, // grams - very low threshold
      bolusThreshold: options.bolusThreshold || 0.1, // units - very low threshold
      minDataPoints: options.minDataPoints || 2 // minimum CGM readings
    };
    
    var treatments = dayData.treatments || [];
    var cgmData = dayData.cgmData || [];
    
    console.log('Fasting Detection Debug - Input Data:', {
      day: dayData.date,
      treatmentsCount: treatments.length,
      cgmDataCount: cgmData.length,
      sampleTreatment: treatments.length > 0 ? treatments[0] : 'none',
      sampleCGM: cgmData.length > 0 ? cgmData[0] : 'none'
    });
    
    if (!treatments.length && !cgmData.length) {
      console.log('No data available for fasting detection');
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
    
    // Find significant treatments - be very flexible with property names
    var significantTreatments = treatments.filter(function(t) {
      var hasCarbs = false;
      var hasInsulin = false;
      
      // Check for carbs - try multiple property names
      if (t.carbs && t.carbs > config.carbThreshold) hasCarbs = true;
      if (t.carbohydrate && t.carbohydrate > config.carbThreshold) hasCarbs = true;
      if (t.carb && t.carb > config.carbThreshold) hasCarbs = true;
      
      // Check for insulin - try multiple property names
      if (t.insulin && t.insulin > config.bolusThreshold) hasInsulin = true;
      if (t.bolus && t.bolus > config.bolusThreshold) hasInsulin = true;
      if (t.amount && t.amount > config.bolusThreshold) hasInsulin = true;
      
      // Also check event types that might indicate meals
      var isMealEvent = false;
      if (t.eventType) {
        var eventType = t.eventType.toLowerCase();
        isMealEvent = eventType.includes('meal') || 
                     eventType.includes('bolus') || 
                     eventType.includes('carb') ||
                     eventType.includes('correction');
      }
      
      return hasCarbs || hasInsulin || isMealEvent;
    }).sort(function(a, b) {
      // Sort by mills if available, otherwise by created_at or date
      var aTime = a.mills || new Date(a.created_at || a.date || a.timestamp).getTime();
      var bTime = b.mills || new Date(b.created_at || b.date || b.timestamp).getTime();
      return aTime - bTime;
    });
    
    console.log('Significant treatments found:', significantTreatments.length, significantTreatments);
    
    var fastingPeriods = [];
    
    // If no significant treatments, consider the whole day as potential fasting
    if (significantTreatments.length === 0) {
      console.log('No significant treatments found - checking whole day');
      if (cgmData.length >= config.minDataPoints) {
        var wholeDayPeriod = this.createSimplePeriod(dayStart, dayEnd, cgmData, dayData.date);
        if (wholeDayPeriod && wholeDayPeriod.duration >= config.minFastingDuration) {
          fastingPeriods.push(wholeDayPeriod);
        }
      }
    } else {
      // Look for gaps between significant treatments
      for (var i = 0; i <= significantTreatments.length; i++) {
        var periodStart, periodEnd;
        
        if (i === 0) {
          // Period from start of day to first treatment
          periodStart = dayStart;
          var firstTreatmentTime = significantTreatments[0].mills || 
                                  new Date(significantTreatments[0].created_at || 
                                          significantTreatments[0].date || 
                                          significantTreatments[0].timestamp).getTime();
          periodEnd = moment(firstTreatmentTime);
        } else if (i === significantTreatments.length) {
          // Period from last treatment to end of day
          var lastTreatmentTime = significantTreatments[i-1].mills || 
                                 new Date(significantTreatments[i-1].created_at || 
                                         significantTreatments[i-1].date || 
                                         significantTreatments[i-1].timestamp).getTime();
          periodStart = moment(lastTreatmentTime).add(1, 'hours'); // 1h after last treatment
          periodEnd = dayEnd;
        } else {
          // Period between treatments
          var prevTreatmentTime = significantTreatments[i-1].mills || 
                                 new Date(significantTreatments[i-1].created_at || 
                                         significantTreatments[i-1].date || 
                                         significantTreatments[i-1].timestamp).getTime();
          var nextTreatmentTime = significantTreatments[i].mills || 
                                 new Date(significantTreatments[i].created_at || 
                                         significantTreatments[i].date || 
                                         significantTreatments[i].timestamp).getTime();
          periodStart = moment(prevTreatmentTime).add(1, 'hours');
          periodEnd = moment(nextTreatmentTime);
        }
        
        var durationHours = periodEnd.diff(periodStart, 'minutes') / 60;
        
        console.log('Checking potential fasting period:', {
          start: periodStart.format('HH:mm'),
          end: periodEnd.format('HH:mm'),
          duration: durationHours.toFixed(1) + 'h'
        });
        
        if (durationHours >= config.minFastingDuration && durationHours <= config.maxFastingDuration) {
          // Get CGM data for this period - be flexible with property names
          var cgmInPeriod = cgmData.filter(function(reading) {
            var readingTime = reading.mills || reading.date || 
                             new Date(reading.dateString || reading.created_at).getTime();
            return readingTime >= periodStart.valueOf() && readingTime <= periodEnd.valueOf();
          });
          
          console.log('CGM data in period:', cgmInPeriod.length);
          
          if (cgmInPeriod.length >= config.minDataPoints) {
            var period = this.createSimplePeriod(periodStart, periodEnd, cgmInPeriod, dayData.date);
            if (period) {
              fastingPeriods.push(period);
              console.log('Added fasting period:', period);
            }
          }
        }
      }
    }
    
    console.log('Total fasting periods found:', fastingPeriods.length);
    
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
    
    if (cgmData.length === 0) {
      console.log('No CGM data for period');
      return null;
    }
    
    // Extract glucose values - be flexible with property names
    var glucoseValues = cgmData.map(function(r) { 
      return r.sgv || r.glucose || r.bg || r.value || 0;
    }).filter(function(v) { return v > 0; }); // Remove invalid readings
    
    if (glucoseValues.length === 0) {
      console.log('No valid glucose values found');
      return null;
    }
    
    console.log('Creating period with', glucoseValues.length, 'glucose values:', glucoseValues.slice(0, 5));
    
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
    var stability = Math.max(0, 100 - (range * 0.3 + stdDev * 1.5));
    
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
    
    // Simple quality assessment - more lenient
    var quality = 'poor';
    if (durationHours >= 4 && stability >= 60 && periodType === 'overnight') {
      quality = 'excellent';
    } else if (durationHours >= 3 && stability >= 50) {
      quality = 'good';
    } else if (durationHours >= 2 && stability >= 30) {
      quality = 'fair';
    }
    
    // Simple scoring
    var score = 0;
    score += Math.min(durationHours / 6, 1) * 40; // Duration score
    score += stability * 0.4; // Stability score
    score += (periodType === 'overnight' ? 20 : periodType === 'morning' ? 15 : 10); // Type bonus
    
    var period = {
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
    
    console.log('Created period:', {
      start: startTime.format('HH:mm'),
      end: endTime.format('HH:mm'),
      duration: durationHours.toFixed(1) + 'h',
      quality: quality,
      score: period.score,
      glucoseCount: glucoseValues.length
    });
    
    return period;
  }
};

// Export for both Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = fastingDetection;
} else if (typeof window !== 'undefined') {
  window.fastingDetection = fastingDetection;
}