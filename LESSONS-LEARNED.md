# Lessons Learned - Global Development Notes

This file tracks important lessons learned during development to avoid repeating mistakes and improve workflow efficiency.

---

## JavaScript Bundle Caching Issues

**Date**: 2026-01-28  
**Severity**: High - Causes confusion and wasted debugging time  
**Occurrences**: Multiple times during fasting detection feature development

### Problem
When making changes to JavaScript source files in a web application:
1. Source code is updated correctly
2. Webpack bundles are rebuilt with new code
3. Code is deployed to server (Heroku)
4. **BUT** browser continues serving old cached JavaScript files
5. Developer sees old behavior and thinks code changes didn't work

### Symptoms
- Console logs show old build numbers/version strings
- New features don't appear in browser
- Bug fixes don't take effect
- Code inspection shows correct source, but runtime behavior is wrong

### Root Causes
1. **Browser caching**: Browsers aggressively cache JavaScript files for performance
2. **Service workers**: Can cache assets even more persistently
3. **CDN caching**: If using a CDN, it may cache old bundles
4. **Heroku build cache**: Sometimes Heroku caches node_modules and build artifacts

### Solutions

#### Immediate Fix (User Side)
**Always do a hard refresh after deploying JavaScript changes:**
- Chrome/Edge (Mac): `Cmd + Shift + R`
- Chrome/Edge (Windows): `Ctrl + Shift + R`
- Firefox (Mac): `Cmd + Shift + R`
- Firefox (Windows): `Ctrl + F5`
- Safari: `Cmd + Option + R`

Or clear browser cache completely for the site.

#### Verification Strategy
**Add build numbers/timestamps to code:**
```javascript
console.log('🔢 BUILD: MODULE-NAME-v2.9 - 2026-01-28-10:15 EST');
```

This makes it immediately obvious which version is running in the browser console.

#### Development Best Practices
1. **Always check build numbers first** when debugging "code not working" issues
2. **Increment version numbers** when making changes to force cache busting
3. **Test in incognito/private mode** to avoid cache issues during development
4. **Document the caching architecture** (browser → CDN → server) for the project

#### Long-term Solutions
1. **Cache busting in production**:
   - Add content hashes to bundle filenames (webpack already does this)
   - Set proper cache headers (short TTL for HTML, long for hashed assets)
   
2. **Service worker management**:
   - Implement proper service worker update logic
   - Clear service worker cache on version changes

3. **Heroku-specific**:
   - Clear build cache if needed: `heroku repo:purge_cache -a app-name`
   - Force rebuild: Make a trivial change and commit

### Prevention Checklist
When deploying JavaScript changes:
- [ ] Increment build number/version in code
- [ ] Rebuild webpack bundles locally to verify
- [ ] Commit and push changes
- [ ] Wait for deployment to complete
- [ ] **Hard refresh browser** (most important!)
- [ ] Check console for new build number
- [ ] Test the actual changes

### Related Files
- `lib/report_plugins/fasting-detection-debug.js` - Contains build number
- `lib/report_plugins/daytoday.js` - Contains build number
- `lib/report_plugins/index.js` - Contains build number
- `package.json` - Contains postinstall script that rebuilds bundles

---

## Parameter Passing and Default Values in JavaScript

**Date**: 2026-01-28  
**Severity**: Medium - Can cause subtle bugs with incorrect data  
**Occurrences**: Once during fasting detection feature development

### Problem
When passing configuration options through multiple layers of function calls:
1. Function A reads correct values from settings
2. Function A passes values to Function B as a parameter object
3. Function B uses fallback logic like `(options && options.targetLow) || defaultValue`
4. **BUT** Function B receives a different `options` object than expected
5. The fallback defaults are used instead of the correct values

### Symptoms
- Values appear correct in one part of the code but wrong in another
- Default/fallback values are used even when correct values are available
- Inconsistent behavior across different function calls
- User sees incorrect data (e.g., "40" instead of "75" for target range)

### Root Causes
1. **Parameter name collision**: Multiple `options` objects in scope with different properties
2. **Overly permissive fallback logic**: Using `||` operator when value might be 0 or falsy
3. **Lack of validation**: Not checking if received values are valid/reasonable
4. **Unclear parameter contracts**: Not documenting what properties are expected in options

### Example from Fasting Detection
```javascript
// In daytoday.js - creates fastingOptions with correct values
var fastingOptions = {
  targetLow: userTargetLow,   // 75 from settings
  targetHigh: userTargetHigh  // 160 from settings
};
fastingDetection.detectFastingPeriods(dayData, nextDayData, fastingOptions);

// In fasting-detection-debug.js - WRONG: uses different options object
function detectFastingPeriods(dayData, nextDayData, options) {
  // This 'options' parameter is fastingOptions, but code was checking
  // a different 'options' object from outer scope!
  var targetLow = (options && options.targetLow) || 70;  // Falls back to 70
}
```

### Solutions

#### Immediate Fix
1. **Use the correct parameter**: Reference the function parameter, not outer scope
2. **Add validation**: Check if values are reasonable before using them
3. **Fail explicitly**: Log warnings when fallback values are used

```javascript
// GOOD: Use parameter directly with validation
function detectFastingPeriods(dayData, nextDayData, options) {
  var targetLow = options.targetLow;
  var targetHigh = options.targetHigh;
  
  if (!targetLow || !targetHigh || targetLow < 40 || targetHigh > 400) {
    console.warn('Invalid target range:', targetLow, '-', targetHigh);
    targetLow = 70;
    targetHigh = 180;
  }
}
```

#### Prevention Strategies
1. **Use unique parameter names**: Avoid generic names like `options` or `config`
2. **Validate early**: Check parameters at function entry
3. **Document contracts**: Use JSDoc to specify expected properties
4. **Use TypeScript**: Type checking would catch this at compile time
5. **Avoid fallback operators**: Be explicit about when defaults should be used

```javascript
/**
 * @param {Object} fastingConfig - Configuration for fasting detection
 * @param {number} fastingConfig.targetLow - Target low in mg/dL (40-200)
 * @param {number} fastingConfig.targetHigh - Target high in mg/dL (100-400)
 */
function detectFastingPeriods(dayData, nextDayData, fastingConfig) {
  if (!fastingConfig || typeof fastingConfig.targetLow !== 'number') {
    throw new Error('fastingConfig.targetLow is required');
  }
  // ... use fastingConfig.targetLow directly
}
```

### Prevention Checklist
When passing configuration through function calls:
- [ ] Use descriptive parameter names (not just "options")
- [ ] Validate parameters at function entry
- [ ] Log warnings when using fallback values
- [ ] Document expected parameter structure
- [ ] Test with edge cases (0, null, undefined, invalid values)
- [ ] Verify the correct object is being referenced in nested scopes

### Related Files
- `lib/report_plugins/fasting-detection-debug.js` - Fixed to use parameter correctly
- `lib/report_plugins/daytoday.js` - Passes fastingOptions with correct values
- `lib/report/reportclient.js` - Defines targetBGdefault from settings

---

## Template for Future Lessons

**Date**: YYYY-MM-DD  
**Severity**: Low/Medium/High  
**Occurrences**: Number of times this issue appeared

### Problem
Brief description of what went wrong

### Symptoms
How to recognize this problem

### Root Causes
Why it happened

### Solutions
How to fix it

### Prevention
How to avoid it in the future

---

*This file should be updated whenever a significant lesson is learned that could benefit future development work.*
