from playwright.sync_api import sync_playwright
import requests, time

API = "http://localhost:8888/api"
BASE = "http://localhost:5175"

print("=== API: 60 products ===")
r = requests.get(f"{API}/products?limit=100", timeout=10)
data = r.json()
products = data.get("data", [])
print(f"API returns: {len(products)} products (total: {data.get('total')})")

missing = []
for p in products:
    if not p.get("thumbnail") and not p.get("images"):
        missing.append(f"{p['id']}:{p['name'][:30]}")
print(f"Missing images: {len(missing)}")
if missing:
    for m in missing[:5]:
        print(f"  {m}")

print("\n=== Browser: Shop page ===")
with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True)
    page = browser.new_page()
    js_errors = []
    page.on("pageerror", lambda e: js_errors.append(str(e)))

    page.goto(f"{BASE}/shop", wait_until="networkidle", timeout=15000)
    page.wait_for_timeout(3000)

    product_links = page.locator("a[href*='/products/']").count()
    print(f"Product links on shop: {product_links}")
    print(f"JS errors: {len(js_errors)}")

    page.screenshot(path="/tmp/test-60.png", full_page=False)

    # Check pagination
    pages_el = page.locator("[class*='pagination'], [class*='Pagination'], nav[aria-label*='page']").count()
    print(f"Pagination visible: {'Yes' if pages_el > 0 else 'No'}")

    # Navigate to page 2 if exists
    page2_btn = page.locator("button:has-text('2'), a:has-text('2')").first
    if page2_btn.count() > 0:
        page2_btn.click(force=True)
        page.wait_for_timeout(2000)
        page2_links = page.locator("a[href*='/products/']").count()
        print(f"Page 2 products: {page2_links}")

    browser.close()

print("\nDone.")
