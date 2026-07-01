# Image2HTML Site Harness Report

## Summary

- HTML: tests/brand-site/index.html
- Pages checked: 10
- Responsive checks: 12
- Interactions checked: 6
- Average similarity: 0.9315
- Target score: 0.9
- Result: PASS

## Pages

- home: PASS similarity=0.920655 route=#/ screenshot=tests/brand-site/report/pages/home/rendered.png
- about: PASS similarity=0.91489 route=#/about screenshot=tests/brand-site/report/pages/about/rendered.png
- services: PASS similarity=0.923881 route=#/services screenshot=tests/brand-site/report/pages/services/rendered.png
- portfolio: PASS similarity=0.934523 route=#/portfolio screenshot=tests/brand-site/report/pages/portfolio/rendered.png
- blog: PASS similarity=0.93532 route=#/blog screenshot=tests/brand-site/report/pages/blog/rendered.png
- article: PASS similarity=0.924052 route=#/article/designing-better-user-experiences screenshot=tests/brand-site/report/pages/article/rendered.png
- contact: PASS similarity=0.930835 route=#/contact screenshot=tests/brand-site/report/pages/contact/rendered.png
- pricing: PASS similarity=0.920209 route=#/pricing screenshot=tests/brand-site/report/pages/pricing/rendered.png
- faq: PASS similarity=0.948238 route=#/faq screenshot=tests/brand-site/report/pages/faq/rendered.png
- not-found: PASS similarity=0.962281 route=#/404 screenshot=tests/brand-site/report/pages/not-found/rendered.png

## Responsive

- #/ 1440x1080: PASS overflowX=false screenshot=tests/brand-site/report/responsive/home-1440x1080.png
- #/portfolio 1440x1080: PASS overflowX=false screenshot=tests/brand-site/report/responsive/portfolio-1440x1080.png
- #/contact 1440x1080: PASS overflowX=false screenshot=tests/brand-site/report/responsive/contact-1440x1080.png
- #/pricing 1440x1080: PASS overflowX=false screenshot=tests/brand-site/report/responsive/pricing-1440x1080.png
- #/ 1024x900: PASS overflowX=false screenshot=tests/brand-site/report/responsive/home-1024x900.png
- #/portfolio 1024x900: PASS overflowX=false screenshot=tests/brand-site/report/responsive/portfolio-1024x900.png
- #/contact 1024x900: PASS overflowX=false screenshot=tests/brand-site/report/responsive/contact-1024x900.png
- #/pricing 1024x900: PASS overflowX=false screenshot=tests/brand-site/report/responsive/pricing-1024x900.png
- #/ 390x844: PASS overflowX=false screenshot=tests/brand-site/report/responsive/home-390x844.png
- #/portfolio 390x844: PASS overflowX=false screenshot=tests/brand-site/report/responsive/portfolio-390x844.png
- #/contact 390x844: PASS overflowX=false screenshot=tests/brand-site/report/responsive/contact-390x844.png
- #/pricing 390x844: PASS overflowX=false screenshot=tests/brand-site/report/responsive/pricing-390x844.png

## Interactions

- nav-to-about: PASS
- portfolio-filter-and-modal: PASS
- faq-accordion: PASS
- pricing-plan-modal: PASS
- contact-form-success: PASS
- not-found-go-home: PASS

## Failures

- Page failures: 0
- Responsive failures: 0
- Interaction failures: 0

## Manual Checks Still Required

- Confirm typography nuance, icon optical alignment, and animation feel against the reference pages.
- Confirm modal copy and dynamic states are product-appropriate, since static screenshots cannot prove all states.
