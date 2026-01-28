'use strict';

/**
 * Debug version of Fasting Period Detection
 * Logs everything to help understand the real data structure
 */

var fastingDetectionDebug = {
  
  /**
   * Debug version that logs all data structures
   */
  detectFastingPeriods: function(dayData, options) {
    console.log('=== FASTING DETECTION DEBUG ===');
    console.log('🔢 FASTING MODULE BUILD: FASTING-DEBUG-v2.6-CURRENT-DAY-FIX - 2026-01-28-09:20 EST');
    console.log('Full dayData object:', dayData);
    console.log('dayData keys:', Object.keys(dayData || {}));
    
    if (dayData.treatments) {
      console.log('Treatments array length:', dayData.treatments.length);
      if (dayData.treatments.length > 0) {
        console.log('First treatment object:', dayData.treatments[0]);
        console.log('First treatment keys:', Object.keys(dayData.treatments[0] || {}));
        
        // Show first 5 treatments to understand the data
        console.log('First 5 treatments:', dayData.treatments.slice(0, 5));
        
        // Look for treatments with carbs or insulin - try multiple property names
        var treatmentsWithCarbs = dayData.treatments.filter(function(t) {
          return (t.carbs && t.carbs > 0) || (t.carbohydrate && t.carbohydrate > 0);
        });
        var treatmentsWithInsulin = dayData.treatments.filter(function(t) {
          return (t.insulin && t.insulin > 0) || (t.bolus && t.bolus > 0);
        });
        
        console.log('Treatments with carbs:', treatmentsWithCarbs.length, treatmentsWithCarbs.slice(0, 3));
        console.log('Treatments with insulin:', treatmentsWithInsulin.length, treatmentsWithInsulin.slice(0, 3));
        
        // Look for different event types
        var eventTypes = {};
        dayData.treatments.forEach(function(t) {
          if (t.eventType) {
            eventTypes[t.eventType] = (eventTypes[t.eventType] || 0) + 1;
          }
        });
        console.log('Event types found:', eventTypes);
        
        // Look for meal-related treatments by event type
        var mealEventTypes = dayData.treatments.filter(function(t) {
          return t.eventType && (
            t.eventType.toLowerCase().includes('meal') ||
            t.eventType.toLowerCase().includes('bolus') ||
            t.eventType.toLowerCase().includes('carb') ||
            t.eventType === 'Meal Bolus' ||
            t.eventType === 'Correction Bolus' ||
            t.eventType === 'Snack Bolus'
          );
        });
        console.log('Meal-related event types:', mealEventTypes.length, mealEventTypes.slice(0, 3));
        
        // Show all unique property names across all treatments
        var allProps = new Set();
        dayData.treatments.forEach(function(t) {
          Object.keys(t).forEach(function(key) {
            allProps.add(key);
          });
        });
        console.log('All treatment properties found:', Array.from(allProps).sort());
      }
    }
    
    if (dayData.cgmData) {
      console.log('CGM data array length:', dayData.cgmData.length);
      if (dayData.cgmData.length > 0) {
        console.log('First CGM object:', dayData.cgmData[0]);
        console.log('First CGM keys:', Object.keys(dayData.cgmData[0] || {}));
        
        // Show first 5 CGM readings
        console.log('First 5 CGM readings:', dayData.cgmData.slice(0, 5));
      }
    }
    
    // Try to find any array properties that might contain the data
    for (var key in dayData) {
      if (Array.isArray(dayData[key]) && dayData[key].length > 0) {
        console.log('Found array property "' + key + '" with', dayData[key].length, 'items');
        console.log('First item in ' + key + ':', dayData[key][0]);
        console.log('Keys in first ' + key + ' item:', Object.keys(dayData[key][0] || {}));
      }
    }
    
    // Use window.moment if available, otherwise try moment
    var moment = window.moment || (typeof require !== 'undefined' ? require('moment') : null);
    if (!moment) {
      console.log('Moment.js not available');
      return [];
    }
    
    var dayStart = moment(dayData.date).startOf('day');
    
    // NOW CREATE A REAL FASTING PERIOD BASED ON ACTUAL DATA
    console.log('🔍 ANALYZING REAL DATA FOR FASTING PERIODS...');
    
    if (dayData.treatments && dayData.treatments.length > 0) {
      // Find actual meal treatments using multiple criteria
      var mealTreatments = dayData.treatments.filter(function(t) {
        // Check for carbs (multiple property names)
        var hasCarbs = (t.carbs && t.carbs > 5) || (t.carbohydrate && t.carbohydrate > 5);
        
        // Check for insulin with carbs (multiple property names)
        var hasInsulinWithCarbs = ((t.insulin && t.insulin > 1) || (t.bolus && t.bolus > 1)) && 
                                  ((t.carbs && t.carbs > 0) || (t.carbohydrate && t.carbohydrate > 0));
        
        // Check for meal-related event types
        var isMealEvent = t.eventType && (
          t.eventType.toLowerCase().includes('meal') ||
          t.eventType === 'Meal Bolus' ||
          t.eventType === 'Snack Bolus' ||
          (t.eventType === 'Correction Bolus' && hasCarbs)
        );
        
        return hasCarbs || hasInsulinWithCarbs || isMealEvent;
      });
      
      console.log('🍽️ Found meal treatments:', mealTreatments.length, mealTreatments);
      
      if (mealTreatments.length > 0) {
        // Sort by time - try multiple timestamp properties
        mealTreatments.sort(function(a, b) {
          var aTime = new Date(a.created_at || a.date || a.timestamp || a.mills).getTime();
          var bTime = new Date(b.created_at || b.date || b.timestamp || b.mills).getTime();
          return aTime - bTime;
        });
        
        console.log('📅 Sorted meal treatments:', mealTreatments);
        
        // Find gap between last meal and end of day
        var lastMeal = mealTreatments[mealTreatments.length - 1];
        var lastMealTime = moment(lastMeal.created_at || lastMeal.date || lastMeal.timestamp || lastMeal.mills);
        var endOfDay = dayStart.clone().endOf('day');
        
        var fastingStart = lastMealTime.clone().add(2, 'hours');
        var fastingDuration = endOfDay.diff(fastingStart, 'hours', true);
        
        console.log('🕐 Last meal time:', lastMealTime.format('HH:mm'));
        console.log('🕐 Potential fasting start:', fastingStart.format('HH:mm'));
        console.log('⏱️ Fasting duration:', fastingDuration.toFixed(1), 'hours');
        
        if (fastingDuration >= 2) {
          // For current day, limit fasting period to last available CGM reading
          var actualEndTime = endOfDay.toDate();
          var isCurrentDay = dayStart.isSame(moment(), 'day');
          
          if (isCurrentDay && dayData.cgmData && dayData.cgmData.length > 0) {
            // Find the last CGM reading time
            var lastCGMTime = null;
            dayData.cgmData.forEach(function(cgm) {
              var cgmTime = moment(cgm.date || cgm.mills || cgm.timestamp);
              if (!lastCGMTime || cgmTime.isAfter(lastCGMTime)) {
                lastCGMTime = cgmTime;
              }
            });
            
            if (lastCGMTime && lastCGMTime.isAfter(fastingStart)) {
              actualEndTime = lastCGMTime.toDate();
              fastingDuration = lastCGMTime.diff(fastingStart, 'hours', true);
              console.log('📅 Current day detected - limiting fasting period to last CGM reading:', lastCGMTime.format('HH:mm'));
              console.log('⏱️ Adjusted fasting duration:', fastingDuration.toFixed(1), 'hours');
            }
          }
          
          // Calculate real glucose stats from CGM data during fasting period
          var fastingCGMData = [];
          if (dayData.cgmData && dayData.cgmData.length > 0) {
            fastingCGMData = dayData.cgmData.filter(function(cgm) {
              var cgmTime = new Date(cgm.date || cgm.mills || cgm.timestamp);
              return cgmTime >= fastingStart.toDate() && cgmTime <= actualEndTime;
            });
          }
          
          var glucoseStats = {
            mean: 120,
            min: 100,
            max: 140,
            range: 40,
            stdDev: 15,
            stability: 70
          };
          
          if (fastingCGMData.length > 0) {
            var glucoseValues = fastingCGMData.map(function(cgm) {
              return cgm.sgv || cgm.y || cgm.value || 120;
            }).filter(function(val) {
              return val > 0 && val < 500; // Filter out invalid readings
            });
            
            if (glucoseValues.length > 0) {
              var sum = glucoseValues.reduce(function(a, b) { return a + b; }, 0);
              var mean = sum / glucoseValues.length;
              var min = Math.min.apply(Math, glucoseValues);
              var max = Math.max.apply(Math, glucoseValues);
              var range = max - min;
              
              // Calculate standard deviation
              var variance = glucoseValues.reduce(function(acc, val) {
                return acc + Math.pow(val - mean, 2);
              }, 0) / glucoseValues.length;
              var stdDev = Math.sqrt(variance);
              
              // Calculate stability (inverse of coefficient of variation)
              var stability = Math.max(0, Math.min(100, 100 - (stdDev / mean * 100)));
              
              glucoseStats = {
                mean: Math.round(mean),
                min: Math.round(min),
                max: Math.round(max),
                range: Math.round(range),
                stdDev: Math.round(stdDev * 10) / 10,
                stability: Math.round(stability)
              };
              
              console.log('📊 Calculated real glucose stats from', glucoseValues.length, 'CGM readings:', glucoseStats);
            }
          }
          
          var realPeriod = {
            startTime: fastingStart.toDate(),
            endTime: actualEndTime,
            duration: fastingDuration,
            periodType: fastingStart.hour() >= 18 ? 'overnight' : 'evening',
            quality: fastingDuration >= 6 ? 'excellent' : fastingDuration >= 4 ? 'good' : 'fair',
            score: Math.round(fastingDuration * 10 + (fastingStart.hour() >= 18 ? 20 : 0)),
            cgmReadings: fastingCGMData.length,
            glucoseStats: glucoseStats
          };
          
          console.log('🎯 REAL fasting period created:', realPeriod);
          console.log('=== END FASTING DETECTION DEBUG ===');
          return [realPeriod];
        } else {
          console.log('⚠️ Fasting duration too short:', fastingDuration.toFixed(1), 'hours');
        }
      } else {
        console.log('❌ No meal treatments found with current criteria');
      }
    }
    
    // Fallback to test period if no real data found
    var testStartTime = dayStart.clone().add(2, 'hours').toDate();
    var testEndTime = dayStart.clone().add(8, 'hours').toDate();
    
    // Try to calculate real glucose stats even for test period
    var testGlucoseStats = {
      mean: 120,
      min: 105,
      max: 135,
      range: 30,
      stdDev: 8.5,
      stability: 75
    };
    
    var testCGMReadings = 72;
    if (dayData.cgmData && dayData.cgmData.length > 0) {
      testCGMReadings = dayData.cgmData.length;
      
      // Use all available CGM data for the day if no specific fasting period
      var allGlucoseValues = dayData.cgmData.map(function(cgm) {
        return cgm.sgv || cgm.y || cgm.value || 120;
      }).filter(function(val) {
        return val > 0 && val < 500;
      });
      
      if (allGlucoseValues.length > 0) {
        var sum = allGlucoseValues.reduce(function(a, b) { return a + b; }, 0);
        var mean = sum / allGlucoseValues.length;
        var min = Math.min.apply(Math, allGlucoseValues);
        var max = Math.max.apply(Math, allGlucoseValues);
        var range = max - min;
        
        var variance = allGlucoseValues.reduce(function(acc, val) {
          return acc + Math.pow(val - mean, 2);
        }, 0) / allGlucoseValues.length;
        var stdDev = Math.sqrt(variance);
        var stability = Math.max(0, Math.min(100, 100 - (stdDev / mean * 100)));
        
        testGlucoseStats = {
          mean: Math.round(mean),
          min: Math.round(min),
          max: Math.round(max),
          range: Math.round(range),
          stdDev: Math.round(stdDev * 10) / 10,
          stability: Math.round(stability)
        };
        
        console.log('📊 Using real daily glucose stats for test period:', testGlucoseStats);
      }
    }
    
    var testPeriod = {
      startTime: testStartTime,
      endTime: testEndTime,
      duration: 6,
      periodType: 'overnight',
      quality: 'excellent',
      score: 85,
      cgmReadings: testCGMReadings,
      glucoseStats: testGlucoseStats
    };
    
    console.log('📝 No real fasting periods found, returning test period:', testPeriod);
    console.log('=== END FASTING DETECTION DEBUG ===');
    
    return [testPeriod];
  }
};

// Export for both Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = fastingDetectionDebug;
} else if (typeof window !== 'undefined') {
  window.fastingDetectionDebug = fastingDetectionDebug;
}