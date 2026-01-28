'use strict';

require('should');
// const fc = require('fast-check'); // Will be installed: npm install --save-dev fast-check

describe('Basal Rate Optimizer', function() {
  
  var basalRateOptimizer;
  
  before(function() {
    // Initialize the plugin
    basalRateOptimizer = require('../lib/report_plugins/basal-rate-optimizer')();
  });
  
  describe('Core Utility Functions', function() {
    
    describe('classifyTimeBlock', function() {
      
      it('should classify 23:00 as overnight', function() {
        var timestamp = new Date('2024-01-15T23:00:00').getTime();
        basalRateOptimizer.classifyTimeBlock(timestamp).should.equal('overnight');
      });
      
      it('should classify 02:00 as overnight', function() {
        var timestamp = new Date('2024-01-15T02:00:00').getTime();
        basalRateOptimizer.classifyTimeBlock(timestamp).should.equal('overnight');
      });
      
      it('should classify 06:00 as morning', function() {
        var timestamp = new Date('2024-01-15T06:00:00').getTime();
        basalRateOptimizer.classifyTimeBlock(timestamp).should.equal('morning');
      });
      
      it('should classify 09:00 as morning', function() {
        var timestamp = new Date('2024-01-15T09:00:00').getTime();
        basalRateOptimizer.classifyTimeBlock(timestamp).should.equal('morning');
      });
      
      it('should classify 12:00 as afternoon', function() {
        var timestamp = new Date('2024-01-15T12:00:00').getTime();
        basalRateOptimizer.classifyTimeBlock(timestamp).should.equal('afternoon');
      });
      
      it('should classify 15:00 as afternoon', function() {
        var timestamp = new Date('2024-01-15T15:00:00').getTime();
        basalRateOptimizer.classifyTimeBlock(timestamp).should.equal('afternoon');
      });
      
      it('should classify 18:00 as evening', function() {
        var timestamp = new Date('2024-01-15T18:00:00').getTime();
        basalRateOptimizer.classifyTimeBlock(timestamp).should.equal('evening');
      });
      
      it('should classify 20:00 as evening', function() {
        var timestamp = new Date('2024-01-15T20:00:00').getTime();
        basalRateOptimizer.classifyTimeBlock(timestamp).should.equal('evening');
      });
      
      it('should classify boundary at 22:00 as overnight', function() {
        var timestamp = new Date('2024-01-15T22:00:00').getTime();
        basalRateOptimizer.classifyTimeBlock(timestamp).should.equal('overnight');
      });
      
      it('should classify boundary at 05:59 as overnight', function() {
        var timestamp = new Date('2024-01-15T05:59:00').getTime();
        basalRateOptimizer.classifyTimeBlock(timestamp).should.equal('overnight');
      });
      
      it('should classify boundary at 11:59 as morning', function() {
        var timestamp = new Date('2024-01-15T11:59:00').getTime();
        basalRateOptimizer.classifyTimeBlock(timestamp).should.equal('morning');
      });
      
      it('should classify boundary at 17:59 as afternoon', function() {
        var timestamp = new Date('2024-01-15T17:59:00').getTime();
        basalRateOptimizer.classifyTimeBlock(timestamp).should.equal('afternoon');
      });
      
      it('should classify boundary at 21:59 as evening', function() {
        var timestamp = new Date('2024-01-15T21:59:00').getTime();
        basalRateOptimizer.classifyTimeBlock(timestamp).should.equal('evening');
      });
      
    });
    
    describe('validateFastingPeriodData', function() {
      
      it('should reject null fasting period', function() {
        var result = basalRateOptimizer.validateFastingPeriodData(null);
        result.valid.should.equal(false);
        result.reason.should.containEql('null or undefined');
      });
      
      it('should reject undefined fasting period', function() {
        var result = basalRateOptimizer.validateFastingPeriodData(undefined);
        result.valid.should.equal(false);
        result.reason.should.containEql('null or undefined');
      });
      
      it('should reject period without start time', function() {
        var period = {
          endTime: Date.now(),
          glucoseReadings: [{mills: Date.now(), sgv: 100}]
        };
        var result = basalRateOptimizer.validateFastingPeriodData(period);
        result.valid.should.equal(false);
        result.reason.should.containEql('start or end time');
      });
      
      it('should reject period without glucose readings', function() {
        var period = {
          startTime: Date.now(),
          endTime: Date.now()
        };
        var result = basalRateOptimizer.validateFastingPeriodData(period);
        result.valid.should.equal(false);
        result.reason.should.containEql('glucose readings');
      });
      
      it('should reject period with insufficient glucose readings', function() {
        var period = {
          startTime: Date.now(),
          endTime: Date.now(),
          glucoseReadings: [{mills: Date.now(), sgv: 100}]
        };
        var result = basalRateOptimizer.validateFastingPeriodData(period);
        result.valid.should.equal(false);
        result.reason.should.containEql('Insufficient glucose readings');
      });
      
      it('should accept valid fasting period', function() {
        var now = Date.now();
        var period = {
          startTime: now,
          endTime: now + 4 * 60 * 60 * 1000,
          glucoseReadings: [
            {mills: now, sgv: 100},
            {mills: now + 5 * 60 * 1000, sgv: 102}
          ]
        };
        var result = basalRateOptimizer.validateFastingPeriodData(period);
        result.valid.should.equal(true);
        (result.reason === null).should.equal(true);
      });
      
    });
    
    describe('groupByTimeOfDay', function() {
      
      it('should return empty groups for empty array', function() {
        var groups = basalRateOptimizer.groupByTimeOfDay([]);
        groups.should.have.property('overnight');
        groups.should.have.property('morning');
        groups.should.have.property('afternoon');
        groups.should.have.property('evening');
        groups.overnight.length.should.equal(0);
        groups.morning.length.should.equal(0);
        groups.afternoon.length.should.equal(0);
        groups.evening.length.should.equal(0);
      });
      
      it('should group periods correctly by time of day', function() {
        var periods = [
          {startTime: new Date('2024-01-15T02:00:00').getTime()}, // overnight
          {startTime: new Date('2024-01-15T08:00:00').getTime()}, // morning
          {startTime: new Date('2024-01-15T14:00:00').getTime()}, // afternoon
          {startTime: new Date('2024-01-15T19:00:00').getTime()}, // evening
          {startTime: new Date('2024-01-15T23:00:00').getTime()}  // overnight
        ];
        
        var groups = basalRateOptimizer.groupByTimeOfDay(periods);
        groups.overnight.length.should.equal(2);
        groups.morning.length.should.equal(1);
        groups.afternoon.length.should.equal(1);
        groups.evening.length.should.equal(1);
      });
      
      it('should handle null input gracefully', function() {
        var groups = basalRateOptimizer.groupByTimeOfDay(null);
        groups.should.have.property('overnight');
        groups.overnight.length.should.equal(0);
      });
      
    });
    
    describe('getTimeBlockLabel', function() {
      
      it('should return correct label for overnight', function() {
        basalRateOptimizer.getTimeBlockLabel('overnight').should.equal('Overnight (10 PM - 6 AM)');
      });
      
      it('should return correct label for morning', function() {
        basalRateOptimizer.getTimeBlockLabel('morning').should.equal('Morning (6 AM - 12 PM)');
      });
      
      it('should return correct label for afternoon', function() {
        basalRateOptimizer.getTimeBlockLabel('afternoon').should.equal('Afternoon (12 PM - 6 PM)');
      });
      
      it('should return correct label for evening', function() {
        basalRateOptimizer.getTimeBlockLabel('evening').should.equal('Evening (6 PM - 10 PM)');
      });
      
    });
    
    describe('formatTimestamp', function() {
      
      it('should format timestamp with default format', function() {
        var timestamp = new Date('2024-01-15T14:30:00').getTime();
        var formatted = basalRateOptimizer.formatTimestamp(timestamp);
        formatted.should.match(/2024-01-15 14:30/);
      });
      
      it('should format timestamp with custom format', function() {
        var timestamp = new Date('2024-01-15T14:30:00').getTime();
        var formatted = basalRateOptimizer.formatTimestamp(timestamp, 'YYYY-MM-DD');
        formatted.should.equal('2024-01-15');
      });
      
    });
    
    describe('roundTo', function() {
      
      it('should round to 2 decimal places by default', function() {
        basalRateOptimizer.roundTo(3.14159).should.equal(3.14);
      });
      
      it('should round to specified decimal places', function() {
        basalRateOptimizer.roundTo(3.14159, 3).should.equal(3.142);
      });
      
      it('should round to 0 decimal places', function() {
        basalRateOptimizer.roundTo(3.7, 0).should.equal(4);
      });
      
    });
    
  });
  
  describe('generateRecommendations', function() {
    
    it('should return error for null fasting periods', function() {
      var result = basalRateOptimizer.generateRecommendations(null, {});
      result.should.have.property('error');
      result.error.should.equal('NO_DATA');
    });
    
    it('should return error for empty fasting periods array', function() {
      var result = basalRateOptimizer.generateRecommendations([], {});
      result.should.have.property('error');
      result.error.should.equal('NO_DATA');
    });
    
    it('should return recommendations structure with metadata', function() {
      var now = Date.now();
      var periods = [
        {
          startTime: new Date('2024-01-15T02:00:00').getTime(),
          endTime: new Date('2024-01-15T06:00:00').getTime(),
          glucoseReadings: [
            {mills: new Date('2024-01-15T02:00:00').getTime(), sgv: 100},
            {mills: new Date('2024-01-15T06:00:00').getTime(), sgv: 105}
          ]
        }
      ];
      
      var result = basalRateOptimizer.generateRecommendations(periods, {});
      result.should.have.property('recommendations');
      result.should.have.property('metadata');
      result.metadata.should.have.property('periodCount');
      result.metadata.should.have.property('startDate');
      result.metadata.should.have.property('endDate');
      result.metadata.periodCount.should.equal(1);
    });
    
  });
  
  describe('Statistical Analysis Engine', function() {
    
    describe('calculateLinearRegression', function() {
      
      it('should throw error for null input', function() {
        (function() {
          basalRateOptimizer.calculateLinearRegression(null);
        }).should.throw(/must be an array/);
      });
      
      it('should throw error for insufficient data points', function() {
        (function() {
          basalRateOptimizer.calculateLinearRegression([{mills: Date.now(), sgv: 100}]);
        }).should.throw(/at least 2 data points/);
      });
      
      it('should calculate regression for perfectly linear rising data', function() {
        // Create data points: y = 2x + 100 (slope = 2 mg/dL per hour)
        var startTime = new Date('2024-01-15T00:00:00').getTime();
        var readings = [
          {mills: startTime, sgv: 100},                           // t=0h, y=100
          {mills: startTime + 1 * 60 * 60 * 1000, sgv: 102},     // t=1h, y=102
          {mills: startTime + 2 * 60 * 60 * 1000, sgv: 104},     // t=2h, y=104
          {mills: startTime + 3 * 60 * 60 * 1000, sgv: 106}      // t=3h, y=106
        ];
        
        var result = basalRateOptimizer.calculateLinearRegression(readings);
        
        // Slope should be 2 mg/dL per hour
        result.slope.should.be.approximately(2, 0.01);
        // Intercept should be 100
        result.intercept.should.be.approximately(100, 0.01);
        // R² should be 1 (perfect fit)
        result.rSquared.should.be.approximately(1, 0.01);
      });
      
      it('should calculate regression for perfectly linear falling data', function() {
        // Create data points: y = -3x + 150 (slope = -3 mg/dL per hour)
        var startTime = new Date('2024-01-15T00:00:00').getTime();
        var readings = [
          {mills: startTime, sgv: 150},                           // t=0h, y=150
          {mills: startTime + 1 * 60 * 60 * 1000, sgv: 147},     // t=1h, y=147
          {mills: startTime + 2 * 60 * 60 * 1000, sgv: 144},     // t=2h, y=144
          {mills: startTime + 3 * 60 * 60 * 1000, sgv: 141}      // t=3h, y=141
        ];
        
        var result = basalRateOptimizer.calculateLinearRegression(readings);
        
        // Slope should be -3 mg/dL per hour
        result.slope.should.be.approximately(-3, 0.01);
        // Intercept should be 150
        result.intercept.should.be.approximately(150, 0.01);
        // R² should be 1 (perfect fit)
        result.rSquared.should.be.approximately(1, 0.01);
      });
      
      it('should calculate regression for stable glucose (horizontal line)', function() {
        var startTime = new Date('2024-01-15T00:00:00').getTime();
        var readings = [
          {mills: startTime, sgv: 100},
          {mills: startTime + 1 * 60 * 60 * 1000, sgv: 100},
          {mills: startTime + 2 * 60 * 60 * 1000, sgv: 100},
          {mills: startTime + 3 * 60 * 60 * 1000, sgv: 100}
        ];
        
        var result = basalRateOptimizer.calculateLinearRegression(readings);
        
        // Slope should be 0 (no change)
        result.slope.should.be.approximately(0, 0.01);
        // Intercept should be 100
        result.intercept.should.be.approximately(100, 0.01);
        // R² should be 1 (perfect fit to horizontal line)
        result.rSquared.should.be.approximately(1, 0.01);
      });
      
      it('should calculate regression for noisy data with rising trend', function() {
        var startTime = new Date('2024-01-15T00:00:00').getTime();
        var readings = [
          {mills: startTime, sgv: 100},
          {mills: startTime + 1 * 60 * 60 * 1000, sgv: 103},     // Expected 102, actual 103
          {mills: startTime + 2 * 60 * 60 * 1000, sgv: 103},     // Expected 104, actual 103
          {mills: startTime + 3 * 60 * 60 * 1000, sgv: 107}      // Expected 106, actual 107
        ];
        
        var result = basalRateOptimizer.calculateLinearRegression(readings);
        
        // Slope should be approximately 2 mg/dL per hour
        result.slope.should.be.approximately(2, 0.5);
        // R² should be less than 1 but still reasonably high
        result.rSquared.should.be.above(0.5);
        result.rSquared.should.be.below(1);
      });
      
      it('should handle edge case with only 2 data points', function() {
        var startTime = new Date('2024-01-15T00:00:00').getTime();
        var readings = [
          {mills: startTime, sgv: 100},
          {mills: startTime + 2 * 60 * 60 * 1000, sgv: 110}
        ];
        
        var result = basalRateOptimizer.calculateLinearRegression(readings);
        
        // Slope should be 5 mg/dL per hour (10 mg/dL over 2 hours)
        result.slope.should.be.approximately(5, 0.01);
        // R² should be 1 (2 points always make a perfect line)
        result.rSquared.should.be.approximately(1, 0.01);
      });
      
      it('should handle edge case with identical timestamps (denominator = 0)', function() {
        var timestamp = new Date('2024-01-15T00:00:00').getTime();
        var readings = [
          {mills: timestamp, sgv: 100},
          {mills: timestamp, sgv: 105},
          {mills: timestamp, sgv: 110}
        ];
        
        var result = basalRateOptimizer.calculateLinearRegression(readings);
        
        // Slope should be 0 (can't calculate slope with no time difference)
        result.slope.should.equal(0);
        // Intercept should be mean of y values
        result.intercept.should.be.approximately(105, 0.01);
        // R² should be 0 (no trend)
        result.rSquared.should.equal(0);
      });
      
      it('should return R² between 0 and 1', function() {
        var startTime = new Date('2024-01-15T00:00:00').getTime();
        var readings = [
          {mills: startTime, sgv: 100},
          {mills: startTime + 1 * 60 * 60 * 1000, sgv: 120},
          {mills: startTime + 2 * 60 * 60 * 1000, sgv: 95},
          {mills: startTime + 3 * 60 * 60 * 1000, sgv: 115}
        ];
        
        var result = basalRateOptimizer.calculateLinearRegression(readings);
        
        // R² should be between 0 and 1
        result.rSquared.should.be.within(0, 1);
      });
      
      it('should calculate correct slope in mg/dL per hour', function() {
        // Test with 5-minute intervals (typical CGM frequency)
        var startTime = new Date('2024-01-15T00:00:00').getTime();
        var readings = [];
        
        // Create 1 hour of data with slope of 10 mg/dL per hour
        for (var i = 0; i <= 12; i++) { // 13 readings over 1 hour (5-min intervals)
          readings.push({
            mills: startTime + i * 5 * 60 * 1000,
            sgv: 100 + (i * 5 / 60) * 10  // 10 mg/dL per hour
          });
        }
        
        var result = basalRateOptimizer.calculateLinearRegression(readings);
        
        // Slope should be 10 mg/dL per hour
        result.slope.should.be.approximately(10, 0.01);
      });
      
    });
    
    describe('classifyTrend', function() {
      
      it('should classify as rising when slope > 5 and R² > 0.5', function() {
        basalRateOptimizer.classifyTrend(6, 0.6).should.equal('rising');
        basalRateOptimizer.classifyTrend(10, 0.8).should.equal('rising');
        basalRateOptimizer.classifyTrend(5.1, 0.51).should.equal('rising');
      });
      
      it('should classify as falling when slope < -5 and R² > 0.5', function() {
        basalRateOptimizer.classifyTrend(-6, 0.6).should.equal('falling');
        basalRateOptimizer.classifyTrend(-10, 0.8).should.equal('falling');
        basalRateOptimizer.classifyTrend(-5.1, 0.51).should.equal('falling');
      });
      
      it('should classify as stable when slope is between -5 and 5', function() {
        basalRateOptimizer.classifyTrend(0, 0.9).should.equal('stable');
        basalRateOptimizer.classifyTrend(3, 0.8).should.equal('stable');
        basalRateOptimizer.classifyTrend(-3, 0.8).should.equal('stable');
        basalRateOptimizer.classifyTrend(5, 0.9).should.equal('stable');
        basalRateOptimizer.classifyTrend(-5, 0.9).should.equal('stable');
      });
      
      it('should classify as stable when R² <= 0.5 regardless of slope', function() {
        basalRateOptimizer.classifyTrend(10, 0.5).should.equal('stable');
        basalRateOptimizer.classifyTrend(10, 0.3).should.equal('stable');
        basalRateOptimizer.classifyTrend(-10, 0.5).should.equal('stable');
        basalRateOptimizer.classifyTrend(-10, 0.2).should.equal('stable');
      });
      
      it('should classify boundary cases correctly', function() {
        // Exactly at slope threshold with good R²
        basalRateOptimizer.classifyTrend(5, 0.6).should.equal('stable');
        basalRateOptimizer.classifyTrend(-5, 0.6).should.equal('stable');
        
        // Just above slope threshold with good R²
        basalRateOptimizer.classifyTrend(5.01, 0.6).should.equal('rising');
        basalRateOptimizer.classifyTrend(-5.01, 0.6).should.equal('falling');
        
        // Good slope but exactly at R² threshold
        basalRateOptimizer.classifyTrend(10, 0.5).should.equal('stable');
        basalRateOptimizer.classifyTrend(-10, 0.5).should.equal('stable');
        
        // Good slope and just above R² threshold
        basalRateOptimizer.classifyTrend(10, 0.51).should.equal('rising');
        basalRateOptimizer.classifyTrend(-10, 0.51).should.equal('falling');
      });
      
    });
    
    describe('calculateCV', function() {
      
      it('should throw error for null input', function() {
        (function() {
          basalRateOptimizer.calculateCV(null);
        }).should.throw(/must be an array/);
      });
      
      it('should throw error for empty array', function() {
        (function() {
          basalRateOptimizer.calculateCV([]);
        }).should.throw(/cannot be empty/);
      });
      
      it('should return 0 for single value (no variation)', function() {
        var cv = basalRateOptimizer.calculateCV([100]);
        cv.should.equal(0);
      });
      
      it('should return 0 for identical values (no variation)', function() {
        var cv = basalRateOptimizer.calculateCV([100, 100, 100, 100]);
        cv.should.equal(0);
      });
      
      it('should calculate CV for stable glucose (low variability)', function() {
        // Glucose values: 100, 102, 98, 101, 99
        // Mean = 100, SD ≈ 1.58, CV ≈ 1.58%
        var values = [100, 102, 98, 101, 99];
        var cv = basalRateOptimizer.calculateCV(values);
        
        // CV should be low (< 5%)
        cv.should.be.below(5);
        cv.should.be.approximately(1.58, 0.1);
      });
      
      it('should calculate CV for variable glucose (high variability)', function() {
        // Glucose values: 80, 120, 90, 130, 100
        // Mean = 104, SD ≈ 21.68, CV ≈ 20.8%
        var values = [80, 120, 90, 130, 100];
        var cv = basalRateOptimizer.calculateCV(values);
        
        // CV should be higher (> 15%)
        cv.should.be.above(15);
        cv.should.be.approximately(20.8, 1);
      });
      
      it('should calculate CV correctly for known values', function() {
        // Test with simple values where we can calculate manually
        // Values: 100, 110, 90
        // Mean = 100
        // Variance = ((0)² + (10)² + (-10)²) / 2 = 200 / 2 = 100
        // SD = 10
        // CV = (10 / 100) * 100 = 10%
        var values = [100, 110, 90];
        var cv = basalRateOptimizer.calculateCV(values);
        
        cv.should.be.approximately(10, 0.01);
      });
      
      it('should handle edge case with mean of zero', function() {
        // If all values are 0, mean is 0, should return 0 (not divide by zero)
        var cv = basalRateOptimizer.calculateCV([0, 0, 0]);
        cv.should.equal(0);
      });
      
      it('should calculate CV for realistic CGM data', function() {
        // Simulate 1 hour of stable CGM data (5-minute intervals)
        var values = [105, 103, 104, 106, 105, 104, 103, 105, 106, 104, 105, 103, 104];
        var cv = basalRateOptimizer.calculateCV(values);
        
        // Should be low variability (< 5%)
        cv.should.be.below(5);
      });
      
      it('should calculate CV for realistic variable CGM data', function() {
        // Simulate variable glucose
        var values = [120, 135, 145, 130, 125, 140, 150, 135, 125, 130];
        var cv = basalRateOptimizer.calculateCV(values);
        
        // Should show moderate variability (5-15%)
        cv.should.be.above(5);
        cv.should.be.below(20);
      });
      
      it('should return a non-negative number', function() {
        var values = [100, 110, 90, 105, 95];
        var cv = basalRateOptimizer.calculateCV(values);
        
        cv.should.be.above(0);
      });
      
      it('should use sample standard deviation (n-1)', function() {
        // For 2 values: 100, 110
        // Mean = 105
        // Sample variance = ((100-105)² + (110-105)²) / (2-1) = (25 + 25) / 1 = 50
        // Sample SD = sqrt(50) ≈ 7.07
        // CV = (7.07 / 105) * 100 ≈ 6.73%
        var values = [100, 110];
        var cv = basalRateOptimizer.calculateCV(values);
        
        cv.should.be.approximately(6.73, 0.1);
      });
      
    });
    
  });
  
  describe('Safety Validation Engine', function() {
    
    describe('detectHypoglycemia', function() {
      
      it('should return false for null input', function() {
        basalRateOptimizer.detectHypoglycemia(null).should.equal(false);
      });
      
      it('should return false for empty array', function() {
        basalRateOptimizer.detectHypoglycemia([]).should.equal(false);
      });
      
      it('should return false when no readings below 70 mg/dL', function() {
        var startTime = new Date('2024-01-15T00:00:00').getTime();
        var readings = [
          {mills: startTime, sgv: 100},
          {mills: startTime + 5 * 60 * 1000, sgv: 95},
          {mills: startTime + 10 * 60 * 1000, sgv: 90},
          {mills: startTime + 15 * 60 * 1000, sgv: 85},
          {mills: startTime + 20 * 60 * 1000, sgv: 80}
        ];
        
        basalRateOptimizer.detectHypoglycemia(readings).should.equal(false);
      });
      
      it('should return false when below 70 mg/dL for less than 15 minutes', function() {
        var startTime = new Date('2024-01-15T00:00:00').getTime();
        var readings = [
          {mills: startTime, sgv: 100},
          {mills: startTime + 5 * 60 * 1000, sgv: 68},  // Below threshold
          {mills: startTime + 10 * 60 * 1000, sgv: 65}, // Below threshold (10 min total)
          {mills: startTime + 15 * 60 * 1000, sgv: 75}, // Back above threshold
          {mills: startTime + 20 * 60 * 1000, sgv: 80}
        ];
        
        basalRateOptimizer.detectHypoglycemia(readings).should.equal(false);
      });
      
      it('should return true when below 70 mg/dL for more than 15 minutes', function() {
        var startTime = new Date('2024-01-15T00:00:00').getTime();
        var readings = [
          {mills: startTime, sgv: 100},
          {mills: startTime + 5 * 60 * 1000, sgv: 68},  // Below threshold
          {mills: startTime + 10 * 60 * 1000, sgv: 65}, // Below threshold
          {mills: startTime + 15 * 60 * 1000, sgv: 63}, // Below threshold
          {mills: startTime + 20 * 60 * 1000, sgv: 62}, // Below threshold (20 min total > 15 min)
          {mills: startTime + 25 * 60 * 1000, sgv: 75}
        ];
        
        basalRateOptimizer.detectHypoglycemia(readings).should.equal(true);
      });
      
      it('should reset hypo timer when glucose goes above 70 mg/dL', function() {
        var startTime = new Date('2024-01-15T00:00:00').getTime();
        var readings = [
          {mills: startTime, sgv: 68},                  // Below threshold
          {mills: startTime + 5 * 60 * 1000, sgv: 65},  // Below threshold (5 min)
          {mills: startTime + 10 * 60 * 1000, sgv: 75}, // Above threshold - reset
          {mills: startTime + 15 * 60 * 1000, sgv: 68}, // Below threshold again - restart
          {mills: startTime + 20 * 60 * 1000, sgv: 65}, // Below threshold (5 min from restart)
          {mills: startTime + 25 * 60 * 1000, sgv: 80}
        ];
        
        // Should return false because hypo was reset and never exceeded 15 min continuously
        basalRateOptimizer.detectHypoglycemia(readings).should.equal(false);
      });
      
      it('should detect hypoglycemia at exactly 15 minutes boundary', function() {
        var startTime = new Date('2024-01-15T00:00:00').getTime();
        var readings = [
          {mills: startTime, sgv: 68},
          {mills: startTime + 15 * 60 * 1000, sgv: 65}, // Exactly 15 min
          {mills: startTime + 16 * 60 * 1000, sgv: 63}  // Just over 15 min
        ];
        
        basalRateOptimizer.detectHypoglycemia(readings).should.equal(true);
      });
      
      it('should handle readings at exactly 70 mg/dL (not below)', function() {
        var startTime = new Date('2024-01-15T00:00:00').getTime();
        var readings = [
          {mills: startTime, sgv: 70},                  // Exactly at threshold (not below)
          {mills: startTime + 5 * 60 * 1000, sgv: 70},
          {mills: startTime + 10 * 60 * 1000, sgv: 70},
          {mills: startTime + 15 * 60 * 1000, sgv: 70},
          {mills: startTime + 20 * 60 * 1000, sgv: 70}
        ];
        
        // Should return false because 70 is not below 70
        basalRateOptimizer.detectHypoglycemia(readings).should.equal(false);
      });
      
    });
    
    describe('validateFastingPeriod', function() {
      
      it('should return qualified: false for null inputs', function() {
        var result = basalRateOptimizer.validateFastingPeriod(null, null);
        result.qualified.should.equal(false);
        result.reason.should.containEql('Invalid input');
      });
      
      it('should disqualify period with duration < 4 hours', function() {
        var startTime = new Date('2024-01-15T00:00:00').getTime();
        var period = {
          startTime: startTime,
          endTime: startTime + 3.5 * 60 * 60 * 1000, // 3.5 hours
          glucoseReadings: [
            {mills: startTime, sgv: 100},
            {mills: startTime + 1 * 60 * 60 * 1000, sgv: 102}
          ]
        };
        var analysis = {cv: 5};
        
        var result = basalRateOptimizer.validateFastingPeriod(period, analysis);
        result.qualified.should.equal(false);
        result.reason.should.containEql('Duration too short');
      });
      
      it('should disqualify period with CV% > 30', function() {
        var startTime = new Date('2024-01-15T00:00:00').getTime();
        var period = {
          startTime: startTime,
          endTime: startTime + 5 * 60 * 60 * 1000, // 5 hours
          glucoseReadings: [
            {mills: startTime, sgv: 100},
            {mills: startTime + 1 * 60 * 60 * 1000, sgv: 102}
          ]
        };
        var analysis = {cv: 35}; // High variability
        
        var result = basalRateOptimizer.validateFastingPeriod(period, analysis);
        result.qualified.should.equal(false);
        result.reason.should.containEql('Too variable');
      });
      
      it('should disqualify period with hypoglycemia', function() {
        var startTime = new Date('2024-01-15T00:00:00').getTime();
        var period = {
          startTime: startTime,
          endTime: startTime + 5 * 60 * 60 * 1000,
          glucoseReadings: [
            {mills: startTime, sgv: 100},
            {mills: startTime + 1 * 60 * 60 * 1000, sgv: 68},
            {mills: startTime + 2 * 60 * 60 * 1000, sgv: 65},
            {mills: startTime + 3 * 60 * 60 * 1000, sgv: 63},
            {mills: startTime + 4 * 60 * 60 * 1000, sgv: 75}
          ]
        };
        var analysis = {cv: 10};
        
        var result = basalRateOptimizer.validateFastingPeriod(period, analysis);
        result.qualified.should.equal(false);
        result.reason.should.containEql('hypoglycemia');
      });
      
      it('should disqualify period with glucose > 250 mg/dL', function() {
        var startTime = new Date('2024-01-15T00:00:00').getTime();
        var period = {
          startTime: startTime,
          endTime: startTime + 5 * 60 * 60 * 1000,
          glucoseReadings: [
            {mills: startTime, sgv: 200},
            {mills: startTime + 1 * 60 * 60 * 1000, sgv: 260}, // Hyperglycemia
            {mills: startTime + 2 * 60 * 60 * 1000, sgv: 240}
          ]
        };
        var analysis = {cv: 10};
        
        var result = basalRateOptimizer.validateFastingPeriod(period, analysis);
        result.qualified.should.equal(false);
        result.reason.should.containEql('hyperglycemia');
      });
      
      it('should qualify period that meets all criteria', function() {
        var startTime = new Date('2024-01-15T00:00:00').getTime();
        var period = {
          startTime: startTime,
          endTime: startTime + 5 * 60 * 60 * 1000, // 5 hours
          glucoseReadings: [
            {mills: startTime, sgv: 100},
            {mills: startTime + 1 * 60 * 60 * 1000, sgv: 102},
            {mills: startTime + 2 * 60 * 60 * 1000, sgv: 104},
            {mills: startTime + 3 * 60 * 60 * 1000, sgv: 103},
            {mills: startTime + 4 * 60 * 60 * 1000, sgv: 105}
          ]
        };
        var analysis = {cv: 15}; // Good variability
        
        var result = basalRateOptimizer.validateFastingPeriod(period, analysis);
        result.qualified.should.equal(true);
        (result.reason === null).should.equal(true);
      });
      
      it('should accept period at exactly 4 hours duration', function() {
        var startTime = new Date('2024-01-15T00:00:00').getTime();
        var period = {
          startTime: startTime,
          endTime: startTime + 4 * 60 * 60 * 1000, // Exactly 4 hours
          glucoseReadings: [
            {mills: startTime, sgv: 100},
            {mills: startTime + 1 * 60 * 60 * 1000, sgv: 102}
          ]
        };
        var analysis = {cv: 10};
        
        var result = basalRateOptimizer.validateFastingPeriod(period, analysis);
        result.qualified.should.equal(true);
      });
      
      it('should accept period at exactly 30% CV', function() {
        var startTime = new Date('2024-01-15T00:00:00').getTime();
        var period = {
          startTime: startTime,
          endTime: startTime + 5 * 60 * 60 * 1000,
          glucoseReadings: [
            {mills: startTime, sgv: 100},
            {mills: startTime + 1 * 60 * 60 * 1000, sgv: 102}
          ]
        };
        var analysis = {cv: 30}; // Exactly at threshold
        
        var result = basalRateOptimizer.validateFastingPeriod(period, analysis);
        result.qualified.should.equal(true);
      });
      
      it('should accept period with glucose at exactly 250 mg/dL', function() {
        var startTime = new Date('2024-01-15T00:00:00').getTime();
        var period = {
          startTime: startTime,
          endTime: startTime + 5 * 60 * 60 * 1000,
          glucoseReadings: [
            {mills: startTime, sgv: 200},
            {mills: startTime + 1 * 60 * 60 * 1000, sgv: 250}, // Exactly at threshold
            {mills: startTime + 2 * 60 * 60 * 1000, sgv: 240}
          ]
        };
        var analysis = {cv: 10};
        
        var result = basalRateOptimizer.validateFastingPeriod(period, analysis);
        result.qualified.should.equal(true);
      });
      
    });
    
    describe('applyAdjustmentLimits', function() {
      
      it('should return 0 for invalid inputs', function() {
        basalRateOptimizer.applyAdjustmentLimits(null, 1.0).should.equal(0);
        basalRateOptimizer.applyAdjustmentLimits(0.1, null).should.equal(0);
      });
      
      it('should apply absolute limit of ±0.15 U/hr', function() {
        // Test positive adjustment exceeding limit
        basalRateOptimizer.applyAdjustmentLimits(0.20, 1.0).should.equal(0.15);
        
        // Test negative adjustment exceeding limit
        basalRateOptimizer.applyAdjustmentLimits(-0.20, 1.0).should.equal(-0.15);
      });
      
      it('should apply percentage limit of ±20% of current rate', function() {
        // Current rate: 1.0 U/hr, 20% = 0.20 U/hr
        // Adjustment of 0.25 should be limited to 0.20
        basalRateOptimizer.applyAdjustmentLimits(0.25, 1.0).should.equal(0.15); // Absolute limit kicks in first
        
        // Current rate: 0.5 U/hr, 20% = 0.10 U/hr
        // Adjustment of 0.12 should be limited to 0.10
        basalRateOptimizer.applyAdjustmentLimits(0.12, 0.5).should.equal(0.10);
        
        // Test negative adjustment
        basalRateOptimizer.applyAdjustmentLimits(-0.12, 0.5).should.equal(-0.10);
      });
      
      it('should apply minimum threshold of 0.025 U/hr', function() {
        // Adjustment below threshold should become 0
        basalRateOptimizer.applyAdjustmentLimits(0.02, 1.0).should.equal(0);
        basalRateOptimizer.applyAdjustmentLimits(-0.02, 1.0).should.equal(0);
        basalRateOptimizer.applyAdjustmentLimits(0.01, 1.0).should.equal(0);
        
        // Adjustment at threshold should pass through
        basalRateOptimizer.applyAdjustmentLimits(0.025, 1.0).should.equal(0.025);
        basalRateOptimizer.applyAdjustmentLimits(-0.025, 1.0).should.equal(-0.025);
      });
      
      it('should pass through adjustments within all limits', function() {
        // Adjustment of 0.05 with rate 1.0 should pass through
        basalRateOptimizer.applyAdjustmentLimits(0.05, 1.0).should.equal(0.05);
        basalRateOptimizer.applyAdjustmentLimits(-0.05, 1.0).should.equal(-0.05);
        
        // Adjustment of 0.10 with rate 1.0 should pass through
        basalRateOptimizer.applyAdjustmentLimits(0.10, 1.0).should.equal(0.10);
      });
      
      it('should apply the most restrictive limit', function() {
        // For low basal rates, percentage limit is more restrictive
        // Current rate: 0.3 U/hr, 20% = 0.06 U/hr
        // Adjustment of 0.10 should be limited to 0.06 (percentage limit)
        basalRateOptimizer.applyAdjustmentLimits(0.10, 0.3).should.equal(0.06);
        
        // For high basal rates, absolute limit is more restrictive
        // Current rate: 2.0 U/hr, 20% = 0.40 U/hr
        // Adjustment of 0.30 should be limited to 0.15 (absolute limit)
        basalRateOptimizer.applyAdjustmentLimits(0.30, 2.0).should.equal(0.15);
      });
      
      it('should handle edge case at exactly 0.15 U/hr', function() {
        basalRateOptimizer.applyAdjustmentLimits(0.15, 1.0).should.equal(0.15);
        basalRateOptimizer.applyAdjustmentLimits(-0.15, 1.0).should.equal(-0.15);
      });
      
      it('should handle edge case at exactly 20% of current rate', function() {
        // Current rate: 1.0 U/hr, 20% = 0.20 U/hr
        // But absolute limit of 0.15 applies first
        basalRateOptimizer.applyAdjustmentLimits(0.20, 1.0).should.equal(0.15);
        
        // Current rate: 0.5 U/hr, 20% = 0.10 U/hr
        basalRateOptimizer.applyAdjustmentLimits(0.10, 0.5).should.equal(0.10);
      });
      
      it('should handle very small basal rates', function() {
        // Current rate: 0.1 U/hr, 20% = 0.02 U/hr
        // Adjustment of 0.05 should be limited to 0.02
        basalRateOptimizer.applyAdjustmentLimits(0.05, 0.1).should.equal(0);
        // Actually, 0.02 is below minimum threshold of 0.025, so it becomes 0
      });
      
      it('should handle zero adjustment', function() {
        basalRateOptimizer.applyAdjustmentLimits(0, 1.0).should.equal(0);
      });
      
    });
    
  });
  
});

