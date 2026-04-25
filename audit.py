"""
Audit complet du site Flowa — Playwright
Vérifie : visuel, console errors, funnel, SEO, responsive, accessibilité
"""

from playwright.sync_api import sync_playwright
import json, os, time

SITE = "file:///Users/Moad/Desktop/flowa/index.html"
OUT  = "/Users/Moad/Desktop/flowa/audit_results"
os.makedirs(OUT, exist_ok=True)

results = {
    "sections":    [],
    "console":     [],
    "seo":         {},
    "funnel":      [],
    "performance": {},
    "issues":      [],
    "passed":      [],
}

def ok(msg):
    results["passed"].append(msg)
    print(f"  ✅ {msg}")

def issue(msg):
    results["issues"].append(msg)
    print(f"  ⚠️  {msg}")

def section(title):
    print(f"\n{'─'*50}")
    print(f"  {title}")
    print(f"{'─'*50}")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)

    # ═══════════════════════════════════════
    # 1. DESKTOP — Screenshot + Console + SEO
    # ═══════════════════════════════════════
    section("1. Desktop (1440×900)")
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()

    console_msgs = []
    page.on("console", lambda m: console_msgs.append({"type": m.type, "text": m.text}))
    page.on("pageerror", lambda e: console_msgs.append({"type": "pageerror", "text": str(e)}))

    t0 = time.time()
    page.goto(SITE, wait_until="networkidle")
    load_time = round((time.time() - t0) * 1000)
    results["performance"]["load_ms"] = load_time

    page.wait_for_timeout(1000)

    # Screenshot full page
    page.screenshot(path=f"{OUT}/desktop_full.png", full_page=True)
    ok(f"Screenshot desktop sauvegardé")
    print(f"  ℹ️  Temps de chargement : {load_time}ms")

    # ─── SEO checks ───
    section("2. SEO & Meta tags")
    seo = page.evaluate("""() => ({
        title:          document.title,
        description:    document.querySelector('meta[name=description]')?.content || null,
        og_title:       document.querySelector('meta[property="og:title"]')?.content || null,
        og_image:       document.querySelector('meta[property="og:image"]')?.content || null,
        og_url:         document.querySelector('meta[property="og:url"]')?.content || null,
        twitter_card:   document.querySelector('meta[name="twitter:card"]')?.content || null,
        canonical:      document.querySelector('link[rel=canonical]')?.href || null,
        h1_count:       document.querySelectorAll('h1').length,
        h1_text:        document.querySelector('h1')?.textContent?.trim() || null,
        lang:           document.documentElement.lang || null,
        robots:         document.querySelector('meta[name=robots]')?.content || null,
        ga:             typeof gtag !== 'undefined',
        favicon:        !!document.querySelector('link[rel*=icon]'),
        viewport:       document.querySelector('meta[name=viewport]')?.content || null,
    })""")
    results["seo"] = seo

    checks = [
        (seo["title"],          "Title présent",                   "Title manquant ❌"),
        (seo["description"],    "Meta description présente",       "Meta description manquante ❌"),
        (seo["og_title"],       "OG title présent",                "OG title manquant ❌"),
        (seo["og_image"],       "OG image présente",               "OG image manquante ❌"),
        (seo["twitter_card"],   "Twitter Card présente",           "Twitter Card manquante"),
        (seo["h1_count"] == 1, f"1 seul H1 ({seo['h1_text']})",   f"H1 anormal : {seo['h1_count']} trouvés"),
        (seo["lang"],           f"Lang défini : {seo['lang']}",    "Attribut lang manquant"),
        (seo["ga"],             "Google Analytics détecté",        "Google Analytics absent"),
        (seo["favicon"],        "Favicon présent",                 "Favicon manquant"),
        (seo["viewport"],       "Viewport meta présent",           "Viewport meta manquant"),
    ]
    for cond, pass_msg, fail_msg in checks:
        ok(pass_msg) if cond else issue(fail_msg)

    # ─── Sections présentes ───
    section("3. Sections du site")
    sections_check = page.evaluate("""() => {
        const ids = ['hero','solutions','method','cases','contact'];
        return ids.map(id => ({ id, found: !!document.getElementById(id) }));
    }""")
    for s in sections_check:
        results["sections"].append(s)
        if s["found"]: ok(f"Section #{s['id']} présente")
        else: issue(f"Section #{s['id']} INTROUVABLE")

    # ─── Liens légaux ───
    section("4. Liens légaux")
    links = page.evaluate("""() => {
        const all = Array.from(document.querySelectorAll('a'));
        return {
            mentions: all.some(a => a.href.includes('mentions')),
            confidentialite: all.some(a => a.href.includes('confidentialite')),
            external_links: all.filter(a => a.href.startsWith('http') && !a.href.includes('flowa')).length,
        };
    }""")
    ok("Lien mentions légales présent") if links["mentions"] else issue("Lien mentions légales absent")
    ok("Lien confidentialité présent") if links["confidentialite"] else issue("Lien confidentialité absent")
    print(f"  ℹ️  Liens externes : {links['external_links']}")

    # ─── Console errors ───
    section("5. Console JavaScript")
    results["console"] = console_msgs
    errors   = [m for m in console_msgs if m["type"] in ("error", "pageerror")]
    warnings = [m for m in console_msgs if m["type"] == "warning"]
    if not errors: ok("Aucune erreur JavaScript")
    else:
        for e in errors: issue(f"JS Error: {e['text'][:120]}")
    if warnings: print(f"  ℹ️  {len(warnings)} warning(s) JS")

    ctx.close()

    # ═══════════════════════════════════════
    # 2. MOBILE — iPhone 13
    # ═══════════════════════════════════════
    section("6. Mobile (iPhone 13 — 390×844)")
    iphone = browser.new_context(
        viewport={"width": 390, "height": 844},
        device_scale_factor=3,
        user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
        is_mobile=True,
    )
    mob = iphone.new_page()
    mob.goto(SITE, wait_until="networkidle")
    mob.wait_for_timeout(800)
    mob.screenshot(path=f"{OUT}/mobile_full.png", full_page=True)
    ok("Screenshot mobile sauvegardé")

    # Check nav burger menu
    burger = mob.query_selector(".hamburger, .menu-toggle, .nav-toggle, [class*='burger'], [class*='mobile-menu']")
    ok("Menu burger détecté sur mobile") if burger else issue("Pas de menu hamburger détecté sur mobile")

    # Overflow horizontal check
    overflow = mob.evaluate("""() => document.body.scrollWidth > window.innerWidth""")
    issue("Overflow horizontal sur mobile ! (scroll gauche/droite)") if overflow else ok("Pas d'overflow horizontal")

    iphone.close()

    # ═══════════════════════════════════════
    # 3. FUNNEL — Multi-step form
    # ═══════════════════════════════════════
    section("7. Funnel multi-étapes")
    ctx2  = browser.new_context(viewport={"width": 1440, "height": 900})
    page2 = ctx2.new_page()
    page2.goto(SITE, wait_until="networkidle")
    page2.wait_for_timeout(800)

    # Scroll to contact section
    page2.evaluate("document.getElementById('contact')?.scrollIntoView()")
    page2.wait_for_timeout(600)

    # Step 1 — check service options
    step1 = page2.query_selector("#funnelStep1")
    if step1 and step1.is_visible():
        ok("Funnel étape 1 visible")
        cards = page2.query_selector_all("#funnelStep1 .funnel-option")
        print(f"  ℹ️  Options service étape 1 : {len(cards)}")
    else:
        issue("Funnel étape 1 non trouvée")

    # Click first service option → enables #toStep2
    first_opt = page2.query_selector("#funnelStep1 .funnel-option")
    if first_opt:
        first_opt.click()
        page2.wait_for_timeout(400)
        to_step2 = page2.query_selector("#toStep2")
        if to_step2:
            to_step2.click()
            page2.wait_for_timeout(500)
            step2 = page2.query_selector("#funnelStep2")
            if step2 and step2.is_visible():
                ok("Navigation Étape 1 → 2 fonctionne")
            else:
                issue("La navigation vers l'étape 2 ne fonctionne pas")
        else:
            issue("Bouton #toStep2 introuvable")
    else:
        issue("Pas d'option .funnel-option trouvée à l'étape 1")

    # Click first budget option → enables #toStep3
    first_budget = page2.query_selector("#funnelStep2 .funnel-option")
    if first_budget:
        first_budget.click()
        page2.wait_for_timeout(400)
        to_step3 = page2.query_selector("#toStep3")
        if to_step3:
            to_step3.click()
            page2.wait_for_timeout(500)
            step3 = page2.query_selector("#funnelStep3")
            if step3 and step3.is_visible():
                ok("Navigation Étape 2 → 3 fonctionne")
            else:
                issue("La navigation vers l'étape 3 ne fonctionne pas")
        else:
            issue("Bouton #toStep3 introuvable")
    else:
        issue("Pas d'option budget .funnel-option trouvée à l'étape 2")

    # Check form fields in step 3
    fname      = page2.query_selector("#funnelName")
    email      = page2.query_selector("#funnelEmail")
    submit_btn = page2.query_selector("#funnelSubmit")

    ok("Champ nom présent à l'étape 3") if fname else issue("Champ #funnelName introuvable à l'étape 3")
    ok("Champ email présent à l'étape 3") if email else issue("Champ #funnelEmail introuvable à l'étape 3")
    ok("Bouton submit présent à l'étape 3") if submit_btn else issue("Bouton #funnelSubmit introuvable à l'étape 3")

    # Screenshot funnel step 3

    # Screenshot funnel step 3
    page2.screenshot(path=f"{OUT}/funnel_step3.png")

    # Validation test — submit empty form (fields empty → should block)
    if submit_btn and submit_btn.is_visible():
        submit_btn.click()
        page2.wait_for_timeout(500)
        still_step3 = page2.query_selector("#funnelStep3")
        ok("Validation bloque la soumission vide") if (still_step3 and still_step3.is_visible()) else issue("Soumission vide non bloquée")

    ctx2.close()

    # ═══════════════════════════════════════
    # 4. CLICK REDIRECTION — Service cards
    # ═══════════════════════════════════════
    section("8. Clic sur cards → redirection funnel")
    ctx3  = browser.new_context(viewport={"width": 1440, "height": 900})
    page3 = ctx3.new_page()
    page3.goto(SITE, wait_until="networkidle")
    page3.wait_for_timeout(800)

    # Try clicking a service card
    svc_card = page3.query_selector(".service-card")
    if svc_card:
        page3.evaluate("window.scrollTo(0,0)")
        svc_card.click()
        page3.wait_for_timeout(800)
        # Check if contact section is now in view
        in_view = page3.evaluate("""() => {
            const el = document.getElementById('contact');
            if (!el) return false;
            const rect = el.getBoundingClientRect();
            return rect.top < window.innerHeight;
        }""")
        ok("Clic service card → scroll vers funnel") if in_view else issue("Clic service card ne scroll pas vers le funnel")
    else:
        issue("Aucune .service-card trouvée")

    ctx3.close()

    # ═══════════════════════════════════════
    # 5. ACCESSIBILITÉ de base
    # ═══════════════════════════════════════
    section("9. Accessibilité")
    ctx4  = browser.new_context(viewport={"width": 1440, "height": 900})
    page4 = ctx4.new_page()
    page4.goto(SITE, wait_until="networkidle")

    a11y = page4.evaluate("""() => {
        const imgs  = Array.from(document.querySelectorAll('img'));
        const noAlt = imgs.filter(i => !i.getAttribute('alt'));
        const btns  = Array.from(document.querySelectorAll('button'));
        const noLabel = btns.filter(b => !b.textContent.trim() && !b.getAttribute('aria-label'));
        const inputs  = Array.from(document.querySelectorAll('input, textarea'));
        const noLabelInput = inputs.filter(i => {
            if (i.getAttribute('aria-hidden') === 'true') return false; // honeypot fields
            if (i.type === 'hidden') return false;
            const id = i.id;
            return !document.querySelector('label[for="'+id+'"]') && !i.getAttribute('aria-label') && !i.getAttribute('placeholder');
        });
        return {
            imgs_total:    imgs.length,
            imgs_no_alt:   noAlt.length,
            btns_no_label: noLabel.length,
            inputs_no_label: noLabelInput.length,
            color_contrast: 'manual check needed',
        };
    }""")
    results["a11y"] = a11y

    ok(f"Images : {a11y['imgs_total']} total, {a11y['imgs_no_alt']} sans alt") if a11y["imgs_no_alt"] == 0 else issue(f"{a11y['imgs_no_alt']} image(s) sans attribut alt")
    ok("Tous les boutons ont un label") if a11y["btns_no_label"] == 0 else issue(f"{a11y['btns_no_label']} bouton(s) sans label accessible")
    ok("Tous les inputs ont un label/placeholder") if a11y["inputs_no_label"] == 0 else issue(f"{a11y['inputs_no_label']} input(s) sans label")

    ctx4.close()
    browser.close()

# ═══════════════════════════════════════
# RAPPORT FINAL
# ═══════════════════════════════════════
section("RAPPORT FINAL")
total_ok    = len(results["passed"])
total_issues = len(results["issues"])
total       = total_ok + total_issues
score       = round((total_ok / total) * 100) if total > 0 else 0

print(f"\n  Score global : {score}/100 ({total_ok}/{total} vérifications passées)")
print(f"\n  ✅ Réussites ({total_ok}) :")
for p in results["passed"]: print(f"     • {p}")
print(f"\n  ⚠️  Problèmes ({total_issues}) :")
for i in results["issues"]: print(f"     • {i}")

print(f"\n  📸 Screenshots enregistrés dans : {OUT}/")
print(f"     • desktop_full.png")
print(f"     • mobile_full.png")
print(f"     • funnel_step3.png")

# Save JSON
with open(f"{OUT}/audit_report.json", "w") as f:
    json.dump(results, f, ensure_ascii=False, indent=2)
print(f"  📄 Rapport JSON : {OUT}/audit_report.json")
