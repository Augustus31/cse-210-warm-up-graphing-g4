## Summary 
### Issue
We need an end-to-end testing framework for developing end-to-end tests for our webapp.

### Decision 
We are going to use Playwright for end-to-end tests. 

### Reasoning
Playwright includes everything that we need "out of the box" which makes it easy to use with our app. 


### Considered Alternatives
1. Cypress: Actually a reasonable choice for our use case. However, ended up going with Playwright due to it being able to start our server before tests run and the tests using async/await like our existing test suite does. 
2. Puppeteer: Primarily a browser automation tool and requires seperate depdencies to run as we need. 
3. Selenium: Requires more setup than Playwright.
