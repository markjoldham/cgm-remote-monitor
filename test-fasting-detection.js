// Simple test for fasting detection algorithm
var fastingDetection = require('./lib/report_plugins/fasting-detection');
var moment = require('moment');

// Mock data for testing
var testDay = {
  date: '2024-01-15',
  treatments: [
    // Breakfast at 7:00 AM
    { mills: moment('2024-01-15 07:00').valueOf(), carbs: 45, insulin: 6 },
    // Small correction at 9:00 AM
    { mills: moment('2024-01-15 09:00').valueOf(), insulin: 1 },
    // Lunch at 12:30 PM
    { mills: moment('2024-01-15 12:30').valueOf(), carbs: 60, insulin: 8 },
    // Dinner at 6:00 PM
    { mills: moment('2024-01-15 18:00').valueOf(), carbs: 50, insulin: 7 }
  ],
  cgmData: []
};

// Generate mock CGM data (every 5 minutes)
var startTime = moment('2024-01-15 00:00');
var endTime = moment('2024-01-15 23:59');
var currentTime = startTime.clone();

while (currentTime.isBefore(endTime)) {
  // Simulate glucose values with some variation
  var baseGlucose = 120;
  var variation = Math.random() * 40 - 20; // ±20 mg/dL variation
  var glucose = Math.max(70, Math.min(200, baseGlucose + variation));
  
  testDay.cgmData.push({
    mills: currentTime.valueOf(),
    sgv: Math.round(glucose)
  });
  
  currentTime.add(5, 'minutes');
}

console.log('Testing Fasting Detection Algorithm');
console.log('===================================');

var fastingPeriods = fastingDetection.detectFastingPeriods(testDay);

console.log('Found', fastingPeriods.length, 'fasting periods:');
console.log('');

fastingPeriods.forEach(function(period, index) {
  console.log('Period', index + 1 + ':');
  console.log('  Start:', moment(period.startTime).format('MMM DD HH:mm'));
  console.log('  End:', moment(period.endTime).format('MMM DD HH:mm'));
  console.log('  Duration:', period.duration.toFixed(1), 'hours');
  console.log('  Type:', period.periodType);
  console.log('  Quality:', period.quality);
  console.log('  Score:', period.score);
  
  if (period.glucoseStats) {
    console.log('  Glucose Stats:');
    console.log('    Mean:', period.glucoseStats.mean.toFixed(1), 'mg/dL');
    console.log('    Range:', period.glucoseStats.range.toFixed(1), 'mg/dL');
    console.log('    Stability:', period.glucoseStats.stability + '%');
  }
  console.log('');
});

console.log('Test completed successfully!');