// ============================================================================
// PROPERTY-BASED TESTS
// ============================================================================
// 
// NOTE: These tests require fast-check to be installed:
//   npm install --save-dev fast-check
//
// Uncomment the tests below after installing fast-check
// ============================================================================

describe('Basal Rate Optimizer - Property-Based Tests', function() {
  
  const fc = require('fast-check');
  var basalRateOptimizer;
  
  before(function() {
    basalRateOptimizer = require('../lib/report_plugins/basal-rate-optimizer')();
  });
  
  describe('Property 4: Time Block Classification', function() {
    
    // Feature: basal-rate-optimization, Property 4: Time Block Classification
    // Validates: Requirements 2.1, 2.2, 2.3, 2.4
    
    it('should classify any hour >= 22 or < 6 as overnight', function() {
      fc.assert(
        fc.property(
          fc.integer({min: 0, max: 23}),
          fc.integer({min: 1, max: 28}),
          fc.integer({min: 0, max: 59}),
          (hour, day, minute) => {
            var date = new Date(2024, 0, day, hour, minute, 0);
            var timestamp = date.getTime();
            var result = basalRateOptimizer.classifyTimeBlock(timestamp);
            
            if (hour >= 22 || hour < 6) {
              return result === 'overnight';
            }
            return true; // Don't care about other hours in this test
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should classify any hour >= 6 and < 12 as morning', function() {
      fc.assert(
        fc.property(
          fc.integer({min: 0, max: 23}),
          fc.integer({min: 1, max: 28}),
          fc.integer({min: 0, max: 59}),
          (hour, day, minute) => {
            var date = new Date(2024, 0, day, hour, minute, 0);
            var timestamp = date.getTime();
            var result = basalRateOptimizer.classifyTimeBlock(timestamp);
            
            if (hour >= 6 && hour < 12) {
              return result === 'morning';
            }
            return true; // Don't care about other hours in this test
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should classify any hour >= 12 and < 18 as afternoon', function() {
      fc.assert(
        fc.property(
          fc.integer({min: 0, max: 23}),
          fc.integer({min: 1, max: 28}),
          fc.integer({min: 0, max: 59}),
          (hour, day, minute) => {
            var date = new Date(2024, 0, day, hour, minute, 0);
            var timestamp = date.getTime();
            var result = basalRateOptimizer.classifyTimeBlock(timestamp);
            
            if (hour >= 12 && hour < 18) {
              return result === 'afternoon';
            }
            return true; // Don't care about other hours in this test
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should classify any hour >= 18 and < 22 as evening', function() {
      fc.assert(
        fc.property(
          fc.integer({min: 0, max: 23}),
          fc.integer({min: 1, max: 28}),
          fc.integer({min: 0, max: 59}),
          (hour, day, minute) => {
            var date = new Date(2024, 0, day, hour, minute, 0);
            var timestamp = date.getTime();
            var result = basalRateOptimizer.classifyTimeBlock(timestamp);
            
            if (hour >= 18 && hour < 22) {
              return result === 'evening';
            }
            return true; // Don't care about other hours in this test
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should always return one of the four valid time blocks', function() {
      fc.assert(
        fc.property(
          fc.integer({min: 0, max: 23}),
          fc.integer({min: 1, max: 28}),
          fc.integer({min: 0, max: 59}),
          (hour, day, minute) => {
            var date = new Date(2024, 0, day, hour, minute, 0);
            var timestamp = date.getTime();
            var result = basalRateOptimizer.classifyTimeBlock(timestamp);
            
            var validBlocks = ['overnight', 'morning', 'afternoon', 'evening'];
            return validBlocks.includes(result);
          }
        ),
        { numRuns: 100 }
      );
    });
    
  });
  
  describe('Property 1: Linear Regression Calculation Completeness', function() {
    
    // Feature: basal-rate-optimization, Property 1: Linear Regression Calculation Completeness
    // Validates: Requirements 1.1, 1.2
    
    it('should produce both slope and R² values for any valid glucose readings', function() {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              mills: fc.integer({min: 1704067200000, max: 1735689600000}),
              sgv: fc.integer({min: 40, max: 400}) // Realistic glucose range
            }),
            {minLength: 2, maxLength: 100} // Need at least 2 points for regression
          ).map(function(readings) {
            // Sort by timestamp to ensure chronological order
            return readings.sort(function(a, b) { return a.mills - b.mills; });
          }),
          (glucoseReadings) => {
            var result = basalRateOptimizer.calculateLinearRegression(glucoseReadings);
            
            // Should have slope property
            var hasSlope = result.hasOwnProperty('slope') && typeof result.slope === 'number';
            
            // Should have rSquared property
            var hasRSquared = result.hasOwnProperty('rSquared') && typeof result.rSquared === 'number';
            
            // R² should be between 0 and 1
            var rSquaredInRange = result.rSquared >= 0 && result.rSquared <= 1;
            
            // Slope should be a finite number (not NaN or Infinity)
            var slopeIsFinite = Number.isFinite(result.slope);
            
            return hasSlope && hasRSquared && rSquaredInRange && slopeIsFinite;
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should produce an intercept value for any valid glucose readings', function() {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              mills: fc.integer({min: 1704067200000, max: 1735689600000}),
              sgv: fc.integer({min: 40, max: 400})
            }),
            {minLength: 2, maxLength: 100}
          ).map(function(readings) {
            return readings.sort(function(a, b) { return a.mills - b.mills; });
          }),
          (glucoseReadings) => {
            var result = basalRateOptimizer.calculateLinearRegression(glucoseReadings);
            
            // Should have intercept property
            var hasIntercept = result.hasOwnProperty('intercept') && typeof result.intercept === 'number';
            
            // Intercept should be a finite number
            var interceptIsFinite = Number.isFinite(result.intercept);
            
            return hasIntercept && interceptIsFinite;
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should handle edge case with identical glucose values', function() {
      fc.assert(
        fc.property(
          fc.integer({min: 40, max: 400}), // Single glucose value
          fc.integer({min: 2, max: 20}),   // Number of readings
          fc.integer({min: 1704067200000, max: 1735689600000}), // Start time
          (glucoseValue, numReadings, startTime) => {
            // Create readings with identical glucose values
            var readings = [];
            for (var i = 0; i < numReadings; i++) {
              readings.push({
                mills: startTime + i * 5 * 60 * 1000, // 5-minute intervals
                sgv: glucoseValue
              });
            }
            
            var result = basalRateOptimizer.calculateLinearRegression(readings);
            
            // Slope should be 0 (no change)
            var slopeIsZero = Math.abs(result.slope) < 0.001;
            
            // R² should be 1 (perfect fit to horizontal line)
            var rSquaredIsOne = Math.abs(result.rSquared - 1) < 0.001;
            
            // Intercept should be approximately the glucose value
            var interceptCorrect = Math.abs(result.intercept - glucoseValue) < 0.001;
            
            return slopeIsZero && rSquaredIsOne && interceptCorrect;
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should handle edge case with only 2 data points', function() {
      fc.assert(
        fc.property(
          fc.integer({min: 1704067200000, max: 1735689600000}), // Start time
          fc.integer({min: 40, max: 400}),  // First glucose value
          fc.integer({min: 40, max: 400}),  // Second glucose value
          fc.integer({min: 1, max: 24}),    // Hours between readings
          (startTime, sgv1, sgv2, hoursDiff) => {
            var readings = [
              {mills: startTime, sgv: sgv1},
              {mills: startTime + hoursDiff * 60 * 60 * 1000, sgv: sgv2}
            ];
            
            var result = basalRateOptimizer.calculateLinearRegression(readings);
            
            // R² should be 1 (2 points always make a perfect line)
            var rSquaredIsOne = Math.abs(result.rSquared - 1) < 0.001;
            
            // Slope should match expected slope
            var expectedSlope = (sgv2 - sgv1) / hoursDiff;
            var slopeCorrect = Math.abs(result.slope - expectedSlope) < 0.001;
            
            return rSquaredIsOne && slopeCorrect;
          }
        ),
        { numRuns: 100 }
      );
    });
    
  });
  
  describe('Property 5: Time Block Grouping', function() {
    
    // Feature: basal-rate-optimization, Property 5: Time Block Grouping
    // Validates: Requirements 2.5
    
    it('should place each period in exactly one time block group', function() {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              startTime: fc.integer({min: 1704067200000, max: 1735689600000}), // 2024 timestamps
              endTime: fc.integer({min: 1704067200000, max: 1735689600000})
            }),
            {minLength: 1, maxLength: 20}
          ),
          (periods) => {
            var groups = basalRateOptimizer.groupByTimeOfDay(periods);
            
            // Count total periods in all groups
            var totalInGroups = groups.overnight.length + groups.morning.length + 
                               groups.afternoon.length + groups.evening.length;
            
            // Should equal original period count
            return totalInGroups === periods.length;
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should group periods according to their start time classification', function() {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              startTime: fc.integer({min: 1704067200000, max: 1735689600000}),
              endTime: fc.integer({min: 1704067200000, max: 1735689600000})
            }),
            {minLength: 1, maxLength: 20}
          ),
          (periods) => {
            var groups = basalRateOptimizer.groupByTimeOfDay(periods);
            
            // Check each group contains only periods with matching time block
            var allCorrect = true;
            
            ['overnight', 'morning', 'afternoon', 'evening'].forEach(function(timeBlock) {
              groups[timeBlock].forEach(function(period) {
                var expectedBlock = basalRateOptimizer.classifyTimeBlock(period.startTime);
                if (expectedBlock !== timeBlock) {
                  allCorrect = false;
                }
              });
            });
            
            return allCorrect;
          }
        ),
        { numRuns: 100 }
      );
    });
    
  });
  
  describe('Profile Data Integration', function() {
    
    describe('readProfileData', function() {
      
      it('should return defaults with warnings when profile is null', function() {
        var result = basalRateOptimizer.readProfileData(null);
        
        result.should.have.property('basalSchedule');
        result.should.have.property('isf');
        result.should.have.property('warnings');
        
        result.basalSchedule.should.be.an.Array();
        result.basalSchedule.length.should.be.above(0);
        result.basalSchedule[0].should.have.property('time', '00:00');
        result.basalSchedule[0].should.have.property('value', 1.0);
        
        result.isf.should.equal(50);
        result.warnings.length.should.be.above(0);
        result.warnings[0].should.containEql('No profile data available');
      });
      
      it('should return defaults with warnings when profile is undefined', function() {
        var result = basalRateOptimizer.readProfileData(undefined);
        
        result.should.have.property('basalSchedule');
        result.should.have.property('isf');
        result.should.have.property('warnings');
        
        result.isf.should.equal(50);
        result.warnings.length.should.be.above(0);
      });
      
      it('should read ISF from profile with getSensitivity method', function() {
        var mockProfile = {
          getSensitivity: function(time) {
            return 40; // ISF of 40 mg/dL per unit
          },
          getBasal: function(time) {
            return 1.0;
          }
        };
        
        var result = basalRateOptimizer.readProfileData(mockProfile);
        
        result.isf.should.equal(40);
        result.warnings.length.should.equal(0);
      });
      
      it('should use default ISF when getSensitivity returns invalid value', function() {
        var mockProfile = {
          getSensitivity: function(time) {
            return null;
          },
          getBasal: function(time) {
            return 1.0;
          }
        };
        
        var result = basalRateOptimizer.readProfileData(mockProfile);
        
        result.isf.should.equal(50);
        result.warnings.length.should.be.above(0);
        result.warnings.some(function(w) { return w.includes('ISF'); }).should.be.true();
      });
      
      it('should read basal schedule from profile with getBasal method', function() {
        var mockProfile = {
          getSensitivity: function(time) {
            return 50;
          },
          getBasal: function(time) {
            // Simple flat basal rate
            return 0.8;
          }
        };
        
        var result = basalRateOptimizer.readProfileData(mockProfile);
        
        result.basalSchedule.should.be.an.Array();
        result.basalSchedule.length.should.be.above(0);
        result.basalSchedule[0].should.have.property('time', '00:00');
        result.basalSchedule[0].should.have.property('value', 0.8);
      });
      
      it('should detect basal rate changes throughout the day', function() {
        var mockProfile = {
          getSensitivity: function(time) {
            return 50;
          },
          getBasal: function(time) {
            var moment = require('moment');
            var hour = moment(time).hour();
            
            // Different rates for different times
            if (hour < 6) return 0.5;  // Overnight
            if (hour < 12) return 0.8; // Morning
            if (hour < 18) return 0.7; // Afternoon
            return 0.6;                // Evening
          }
        };
        
        var result = basalRateOptimizer.readProfileData(mockProfile);
        
        result.basalSchedule.should.be.an.Array();
        result.basalSchedule.length.should.be.above(1); // Should have multiple segments
        
        // Check that we captured the rate changes
        var rates = result.basalSchedule.map(function(s) { return s.value; });
        rates.should.containEql(0.5);
        rates.should.containEql(0.8);
        rates.should.containEql(0.7);
        rates.should.containEql(0.6);
      });
      
      it('should use default basal when getBasal is not available', function() {
        var mockProfile = {
          getSensitivity: function(time) {
            return 50;
          }
          // No getBasal method
        };
        
        var result = basalRateOptimizer.readProfileData(mockProfile);
        
        result.basalSchedule.should.be.an.Array();
        result.basalSchedule[0].should.have.property('value', 1.0);
        result.warnings.length.should.be.above(0);
        result.warnings.some(function(w) { return w.includes('basal'); }).should.be.true();
      });
      
      it('should handle errors gracefully when profile methods throw', function() {
        var mockProfile = {
          getSensitivity: function(time) {
            throw new Error('Profile error');
          },
          getBasal: function(time) {
            throw new Error('Profile error');
          }
        };
        
        var result = basalRateOptimizer.readProfileData(mockProfile);
        
        // Should return defaults with warnings
        result.isf.should.equal(50);
        result.basalSchedule[0].should.have.property('value', 1.0);
        result.warnings.length.should.be.above(0);
      });
      
    });
    
    describe('getCurrentBasalRate', function() {
      
      it('should return default rate when profileData is null', function() {
        var rate = basalRateOptimizer.getCurrentBasalRate('morning', null);
        rate.should.equal(1.0);
      });
      
      it('should return default rate when profileData is undefined', function() {
        var rate = basalRateOptimizer.getCurrentBasalRate('morning', undefined);
        rate.should.equal(1.0);
      });
      
      it('should return default rate when basalSchedule is missing', function() {
        var profileData = {
          isf: 50
          // No basalSchedule
        };
        
        var rate = basalRateOptimizer.getCurrentBasalRate('morning', profileData);
        rate.should.equal(1.0);
      });
      
      it('should return default rate when basalSchedule is not an array', function() {
        var profileData = {
          isf: 50,
          basalSchedule: 'not an array'
        };
        
        var rate = basalRateOptimizer.getCurrentBasalRate('morning', profileData);
        rate.should.equal(1.0);
      });
      
      it('should return correct rate for overnight time block', function() {
        var profileData = {
          isf: 50,
          basalSchedule: [
            { time: '00:00', value: 0.5 },
            { time: '06:00', value: 0.8 }
          ]
        };
        
        // Overnight uses hour 2 (2 AM), which should use the 00:00 rate
        var rate = basalRateOptimizer.getCurrentBasalRate('overnight', profileData);
        rate.should.equal(0.5);
      });
      
      it('should return correct rate for morning time block', function() {
        var profileData = {
          isf: 50,
          basalSchedule: [
            { time: '00:00', value: 0.5 },
            { time: '06:00', value: 0.8 },
            { time: '12:00', value: 0.7 }
          ]
        };
        
        // Morning uses hour 9 (9 AM), which should use the 06:00 rate
        var rate = basalRateOptimizer.getCurrentBasalRate('morning', profileData);
        rate.should.equal(0.8);
      });
      
      it('should return correct rate for afternoon time block', function() {
        var profileData = {
          isf: 50,
          basalSchedule: [
            { time: '00:00', value: 0.5 },
            { time: '06:00', value: 0.8 },
            { time: '12:00', value: 0.7 },
            { time: '18:00', value: 0.6 }
          ]
        };
        
        // Afternoon uses hour 15 (3 PM), which should use the 12:00 rate
        var rate = basalRateOptimizer.getCurrentBasalRate('afternoon', profileData);
        rate.should.equal(0.7);
      });
      
      it('should return correct rate for evening time block', function() {
        var profileData = {
          isf: 50,
          basalSchedule: [
            { time: '00:00', value: 0.5 },
            { time: '06:00', value: 0.8 },
            { time: '12:00', value: 0.7 },
            { time: '18:00', value: 0.6 }
          ]
        };
        
        // Evening uses hour 20 (8 PM), which should use the 18:00 rate
        var rate = basalRateOptimizer.getCurrentBasalRate('evening', profileData);
        rate.should.equal(0.6);
      });
      
      it('should handle multiple segments within a time block', function() {
        var profileData = {
          isf: 50,
          basalSchedule: [
            { time: '00:00', value: 0.5 },
            { time: '03:00', value: 0.6 },  // Change during overnight
            { time: '06:00', value: 0.8 }
          ]
        };
        
        // Overnight uses hour 2 (2 AM), which should use the 00:00 rate
        // (not the 03:00 rate, since 2 AM comes before 3 AM)
        var rate = basalRateOptimizer.getCurrentBasalRate('overnight', profileData);
        rate.should.equal(0.5);
      });
      
      it('should return default rate for invalid time block', function() {
        var profileData = {
          isf: 50,
          basalSchedule: [
            { time: '00:00', value: 0.8 }
          ]
        };
        
        var rate = basalRateOptimizer.getCurrentBasalRate('invalid_block', profileData);
        rate.should.equal(1.0);
      });
      
      it('should handle single flat basal rate', function() {
        var profileData = {
          isf: 50,
          basalSchedule: [
            { time: '00:00', value: 0.9 }
          ]
        };
        
        // All time blocks should return the same rate
        basalRateOptimizer.getCurrentBasalRate('overnight', profileData).should.equal(0.9);
        basalRateOptimizer.getCurrentBasalRate('morning', profileData).should.equal(0.9);
        basalRateOptimizer.getCurrentBasalRate('afternoon', profileData).should.equal(0.9);
        basalRateOptimizer.getCurrentBasalRate('evening', profileData).should.equal(0.9);
      });
      
    });
    
    describe('getISF', function() {
      
      it('should return default ISF when profileData is null', function() {
        var isf = basalRateOptimizer.getISF(null);
        isf.should.equal(50);
      });
      
      it('should return default ISF when profileData is undefined', function() {
        var isf = basalRateOptimizer.getISF(undefined);
        isf.should.equal(50);
      });
      
      it('should return default ISF when isf property is missing', function() {
        var profileData = {
          basalSchedule: []
        };
        
        var isf = basalRateOptimizer.getISF(profileData);
        isf.should.equal(50);
      });
      
      it('should return default ISF when isf is not a number', function() {
        var profileData = {
          isf: 'not a number'
        };
        
        var isf = basalRateOptimizer.getISF(profileData);
        isf.should.equal(50);
      });
      
      it('should return default ISF when isf is zero', function() {
        var profileData = {
          isf: 0
        };
        
        var isf = basalRateOptimizer.getISF(profileData);
        isf.should.equal(50);
      });
      
      it('should return default ISF when isf is negative', function() {
        var profileData = {
          isf: -10
        };
        
        var isf = basalRateOptimizer.getISF(profileData);
        isf.should.equal(50);
      });
      
      it('should return ISF from profileData when valid', function() {
        var profileData = {
          isf: 40
        };
        
        var isf = basalRateOptimizer.getISF(profileData);
        isf.should.equal(40);
      });
      
      it('should handle various valid ISF values', function() {
        [20, 30, 40, 50, 60, 80, 100].forEach(function(expectedISF) {
          var profileData = { isf: expectedISF };
          var isf = basalRateOptimizer.getISF(profileData);
          isf.should.equal(expectedISF);
        });
      });
      
    });
    
  });
  
});

  describe('UI Formatter Functions', function() {
    
    describe('getConfidenceColor', function() {
      
      it('should return green for high confidence (>= 70)', function() {
        basalRateOptimizer.getConfidenceColor(70).should.equal('green');
        basalRateOptimizer.getConfidenceColor(85).should.equal('green');
        basalRateOptimizer.getConfidenceColor(100).should.equal('green');
      });
      
      it('should return yellow for medium confidence (>= 50 and < 70)', function() {
        basalRateOptimizer.getConfidenceColor(50).should.equal('yellow');
        basalRateOptimizer.getConfidenceColor(60).should.equal('yellow');
        basalRateOptimizer.getConfidenceColor(69).should.equal('yellow');
      });
      
      it('should return red for low confidence (< 50)', function() {
        basalRateOptimizer.getConfidenceColor(0).should.equal('red');
        basalRateOptimizer.getConfidenceColor(25).should.equal('red');
        basalRateOptimizer.getConfidenceColor(49).should.equal('red');
      });
      
      it('should return red for invalid input', function() {
        basalRateOptimizer.getConfidenceColor(null).should.equal('red');
        basalRateOptimizer.getConfidenceColor(undefined).should.equal('red');
        basalRateOptimizer.getConfidenceColor('invalid').should.equal('red');
      });
      
    });
    
    describe('formatSupportingData', function() {
      
      it('should format supporting data into HTML table', function() {
        var supportingData = [
          { date: '2024-01-15', slope: 8.5, duration: 6.2, cv: 12.3 },
          { date: '2024-01-16', slope: 7.8, duration: 5.8, cv: 14.1 }
        ];
        
        var html = basalRateOptimizer.formatSupportingData(supportingData);
        
        html.should.containEql('<table');
        html.should.containEql('2024-01-15');
        html.should.containEql('8.50');
        html.should.containEql('6.2');
        html.should.containEql('12.3');
        html.should.containEql('2024-01-16');
        html.should.containEql('7.80');
      });
      
      it('should handle empty supporting data', function() {
        var html = basalRateOptimizer.formatSupportingData([]);
        html.should.containEql('No supporting data available');
      });
      
      it('should handle null supporting data', function() {
        var html = basalRateOptimizer.formatSupportingData(null);
        html.should.containEql('No supporting data available');
      });
      
      it('should handle missing fields in data', function() {
        var supportingData = [
          { date: '2024-01-15' } // Missing slope, duration, cv
        ];
        
        var html = basalRateOptimizer.formatSupportingData(supportingData);
        html.should.containEql('2024-01-15');
        html.should.containEql('N/A');
      });
      
    });
    
    describe('generateTimeBlockHTML', function() {
      
      it('should generate HTML for a time block recommendation', function() {
        var recommendation = {
          timeBlockLabel: 'Morning (6 AM - 12 PM)',
          confidenceScore: 75,
          confidenceLevel: 'high',
          currentBasalRate: 1.0,
          adjustment: 0.1,
          newBasalRate: 1.1,
          recommendation: 'INCREASE by 0.10 U/hr',
          reasoning: {
            avgSlope: 8.5,
            avgCV: 12.3,
            qualifyingPeriods: 3,
            totalPeriods: 5,
            trendDirection: 'rising'
          },
          supportingData: [
            { date: '2024-01-15', slope: 8.5, duration: 6.2, cv: 12.3 }
          ]
        };
        
        var html = basalRateOptimizer.generateTimeBlockHTML(recommendation);
        
        html.should.containEql('Morning (6 AM - 12 PM)');
        html.should.containEql('HIGH CONFIDENCE');
        html.should.containEql('1.00 U/hr');
        html.should.containEql('+0.10 U/hr');
        html.should.containEql('1.10 U/hr');
        html.should.containEql('INCREASE by 0.10 U/hr');
        html.should.containEql('confidence-green');
      });
      
      it('should handle recommendation with no adjustment', function() {
        var recommendation = {
          timeBlockLabel: 'Afternoon (12 PM - 6 PM)',
          confidenceScore: 80,
          confidenceLevel: 'high',
          currentBasalRate: 1.0,
          adjustment: 0,
          newBasalRate: 1.0,
          recommendation: 'NO CHANGE'
        };
        
        var html = basalRateOptimizer.generateTimeBlockHTML(recommendation);
        
        html.should.containEql('NO CHANGE');
        html.should.not.containEql('Adjustment:');
      });
      
      it('should handle null recommendation', function() {
        var html = basalRateOptimizer.generateTimeBlockHTML(null);
        html.should.equal('');
      });
      
    });
    
    describe('generateRecommendationsHTML', function() {
      
      it('should generate complete HTML with all sections', function() {
        var recommendations = {
          overnight: {
            timeBlockLabel: 'Overnight (10 PM - 6 AM)',
            confidenceScore: 75,
            confidenceLevel: 'high',
            currentBasalRate: 1.0,
            adjustment: 0.1,
            newBasalRate: 1.1,
            recommendation: 'INCREASE by 0.10 U/hr',
            reasoning: {
              avgSlope: 8.5,
              avgCV: 12.3,
              qualifyingPeriods: 3,
              totalPeriods: 5,
              trendDirection: 'rising'
            },
            supportingData: []
          }
        };
        
        var metadata = {
          periodCount: 20,
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          analysisDate: '2024-02-01 10:00'
        };
        
        var html = basalRateOptimizer.generateRecommendationsHTML(recommendations, metadata);
        
        // Check for title
        html.should.containEql('Basal Rate Optimization Recommendations');
        
        // Check for medical disclaimer (Requirement 8.2)
        html.should.containEql('IMPORTANT MEDICAL DISCLAIMER');
        html.should.containEql('NOT medical advice');
        html.should.containEql('consult with your healthcare provider');
        
        // Check for analysis summary (Requirement 8.4)
        html.should.containEql('Analysis Summary');
        html.should.containEql('20');
        html.should.containEql('2024-01-01');
        html.should.containEql('2024-01-31');
        
        // Check for safety tips (Requirement 8.6)
        html.should.containEql('Safety Tips');
        html.should.containEql('Test one time period at a time');
        html.should.containEql('Wait 2-3 days between adjustments');
        html.should.containEql('Monitor for hypoglycemia');
      });
      
      it('should handle null recommendations', function() {
        var html = basalRateOptimizer.generateRecommendationsHTML(null, null);
        html.should.containEql('No recommendations available');
      });
      
      it('should include all time blocks', function() {
        var recommendations = {
          overnight: { timeBlockLabel: 'Overnight', confidenceScore: 70, confidenceLevel: 'high', currentBasalRate: 1.0, adjustment: 0, newBasalRate: 1.0, recommendation: 'NO CHANGE' },
          morning: { timeBlockLabel: 'Morning', confidenceScore: 60, confidenceLevel: 'medium', currentBasalRate: 1.0, adjustment: 0, newBasalRate: 1.0, recommendation: 'NO CHANGE' },
          afternoon: { timeBlockLabel: 'Afternoon', confidenceScore: 50, confidenceLevel: 'medium', currentBasalRate: 1.0, adjustment: 0, newBasalRate: 1.0, recommendation: 'NO CHANGE' },
          evening: { timeBlockLabel: 'Evening', confidenceScore: 40, confidenceLevel: 'low', currentBasalRate: 1.0, adjustment: 0, newBasalRate: 1.0, recommendation: 'NO CHANGE' }
        };
        
        var metadata = {
          periodCount: 10,
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          analysisDate: '2024-02-01'
        };
        
        var html = basalRateOptimizer.generateRecommendationsHTML(recommendations, metadata);
        
        html.should.containEql('Overnight');
        html.should.containEql('Morning');
        html.should.containEql('Afternoon');
        html.should.containEql('Evening');
      });
      
    });
    
  });
  
  describe('Export Functionality', function() {
    
    describe('exportToCSV', function() {
      
      it('should return error message when recommendations are null', function() {
        var csv = basalRateOptimizer.exportToCSV(null, null);
        csv.should.containEql('Error');
        csv.should.containEql('No recommendations available');
      });
      
      it('should return error message when metadata is null', function() {
        var csv = basalRateOptimizer.exportToCSV({}, null);
        csv.should.containEql('Error');
        csv.should.containEql('No recommendations available');
      });
      
      it('should include medical disclaimer (Requirement 9.3)', function() {
        var recommendations = {
          overnight: {
            timeBlockLabel: 'Overnight (10 PM - 6 AM)',
            currentBasalRate: 1.0,
            adjustment: 0.05,
            newBasalRate: 1.05,
            confidenceScore: 75,
            confidenceLevel: 'high',
            recommendation: 'INCREASE by 0.05 U/hr',
            reasoning: {
              avgSlope: 10.5,
              avgCV: 15.2,
              qualifyingPeriods: 3,
              totalPeriods: 4,
              trendDirection: 'rising'
            },
            supportingData: [],
            warnings: []
          }
        };
        
        var metadata = {
          periodCount: 10,
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          analysisDate: '2024-02-01 10:00'
        };
        
        var csv = basalRateOptimizer.exportToCSV(recommendations, metadata);
        
        // Requirement 9.3: Medical disclaimer must be present
        csv.should.containEql('IMPORTANT MEDICAL DISCLAIMER');
        csv.should.containEql('NOT medical advice');
        csv.should.containEql('consult with your healthcare provider');
      });
      
      it('should include analysis metadata (Requirement 9.4)', function() {
        var recommendations = {
          overnight: {
            timeBlockLabel: 'Overnight (10 PM - 6 AM)',
            currentBasalRate: 1.0,
            adjustment: 0,
            newBasalRate: 1.0,
            confidenceScore: 50,
            confidenceLevel: 'medium',
            recommendation: 'NO CHANGE',
            reasoning: {
              avgSlope: 2.0,
              avgCV: 20.0,
              qualifyingPeriods: 2,
              totalPeriods: 3,
              trendDirection: 'stable'
            },
            supportingData: [],
            warnings: []
          }
        };
        
        var metadata = {
          periodCount: 15,
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          analysisDate: '2024-02-01 10:00'
        };
        
        var csv = basalRateOptimizer.exportToCSV(recommendations, metadata);
        
        // Requirement 9.4: Metadata must be present
        csv.should.containEql('ANALYSIS METADATA');
        csv.should.containEql('Total Fasting Periods Analyzed');
        csv.should.containEql('15');
        csv.should.containEql('Date Range Start');
        csv.should.containEql('2024-01-01');
        csv.should.containEql('Date Range End');
        csv.should.containEql('2024-01-31');
        csv.should.containEql('Analysis Generated');
        csv.should.containEql('2024-02-01 10:00');
      });
      
      it('should include correct column headers (Requirement 9.2)', function() {
        var recommendations = {
          morning: {
            timeBlockLabel: 'Morning (6 AM - 12 PM)',
            currentBasalRate: 1.2,
            adjustment: -0.05,
            newBasalRate: 1.15,
            confidenceScore: 65,
            confidenceLevel: 'medium',
            recommendation: 'DECREASE by 0.05 U/hr',
            reasoning: {
              avgSlope: -8.0,
              avgCV: 18.5,
              qualifyingPeriods: 2,
              totalPeriods: 2,
              trendDirection: 'falling'
            },
            supportingData: [],
            warnings: []
          }
        };
        
        var metadata = {
          periodCount: 5,
          startDate: '2024-01-15',
          endDate: '2024-01-20',
          analysisDate: '2024-01-21 09:00'
        };
        
        var csv = basalRateOptimizer.exportToCSV(recommendations, metadata);
        
        // Requirement 9.2: Column headers must be present
        csv.should.containEql('Time Block');
        csv.should.containEql('Current Rate (U/hr)');
        csv.should.containEql('Adjustment (U/hr)');
        csv.should.containEql('New Rate (U/hr)');
        csv.should.containEql('Confidence Score');
        csv.should.containEql('Confidence Level');
        csv.should.containEql('Recommendation');
        csv.should.containEql('Avg Slope (mg/dL/hr)');
        csv.should.containEql('Avg CV (%)');
        csv.should.containEql('Qualifying Periods');
        csv.should.containEql('Total Periods');
        csv.should.containEql('Trend Direction');
        csv.should.containEql('Warnings');
      });
      
      it('should export recommendation data correctly (Requirement 9.2)', function() {
        var recommendations = {
          afternoon: {
            timeBlockLabel: 'Afternoon (12 PM - 6 PM)',
            currentBasalRate: 0.9,
            adjustment: 0.10,
            newBasalRate: 1.0,
            confidenceScore: 80,
            confidenceLevel: 'high',
            recommendation: 'INCREASE by 0.10 U/hr',
            reasoning: {
              avgSlope: 12.5,
              avgCV: 12.3,
              qualifyingPeriods: 4,
              totalPeriods: 5,
              trendDirection: 'rising'
            },
            supportingData: [
              { date: '2024-01-15', slope: 12.0, duration: 5.5, cv: 11.0 },
              { date: '2024-01-16', slope: 13.0, duration: 6.0, cv: 13.5 }
            ],
            warnings: ['Test warning message']
          }
        };
        
        var metadata = {
          periodCount: 8,
          startDate: '2024-01-10',
          endDate: '2024-01-20',
          analysisDate: '2024-01-21 14:30'
        };
        
        var csv = basalRateOptimizer.exportToCSV(recommendations, metadata);
        
        // Check that recommendation data is present
        csv.should.containEql('Afternoon (12 PM - 6 PM)');
        csv.should.containEql('0.90'); // Current rate
        csv.should.containEql('+0.10'); // Adjustment with sign
        csv.should.containEql('1.00'); // New rate
        csv.should.containEql('80'); // Confidence score
        csv.should.containEql('high'); // Confidence level
        csv.should.containEql('INCREASE by 0.10 U/hr'); // Recommendation
        csv.should.containEql('12.5'); // Avg slope
        csv.should.containEql('12.3'); // Avg CV
        csv.should.containEql('4'); // Qualifying periods
        csv.should.containEql('5'); // Total periods
        csv.should.containEql('rising'); // Trend direction
      });
      
      it('should handle multiple time blocks', function() {
        var recommendations = {
          overnight: {
            timeBlockLabel: 'Overnight (10 PM - 6 AM)',
            currentBasalRate: 1.0,
            adjustment: 0.05,
            newBasalRate: 1.05,
            confidenceScore: 75,
            confidenceLevel: 'high',
            recommendation: 'INCREASE by 0.05 U/hr',
            reasoning: {
              avgSlope: 10.0,
              avgCV: 15.0,
              qualifyingPeriods: 3,
              totalPeriods: 4,
              trendDirection: 'rising'
            },
            supportingData: [],
            warnings: []
          },
          morning: {
            timeBlockLabel: 'Morning (6 AM - 12 PM)',
            currentBasalRate: 1.2,
            adjustment: -0.05,
            newBasalRate: 1.15,
            confidenceScore: 65,
            confidenceLevel: 'medium',
            recommendation: 'DECREASE by 0.05 U/hr',
            reasoning: {
              avgSlope: -8.0,
              avgCV: 18.0,
              qualifyingPeriods: 2,
              totalPeriods: 3,
              trendDirection: 'falling'
            },
            supportingData: [],
            warnings: []
          }
        };
        
        var metadata = {
          periodCount: 10,
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          analysisDate: '2024-02-01 10:00'
        };
        
        var csv = basalRateOptimizer.exportToCSV(recommendations, metadata);
        
        // Both time blocks should be present
        csv.should.containEql('Overnight (10 PM - 6 AM)');
        csv.should.containEql('Morning (6 AM - 12 PM)');
        csv.should.containEql('1.05'); // Overnight new rate
        csv.should.containEql('1.15'); // Morning new rate
      });
      
      it('should include supporting data section', function() {
        var recommendations = {
          evening: {
            timeBlockLabel: 'Evening (6 PM - 10 PM)',
            currentBasalRate: 1.1,
            adjustment: 0,
            newBasalRate: 1.1,
            confidenceScore: 55,
            confidenceLevel: 'medium',
            recommendation: 'NO CHANGE',
            reasoning: {
              avgSlope: 3.0,
              avgCV: 22.0,
              qualifyingPeriods: 2,
              totalPeriods: 2,
              trendDirection: 'stable'
            },
            supportingData: [
              { date: '2024-01-15', slope: 2.5, duration: 4.5, cv: 20.0 },
              { date: '2024-01-17', slope: 3.5, duration: 5.0, cv: 24.0 }
            ],
            warnings: []
          }
        };
        
        var metadata = {
          periodCount: 5,
          startDate: '2024-01-15',
          endDate: '2024-01-20',
          analysisDate: '2024-01-21 18:00'
        };
        
        var csv = basalRateOptimizer.exportToCSV(recommendations, metadata);
        
        // Supporting data section should be present
        csv.should.containEql('SUPPORTING DATA');
        csv.should.containEql('2024-01-15');
        csv.should.containEql('2.5'); // Slope
        csv.should.containEql('4.5'); // Duration
        csv.should.containEql('20'); // CV
        csv.should.containEql('2024-01-17');
        csv.should.containEql('3.5');
        csv.should.containEql('5.0');
        csv.should.containEql('24');
      });
      
      it('should include safety tips section', function() {
        var recommendations = {
          overnight: {
            timeBlockLabel: 'Overnight (10 PM - 6 AM)',
            currentBasalRate: 1.0,
            adjustment: 0,
            newBasalRate: 1.0,
            confidenceScore: 50,
            confidenceLevel: 'medium',
            recommendation: 'NO CHANGE',
            reasoning: {
              avgSlope: 0,
              avgCV: 25.0,
              qualifyingPeriods: 2,
              totalPeriods: 2,
              trendDirection: 'stable'
            },
            supportingData: [],
            warnings: []
          }
        };
        
        var metadata = {
          periodCount: 5,
          startDate: '2024-01-01',
          endDate: '2024-01-10',
          analysisDate: '2024-01-11 08:00'
        };
        
        var csv = basalRateOptimizer.exportToCSV(recommendations, metadata);
        
        // Safety tips should be present
        csv.should.containEql('SAFETY TIPS');
        csv.should.containEql('Test one time period at a time');
        csv.should.containEql('Wait 2-3 days between adjustments');
        csv.should.containEql('Monitor for hypoglycemia');
        csv.should.containEql('Keep detailed notes');
      });
      
      it('should properly escape CSV values with commas', function() {
        var recommendations = {
          overnight: {
            timeBlockLabel: 'Overnight (10 PM - 6 AM)',
            currentBasalRate: 1.0,
            adjustment: 0,
            newBasalRate: 1.0,
            confidenceScore: 50,
            confidenceLevel: 'medium',
            recommendation: 'NO CHANGE - stable, consistent',
            reasoning: {
              avgSlope: 0,
              avgCV: 25.0,
              qualifyingPeriods: 2,
              totalPeriods: 2,
              trendDirection: 'stable'
            },
            supportingData: [],
            warnings: ['Warning: test, with, commas']
          }
        };
        
        var metadata = {
          periodCount: 5,
          startDate: '2024-01-01',
          endDate: '2024-01-10',
          analysisDate: '2024-01-11 08:00'
        };
        
        var csv = basalRateOptimizer.exportToCSV(recommendations, metadata);
        
        // Values with commas should be quoted
        csv.should.containEql('"NO CHANGE - stable, consistent"');
        csv.should.containEql('"Warning: test, with, commas"');
      });
      
      it('should handle negative adjustments with proper sign', function() {
        var recommendations = {
          morning: {
            timeBlockLabel: 'Morning (6 AM - 12 PM)',
            currentBasalRate: 1.5,
            adjustment: -0.15,
            newBasalRate: 1.35,
            confidenceScore: 70,
            confidenceLevel: 'high',
            recommendation: 'DECREASE by 0.15 U/hr',
            reasoning: {
              avgSlope: -15.0,
              avgCV: 14.0,
              qualifyingPeriods: 3,
              totalPeriods: 3,
              trendDirection: 'falling'
            },
            supportingData: [],
            warnings: []
          }
        };
        
        var metadata = {
          periodCount: 5,
          startDate: '2024-01-01',
          endDate: '2024-01-10',
          analysisDate: '2024-01-11 08:00'
        };
        
        var csv = basalRateOptimizer.exportToCSV(recommendations, metadata);
        
        // Negative adjustment should have minus sign (no plus sign)
        csv.should.containEql('-0.15');
        csv.should.not.containEql('+-0.15');
      });
      
      it('should handle missing reasoning data gracefully', function() {
        var recommendations = {
          afternoon: {
            timeBlockLabel: 'Afternoon (12 PM - 6 PM)',
            currentBasalRate: 1.0,
            adjustment: 0,
            newBasalRate: 1.0,
            confidenceScore: 0,
            confidenceLevel: 'low',
            recommendation: 'NO CHANGE - Need more data',
            // No reasoning object
            supportingData: [],
            warnings: []
          }
        };
        
        var metadata = {
          periodCount: 1,
          startDate: '2024-01-01',
          endDate: '2024-01-01',
          analysisDate: '2024-01-02 12:00'
        };
        
        var csv = basalRateOptimizer.exportToCSV(recommendations, metadata);
        
        // Should handle missing reasoning with N/A
        csv.should.containEql('N/A');
        csv.should.containEql('NO CHANGE - Need more data');
      });
      
      it('should format warnings by removing emojis', function() {
        var recommendations = {
          overnight: {
            timeBlockLabel: 'Overnight (10 PM - 6 AM)',
            currentBasalRate: 1.0,
            adjustment: 0.05,
            newBasalRate: 1.05,
            confidenceScore: 60,
            confidenceLevel: 'medium',
            recommendation: 'INCREASE by 0.05 U/hr',
            reasoning: {
              avgSlope: 10.0,
              avgCV: 20.0,
              qualifyingPeriods: 2,
              totalPeriods: 2,
              trendDirection: 'rising'
            },
            supportingData: [],
            warnings: [
              '⚠️ WARNING: Test warning with emoji',
              '📊 Insufficient data: Need more periods',
              '⚙️ Profile Warning: Using defaults'
            ]
          }
        };
        
        var metadata = {
          periodCount: 5,
          startDate: '2024-01-01',
          endDate: '2024-01-10',
          analysisDate: '2024-01-11 08:00'
        };
        
        var csv = basalRateOptimizer.exportToCSV(recommendations, metadata);
        
        // Warnings should be present but without emojis
        csv.should.containEql('WARNING: Test warning with emoji');
        csv.should.containEql('Insufficient data: Need more periods');
        csv.should.containEql('Profile Warning: Using defaults');
        // Emojis should be removed
        csv.should.not.containEql('⚠️');
        csv.should.not.containEql('📊');
        csv.should.not.containEql('⚙️');
      });
      
    });
    
  });
  
});
