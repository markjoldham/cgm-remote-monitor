'use strict';

/**
 * Debug version of Fasting Period Detection
 * Logs everything to help understand the real data structure
 */

var fastingDetectionDebug = {
  
  /**
   * Debug version that logs all data structures
   * @param {Object} dayData - Current day's data (treatments, cgmData, date)
   * @param {Object} nextDayData - Next day's data for rolling fasting periods (optional)
   * @param {Object} options - Report options including targetLow and targetHigh
   */
  detectFastingPeriods: function(dayData, nextDayData, options) {
    console.log('=== FASTING DETECTION DEBUG ===');
    console.log('🔢 FASTING MODULE BUILD: FASTING-DEBUG-v3.6-USE-USER-TARGETS - 2026-01-28-12:15 EST');
    console.log('Full dayData object:', dayData);
    console.log('dayData keys:', Object.keys(dayData || {}));
    console.log('Has next day data:', !!nextDayData);
    console.log('Target range:', options && options.targetLow, '-', options && options.targetHigh, 'mg/dL');
    
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
        
        // Find gap between last meal and next meal (or end of available data)
        var lastMeal = mealTreatments[mealTreatments.length - 1];
        var lastMealTime = moment(lastMeal.created_at || lastMeal.date || lastMeal.timestamp || lastMeal.mills);
        
        // Look for next meal - could be later today or tomorrow
        var nextMealTime = null;
        var endOfDay = dayStart.clone().endOf('day');
        
        // Check if there's a next day with data
        if (nextDayData && nextDayData.treatments && nextDayData.treatments.length > 0) {
          console.log('🔍 Checking next day for meals...');
          
          // Find meal treatments in next day
          var nextDayMeals = nextDayData.treatments.filter(function(t) {
            var hasCarbs = (t.carbs && t.carbs > 5) || (t.carbohydrate && t.carbohydrate > 5);
            var hasInsulinWithCarbs = ((t.insulin && t.insulin > 1) || (t.bolus && t.bolus > 1)) && 
                                      ((t.carbs && t.carbs > 0) || (t.carbohydrate && t.carbohydrate > 0));
            var isMealEvent = t.eventType && (
              t.eventType.toLowerCase().includes('meal') ||
              t.eventType === 'Meal Bolus' ||
              t.eventType === 'Snack Bolus' ||
              (t.eventType === 'Correction Bolus' && hasCarbs)
            );
            return hasCarbs || hasInsulinWithCarbs || isMealEvent;
          });
          
          if (nextDayMeals.length > 0) {
            // Sort and get first meal of next day
            nextDayMeals.sort(function(a, b) {
              var aTime = new Date(a.created_at || a.date || a.timestamp || a.mills).getTime();
              var bTime = new Date(b.created_at || b.date || b.timestamp || b.mills).getTime();
              return aTime - bTime;
            });
            
            var firstNextDayMeal = nextDayMeals[0];
            nextMealTime = moment(firstNextDayMeal.created_at || firstNextDayMeal.date || firstNextDayMeal.timestamp || firstNextDayMeal.mills);
            console.log('🍽️ Found next meal in next day:', nextMealTime.format('YYYY-MM-DD HH:mm'));
          }
        }
        
        // If no next meal found, determine appropriate end time
        var fastingEndTime;
        var isCurrentDay = dayStart.isSame(moment(), 'day');
        var isNextDayInFuture = nextDayData && moment(nextDayData.date).isAfter(moment(), 'day');
        
        if (nextMealTime) {
          // We found a next meal - use that
          fastingEndTime = nextMealTime;
        } else if (isCurrentDay || isNextDayInFuture) {
          // Current day or next day is in the future - don't extend beyond now
          // We'll limit to last CGM reading below
          fastingEndTime = moment(); // Use current time as placeholder
        } else if (nextDayData) {
          // Next day exists and is in the past - use end of next day
          fastingEndTime = moment(nextDayData.date).endOf('day');
        } else {
          // No next day data - use end of current day
          fastingEndTime = endOfDay;
        }
        
        var fastingStart = lastMealTime.clone().add(2, 'hours');
        var fastingDuration = fastingEndTime.diff(fastingStart, 'hours', true);
        
        console.log('🕐 Last meal time:', lastMealTime.format('YYYY-MM-DD HH:mm'));
        console.log('🕐 Potential fasting start:', fastingStart.format('YYYY-MM-DD HH:mm'));
        console.log('🕐 Initial fasting end time:', fastingEndTime.format('YYYY-MM-DD HH:mm'), nextMealTime ? '(next meal)' : '(end of data)');
        console.log('🕐 Is current day:', isCurrentDay, 'Is next day in future:', isNextDayInFuture);
        console.log('⏱️ Initial fasting duration:', fastingDuration.toFixed(1), 'hours');
        
        if (fastingDuration >= 2) {
          // Determine actual end time based on available data
          var actualEndTime = fastingEndTime.toDate();
          
          // For current day or if next day is in future, limit to last available CGM reading
          if (isCurrentDay || isNextDayInFuture || !nextMealTime) {
            // Collect CGM data from current day and next day (if available)
            var allCGMData = (dayData.cgmData || []).slice();
            if (nextDayData && nextDayData.cgmData) {
              allCGMData = allCGMData.concat(nextDayData.cgmData);
            }
            
            if (allCGMData.length > 0) {
              // Find the last CGM reading time
              var lastCGMTime = null;
              var now = moment();
              
              allCGMData.forEach(function(cgm) {
                var cgmTime = moment(cgm.date || cgm.mills || cgm.timestamp);
                // Only consider CGM readings after fasting start and not in the future
                if (cgmTime.isAfter(fastingStart) && cgmTime.isSameOrBefore(now)) {
                  if (!lastCGMTime || cgmTime.isAfter(lastCGMTime)) {
                    lastCGMTime = cgmTime;
                  }
                }
              });
              
              if (lastCGMTime && lastCGMTime.isAfter(fastingStart)) {
                actualEndTime = lastCGMTime.toDate();
                fastingDuration = lastCGMTime.diff(fastingStart, 'hours', true);
                console.log('📅 Limiting fasting period to last CGM reading:', lastCGMTime.format('YYYY-MM-DD HH:mm'));
                console.log('⏱️ Adjusted fasting duration:', fastingDuration.toFixed(1), 'hours');
              } else {
                console.log('⚠️ Last CGM reading is before fasting start or not found');
              }
            }
          }
          
          // Calculate comprehensive glucose stability analysis from CGM data during fasting period
          // Include CGM data from both current and next day if fasting period spans midnight
          var fastingCGMData = [];
          var allCGMData = (dayData.cgmData || []).slice();
          if (nextDayData && nextDayData.cgmData) {
            allCGMData = allCGMData.concat(nextDayData.cgmData);
          }
          
          if (allCGMData.length > 0) {
            fastingCGMData = allCGMData.filter(function(cgm) {
              var cgmTime = new Date(cgm.date || cgm.mills || cgm.timestamp);
              return cgmTime >= fastingStart.toDate() && cgmTime <= actualEndTime;
            });
          }
          
          console.log('📊 CGM data for fasting period:', fastingCGMData.length, 'readings from', allCGMData.length, 'total readings');
          
          var glucoseStats = {
            mean: 120,
            min: 100,
            max: 140,
            range: 40,
            stdDev: 15,
            cv: 12.5,
            stability: 70,
            timeInRange: 0,
            timeAboveRange: 0,
            timeBelowRange: 0,
            trend: 'stable',
            rateOfChange: 0,
            qualityScore: 50
          };
          
          if (fastingCGMData.length > 0) {
            var glucoseValues = fastingCGMData.map(function(cgm) {
              return cgm.sgv || cgm.y || cgm.value || 120;
            }).filter(function(val) {
              return val > 0 && val < 500; // Filter out invalid readings
            });
            
            if (glucoseValues.length > 0) {
              // Basic statistics
              var sum = glucoseValues.reduce(function(a, b) { return a + b; }, 0);
              var mean = sum / glucoseValues.length;
              var min = Math.min.apply(Math, glucoseValues);
              var max = Math.max.apply(Math, glucoseValues);
              var range = max - min;
              
              // Standard deviation
              var variance = glucoseValues.reduce(function(acc, val) {
                return acc + Math.pow(val - mean, 2);
              }, 0) / glucoseValues.length;
              var stdDev = Math.sqrt(variance);
              
              // Coefficient of variation (CV%) - industry standard for glucose variability
              var cv = (stdDev / mean) * 100;
              
              // Stability score (inverse of CV, normalized to 0-100)
              // CV < 20% is excellent, 20-30% is good, 30-40% is fair, >40% is poor
              var stability = Math.max(0, Math.min(100, 100 - (cv * 2.5)));
              
              // Time in range analysis using user's configured target range
              // Default to 70-180 mg/dL if not configured
              var targetLow = (options && options.targetLow) || 70;
              var targetHigh = (options && options.targetHigh) || 180;
              
              console.log('📊 Using target range:', targetLow, '-', targetHigh, 'mg/dL for time in range calculation');
              
              var inRange = 0;
              var aboveRange = 0;
              var belowRange = 0;
              
              glucoseValues.forEach(function(val) {
                if (val >= targetLow && val <= targetHigh) {
                  inRange++;
                } else if (val > targetHigh) {
                  aboveRange++;
                } else {
                  belowRange++;
                }
              });
              
              var timeInRange = Math.round((inRange / glucoseValues.length) * 100);
              var timeAboveRange = Math.round((aboveRange / glucoseValues.length) * 100);
              var timeBelowRange = Math.round((belowRange / glucoseValues.length) * 100);
              
              // Trend analysis - compare first third vs last third of period
              var thirdSize = Math.floor(glucoseValues.length / 3);
              var firstThird = glucoseValues.slice(0, thirdSize);
              var lastThird = glucoseValues.slice(-thirdSize);
              
              var firstAvg = firstThird.reduce(function(a, b) { return a + b; }, 0) / firstThird.length;
              var lastAvg = lastThird.reduce(function(a, b) { return a + b; }, 0) / lastThird.length;
              var avgChange = lastAvg - firstAvg;
              
              var trend = 'stable';
              if (avgChange > 15) {
                trend = 'rising';
              } else if (avgChange < -15) {
                trend = 'falling';
              }
              
              // Rate of change (mg/dL per hour)
              var rateOfChange = (avgChange / fastingDuration) || 0;
              
              // Quality score for basal testing (0-100)
              // Factors: low CV, high time in range, stable trend, adequate duration
              var cvScore = Math.max(0, 100 - (cv * 3)); // CV < 20% = excellent
              var tirScore = timeInRange; // Direct percentage
              var trendScore = trend === 'stable' ? 100 : (trend === 'rising' || trend === 'falling' ? 70 : 50);
              var durationScore = Math.min(100, (fastingDuration / 6) * 100); // 6+ hours = 100
              
              var qualityScore = Math.round((cvScore * 0.4) + (tirScore * 0.3) + (trendScore * 0.2) + (durationScore * 0.1));
              
              glucoseStats = {
                mean: Math.round(mean),
                min: Math.round(min),
                max: Math.round(max),
                range: Math.round(range),
                stdDev: Math.round(stdDev * 10) / 10,
                cv: Math.round(cv * 10) / 10,
                stability: Math.round(stability),
                timeInRange: timeInRange,
                timeAboveRange: timeAboveRange,
                timeBelowRange: timeBelowRange,
                targetRange: targetLow + '-' + targetHigh + ' mg/dL',
                trend: trend,
                rateOfChange: Math.round(rateOfChange * 10) / 10,
                qualityScore: qualityScore
              };
              
              console.log('📊 Comprehensive glucose stability analysis from', glucoseValues.length, 'CGM readings:');
              console.log('   Mean:', glucoseStats.mean, 'mg/dL, Range:', glucoseStats.range, 'mg/dL');
              console.log('   CV:', glucoseStats.cv + '%', '(Excellent: <20%, Good: 20-30%, Fair: 30-40%)');
              console.log('   Time in Range:', glucoseStats.timeInRange + '%', '(70-180 mg/dL)');
              console.log('   Trend:', glucoseStats.trend, '(' + glucoseStats.rateOfChange, 'mg/dL/hr)');
              console.log('   Quality Score:', glucoseStats.qualityScore + '/100', '(for basal testing)');
            }
          }
          
          var realPeriod = {
            startTime: fastingStart.toDate(),
            endTime: actualEndTime,
            duration: fastingDuration,
            periodType: classifyPeriodType(fastingStart),
            quality: fastingDuration >= 6 ? 'excellent' : fastingDuration >= 4 ? 'good' : 'fair',
            score: Math.round(fastingDuration * 10 + (fastingStart.hour() >= 18 ? 20 : 0)),
            cgmReadings: fastingCGMData.length,
            glucoseStats: glucoseStats
          };
          
          console.log('🎯 REAL fasting period created:', realPeriod);
          console.log('=== END FASTING DETECTION DEBUG ===');
          return [realPeriod];
        } else {
          console.log('⚠️ Fasting duration too short:', fastingDuration.toFixed(1), 'hours - not creating fasting period');
        }
      } else {
        console.log('❌ No meal treatments found with current criteria');
      }
    }
    
    // No real fasting periods found - return empty array instead of test period
    console.log('📝 No valid fasting periods found for this day');
    console.log('=== END FASTING DETECTION DEBUG ===');
    
    return [];
  }
};

// Helper function to classify period type based on start time
function classifyPeriodType(startTime) {
  var hour = startTime.hour();
  
  // Overnight: 10 PM - 6 AM (22:00 - 06:00)
  if (hour >= 22 || hour < 6) {
    return 'overnight';
  }
  // Morning: 6 AM - 12 PM (06:00 - 12:00)
  else if (hour >= 6 && hour < 12) {
    return 'morning';
  }
  // Afternoon: 12 PM - 6 PM (12:00 - 18:00)
  else if (hour >= 12 && hour < 18) {
    return 'afternoon';
  }
  // Evening: 6 PM - 10 PM (18:00 - 22:00)
  else {
    return 'evening';
  }
}

// Export for both Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = fastingDetectionDebug;
} else if (typeof window !== 'undefined') {
  window.fastingDetectionDebug = fastingDetectionDebug;
}