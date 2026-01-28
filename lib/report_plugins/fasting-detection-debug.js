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
    console.log('🔢 FASTING MODULE BUILD: FASTING-DEBUG-v2.1 - 2026-01-28-08:30 EST');
    console.log('Full dayData object:', dayData);
    console.log('dayData keys:', Object.keys(dayData || {}));
    
    if (dayData.treatments) {
      console.log('Treatments array length:', dayData.treatments.length);
      if (dayData.treatments.length > 0) {
        console.log('First treatment object:', dayData.treatments[0]);
        console.log('First treatment keys:', Object.keys(dayData.treatments[0] || {}));
      }
    }
    
    if (dayData.cgmData) {
      console.log('CGM data array length:', dayData.cgmData.length);
      if (dayData.cgmData.length > 0) {
        console.log('First CGM object:', dayData.cgmData[0]);
        console.log('First CGM keys:', Object.keys(dayData.cgmData[0] || {}));
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
    
    // Create a simple test period to verify the display works
    var moment = window.moment || (typeof require !== 'undefined' ? require('moment') : null);
    if (!moment) {
      console.log('Moment.js not available');
      return [];
    }
    
    var dayStart = moment(dayData.date).startOf('day');
    
    // Create a fake fasting period for testing
    var testPeriod = {
      startTime: dayStart.clone().add(2, 'hours').toDate(), // 2 AM
      endTime: dayStart.clone().add(8, 'hours').toDate(),   // 8 AM
      duration: 6,
      periodType: 'overnight',
      quality: 'excellent',
      score: 85,
      cgmReadings: 72,
      glucoseStats: {
        mean: 120,
        min: 105,
        max: 135,
        range: 30,
        stdDev: 8.5,
        stability: 75
      }
    };
    
    console.log('Returning test fasting period:', testPeriod);
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