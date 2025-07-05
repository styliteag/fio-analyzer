const { chromium } = require('playwright');

async function testFIOAnalyzer() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    console.log('🌐 Opening FIO Analyzer...');
    await page.goto('http://localhost:5173');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    console.log('✅ Page loaded successfully');
    
    // Check if login form is present
    const loginForm = await page.locator('form').first();
    if (await loginForm.isVisible()) {
      console.log('🔐 Login form found, attempting login...');
      
      // Fill in login credentials
      await page.fill('input[name="username"], input[type="text"]', 'admin');
      await page.fill('input[name="password"], input[type="password"]', 'admin');
      
      // Submit the form
      await page.click('button[type="submit"], button:has-text("Login")');
      
      // Wait for login to complete
      await page.waitForLoadState('networkidle');
      console.log('✅ Login completed');
    }
    
    // Take a screenshot
    await page.screenshot({ path: 'fio-analyzer-test.png' });
    console.log('📸 Screenshot saved as fio-analyzer-test.png');
    
    // Wait a bit to see the app
    await page.waitForTimeout(5000);
    
    console.log('🎉 Browser test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during testing:', error.message);
    await page.screenshot({ path: 'error-screenshot.png' });
  } finally {
    await browser.close();
  }
}

testFIOAnalyzer(); 