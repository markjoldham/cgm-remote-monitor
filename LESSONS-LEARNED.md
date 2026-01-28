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
