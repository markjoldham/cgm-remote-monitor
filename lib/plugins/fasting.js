'use strict';

var times = require('../times');
var moment = require('moment');

function init(ctx) {
  var translate = ctx.language.translate;
  var levels = ctx.levels;

  var fasting = {
    name: 'fasting',
    label: 'Fasting',
    pluginType: 'pill-minor',
    pillFlip: true
  };

  fasting.getPrefs = function getPrefs(sbx) {
    return {
      warn: sbx.extendedSettings.warn !== undefined ? sbx.extendedSettings.warn : 30,
      urgent: sbx.extendedSettings.urgent !== undefined ? sbx.extendedSettings.urgent : 60,
      enableAlerts: sbx.extendedSettings.enableAlerts || false,
      minDuration: sbx.extendedSettings.minDuration || 3, // hours
      maxDuration: sbx.extendedSettings.maxDuration || 12, // hours
      carbThreshold: sbx.extendedSettings.carbThreshold || 5, // grams
      bolusThreshold: sbx.extendedSettings.bolusThreshold || 0.5 // units
    };
  };

  fasting.setProperties = function setProperties(sbx) {
    var prefs = fasting.getPrefs(sbx);
    var currentTime = sbx.time;
    
    // Get recent treatments (last 12 hours)
    var recentTreatments = sbx.data.treatments.filter(function(treatment) {
      return treatment.mills > (currentTime - times.hours(prefs.maxDuration).msecs);
    }).sort(function(a, b) {
      return b.mills - a.mills; // Most recent first
    });

    // Find the last significant treatment (carbs or significant bolus)
    var lastSignificantTreatment = null;
    for (var i = 0; i < recentTreatments.length; i++) {
      var treatment = recentTreatments[i];
      if ((treatment.carbs && treatment.carbs > prefs.carbThreshold) ||
          (treatment.insulin && treatment.insulin > prefs.bolusThreshold && treatment.carbs)) {
        lastSignificantTreatment = treatment;
        break;
      }
    }

    var fastingInfo = {
      isFasting: false,
      duration: 0,
      quality: 'unknown',
      lastTreatmentTime: null,
      timeSinceLastTreatment: 0
    };

    if (lastSignificantTreatment) {
      fastingInfo.lastTreatmentTime = lastSignificantTreatment.mills;
      fastingInfo.timeSinceLastTreatment = (currentTime - lastSignificantTreatment.mills) / times.hours(1).msecs;
      
      // Consider fasting if it's been more than 2 hours since last significant treatment
      if (fastingInfo.timeSinceLastTreatment >= 2) {
        fastingInfo.isFasting = true;
        fastingInfo.duration = fastingInfo.timeSinceLastTreatment;
        
        // Assess quality based on duration and time of day
        var currentHour = moment(currentTime).hour();
        var isNighttime = currentHour >= 22 || currentHour <= 6;
        
        if (fastingInfo.duration >= 6 && isNighttime) {
          fastingInfo.quality = 'excellent';
        } else if (fastingInfo.duration >= 4) {
          fastingInfo.quality = 'good';
        } else if (fastingInfo.duration >= 3) {
          fastingInfo.quality = 'fair';
        } else {
          fastingInfo.quality = 'poor';
        }
      }
    } else {
      // No recent significant treatments found - likely fasting for a long time
      fastingInfo.isFasting = true;
      fastingInfo.duration = prefs.maxDuration; // Assume max duration
      fastingInfo.quality = 'excellent';
    }

    sbx.offerProperty('fasting', function() {
      return fastingInfo;
    });
  };

  fasting.updateVisualisation = function updateVisualisation(sbx) {
    var info = sbx.properties.fasting;
    var prefs = fasting.getPrefs(sbx);

    if (!info || !info.isFasting) {
      sbx.pluginBase.removePill('fasting');
      return;
    }

    var durationText = info.duration.toFixed(1) + 'h';
    var qualityColor = {
      'excellent': 'green',
      'good': 'blue', 
      'fair': 'orange',
      'poor': 'red',
      'unknown': 'gray'
    }[info.quality] || 'gray';

    var pillText = translate('Fasting') + ' ' + durationText;
    var level = levels.NONE;
    
    // Set level based on quality for visual indication
    if (info.quality === 'excellent' || info.quality === 'good') {
      level = levels.INFO;
    }

    sbx.pluginBase.updatePill('fasting', {
      value: durationText,
      label: translate('FASTING'),
      info: [
        {
          label: translate('Duration'),
          value: durationText
        },
        {
          label: translate('Quality'),
          value: translate(info.quality)
        },
        {
          label: translate('Good for basal testing'),
          value: (info.quality === 'excellent' || info.quality === 'good') ? 
                 translate('Yes') : translate('No')
        }
      ]
    }, 'fasting', level, null, null, qualityColor);
  };

  fasting.checkNotifications = function checkNotifications(sbx) {
    var info = sbx.properties.fasting;
    var prefs = fasting.getPrefs(sbx);

    if (!prefs.enableAlerts || !info || !info.isFasting) {
      return;
    }

    // Notify about excellent fasting periods for basal testing
    if (info.quality === 'excellent' && info.duration >= 6) {
      sbx.notifications.requestNotify({
        level: levels.INFO,
        title: translate('Excellent Fasting Period'),
        message: translate('Current fasting period (%1 hours) is excellent for basal rate testing', info.duration.toFixed(1)),
        eventName: 'fasting-excellent',
        plugin: fasting,
        group: 'Fasting'
      });
    }
  };

  return fasting;
}

module.exports = init;