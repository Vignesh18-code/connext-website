from pathlib import Path
# -*- coding: utf-8 -*-
"""Generates the section markup that gets spliced into index.html.

The copy, ordering and asset names all come from the reference site; keeping
it in one generator means the repetitive blocks (services, partners, FAQ)
stay consistent rather than being hand-maintained twelve times over.
"""
import os, html, io

IMG = '/assets/websiteimages'

def esc(s): return html.escape(s, quote=False)

def br(s):
    return '<br />'.join(esc(p) for p in s.split('\n'))

# ---------------------------------------------------------------- data ------
# Our services (desktop panel + mobile list): title, icon (under 05/06/07 art), copy, status, available?
SERVICES = [
    ("ON-DEMAND\nDELIVERIES", "06-service-icons/domestic-interstate-transport.png",
     "Need goods moved today? Book suitable transport when you need it and review the fare before confirming.",
     "Available now · 01", True),
    ("DEDICATED\nTRANSPORT", "06-service-icons/project-cargo.png",
     "For consignments that need exclusive space, reserve the whole vehicle for your trip.",
     "Available now · 02", True),
    ("SCHEDULED\nFREIGHT", "07-why-icons/why-2.png",
     "Future fixed-route freight options for businesses planning regular market and stock movements.",
     "Coming soon · 03", False),
    ("SHARED\nFREIGHT", "06-service-icons/warehousing-3pl.png",
     "Share suitable cargo capacity with compatible consignments and book the space your goods need.",
     "Coming soon · 04", False),
]

# How Connext works — the three cards the overhead truck drives past.
# (title, icon, copy, invert?) — the 05/07 icon sets are drawn white, so they are
# inverted on the light road; the features set is already dark.
STEPS = [
    ("TELL US\nWHAT'S MOVING", "06-service-icons/features-desktop/feature-1.png",
     "Add your goods, pickup address, destination and requested pickup details.", False),
    ("SEE PRICE.\nCONFIRM.", "07-why-icons/why-4.png",
     "Choose an available vehicle, review the fare and confirm your booking.", True),
    ("HAND OVER\n& FOLLOW", "07-why-icons/why-2.png",
     "Complete pickup verification and follow trip updates through the app.", True),
]

# Why Connext — where the truck parks at the end of the road.
WHY_CONNEXT = [
    ("UPFRONT\nFARE REVIEW", "07-why-icons/why-4.png",
     "Check your booking price before you confirm.", True),
    ("SUITABLE TRANSPORT\nCHOICES", "06-service-icons/project-cargo.png",
     "Choose from the cargo vehicles available for your load.", True),
    ("TRIP\nUPDATES", "06-service-icons/features-desktop/feature-1.png",
     "Follow your booked delivery through the customer app.", False),
]

WHY = [
    ("ONE POINT OF CONTACT", "why-1.png",
     "No more chasing multiple vendors. One team manages your entire shipment from origin to destination."),
    ("FULL SUPPLY CHAIN VISIBILITY", "why-2.png",
     "Track your freight in real time and get proactive updates before issues become delays."),
    ("COMPLIANCE YOU CAN TRUST", "why-3.png",
     "Our licensed customs brokers keep your shipments moving within every regulatory requirement across APAC."),
    ("COMPETITIVE, TRANSPARENT PRICING", "why-4.png",
     "No hidden fees. Clear, competitive pricing backed by responsive sales support throughout the shipment."),
    ("FAST ISSUE RESOLUTION", "why-5.png",
     "When something unexpected happens, we do not point fingers — we solve it. Our team acts immediately to protect your timeline."),
]

TESTIMONIALS = [
    ("THOMAS MUNRO", "Director", "Picha Group", "thomas-munro.webp",
     "<p>My business wouldn't function without this team. Extremely talented with immense experience tailoring each consignment based on its merits. We have our dedicated account managers that know our business, are responsive and provide personalised serviced which we never had with bigger companies.<br>UC for the win.</p>"),
    ("FRANCIS FUNG", "APAC Supply Chain Operations Director, US Fortune 500 Telecom and Communications Supplier", "Commscope", "francis-fung.webp",
     "<p>As a first time supplier shipping equipment to support one of the major Australian infrastructure project I came up against uncharted territories. It was a three months discovery and mobilization period until the first shipment left its origin airborne for Melbourne. Looking back I really appreciate Chris effort in helping a potential customer to understand what are required and how to go about the execution. Our first time right delivery to my Customer's 3PL was no coincident. It was Chris' relentless attention to details and pro-active monitoring of the process that ensured a smooth dock to dock delivery. I would like to offer Chris my most sincere congratulation in his new venture with United Carriers.</p>"),
    ("ALEX HUGHES", "Senior Management", "Factory X", "alex-hughes.webp",
     "<p>I worked closely with Chris over several years to build a seamless, cost effective supply chain for one of Australia's s largest fashion retail companies. Chris' knowledge and passion for the industry was apparent from day one. As anyone who works in logistics understands, your freight parter is more than just a service provider, they are an integral part of your business. Chris was not only able to help us streamline our operations throughout Asia and shorten our time to market, but through his willingness to negotiate great rates on our behalf, also provide significant cost savings. For anyone looking for a freight agent who is always available and ready to assist in anyway possible, then I cannot recommend Chris Lebon and United Carriers any higher.</p><p>\u200d</p>"),
]

INSIGHTS = [
    ("ASIA PACIFIC", "SEPTEMBER 8, 2026", "China Set to Open Pinglu Canal – Its New Shortcut to South-East Asia",
     "/insights/china-set-to-open-pinglu-canal---its-new-shortcut-to-south-east-asia", "pinglu-canal.jpg"),
    ("FEATURED", "SEPTEMBER 6, 2026", "UC COURTSIDE IS HERE",
     "/insights/uc-courtside-is-here", "uc-courtside-giveaway.jpg"),
    ("FEATURED", "SEPTEMBER 3, 2026", "United Carriers Achieves Australian Trusted Trader Accreditation",
     "/insights/united-carriers-achieves-australian-trusted-trader-accreditation", "att-accreditation.jpg"),
    ("MARKET UPDATES", "SEPTEMBER 1, 2026", "UC Market Update China - September",
     "/insights/uc-market-update-china---september", "market-update-globe.jpg"),
    ("MARKET UPDATES", "AUGUST 27, 2026", "BMSB SEASON 2026–2027",
     "/insights/bmsb-season-2026-2027", "market-update-globe.jpg"),
    ("ASIA", "AUGUST 27, 2026", "Typhoon Saudel & Ongoing Port Congestion",
     "/insights/typhoon-saudel-ongoing-port-congestion", "typhoon-saudel.jpg"),
]

FAQ = [
    ("What does United Carriers do?",
     "United Carriers is a global freight forwarding and logistics provider delivering end-to-end supply chain solutions, including airfreight, seafreight, customs brokerage, warehousing, and transport."),
    ("What industries do you specialise in?",
     "We support a broad range of industries including retail, fashion, food &amp; beverage, industrial, project cargo, and technology."),
    ("What shipping methods do you offer?",
     "We offer airfreight, seafreight (FCL &amp; LCL), breakbulk, RO/RO, and multimodal transport solutions."),
    ("Do you provide customs clearance services?",
     "Yes, we offer in-house customs brokerage to manage import and export clearances efficiently."),
    ("How is freight pricing calculated?",
     "Pricing depends on factors such as shipment size, weight, origin, destination, mode of transport, and current market conditions."),
    ("Do you offer warehousing and 3PL services?",
     "Yes, we provide storage, pick and pack, inventory management, and distribution solutions."),
    ("Can you handle oversized or heavy cargo?",
     "Yes, we specialise in project cargo including out-of-gauge (OOG) and heavy lift shipments."),
    ("How do I request a quote?",
     "You can contact us via our website, email, or phone with your shipment details."),
]

FOOTER_COMPANY = [("Home","/"),("Insights","/insights"),("Industries","/industries"),("About us","/about"),
                  ("Merchandise","/merchandise"),("Services","/services"),("Careers","/careers"),
                  ("Community","/community"),("Contact us","/contact")]
FOOTER_INDUSTRIES = ["Fashion & Footwear","Medical & Healthcare","Retail","Technology & Electronics",
                     "Energy & Renewables","Automotive & Industrial Equipment","Mining & Resources",
                     "Building & Construction","Project Cargo","Engineering & Manufacturing",
                     "Food & Beverage","Agriculture & Commodities"]
FOOTER_SERVICES = ["Air Freight","Ocean Freight","Customs Brokerage","Warehousing & 3PL","Project Cargo",
                   "Domestic & Linehaul Transport","Freight Consolidation Programs","Cross-Docking & Bypass",
                   "Trade Compliance Advisory","Supply Chain Optimization","Quarterly Business Reviews",
                   "Freight & Marine Insurance"]
FOOTER_LEGAL = [("QHSE","/qhse"),("Privacy Policy","/privacy-policy"),("Terms & Conditions","/terms-conditions"),
                ("Payment Policy","/payment-policy"),("Delivery Policy","/delivery-policy"),
                ("Refund & Returns Policy","/refund-returns-policy")]
COUNTRIES = ["Australia","New Zealand","Hong Kong","China"]
PAYMENTS = ["visa","mastercard","discover","amex","diners-club","jcb","unionpay","apple-pay","generic-card"]
SOCIALS = [("linkedin","https://www.linkedin.com/company/united-carriers-apac"),
           ("instagram","https://www.instagram.com/unitedcarriers"),
           ("facebook","https://www.facebook.com/unitedcarriers")]


# the walls are ordered the way the reference lists them, not alphabetically
PARTNER_ORDER = {
    'airlines': ['air-china', 'vietnam-airlines', 'british-airways', 'fiji-airways',
                 'malaysia-airlines', 'china-southern', 'qatar-airways', 'china-eastern',
                 'qantas', 'air-new-zealand', 'etihad', 'cathay-pacific',
                 'singapore-airlines', 'united-airlines', 'emirates', 'air-india',
                 'thai-airways'],
    'shipping-lines': ['oocl', 'hamburg-sud', 'zim', 'cma-cgm', 'wallenius-wilhelmsen',
                       'sinotrans', 'nyk-line', 'k-line', 'cosco', 'evergreen-line',
                       'yang-ming', 'pil', 'msc', 'hmm', 'maersk', 'apl'],
}


def partners(folder):
    """Pairs each brand's default art with its hover art, falling back to the
    one state the source dump has when a brand only shipped a single file."""
    base = os.path.join('public/assets/websiteimages/10-partners', folder)
    present = {f.split('--')[0] for f in os.listdir(base) if f.endswith('.png')}
    ordered = [n for n in PARTNER_ORDER[folder] if n in present]
    ordered += sorted(present - set(ordered))

    out = []
    for n in ordered:
        default = f'{n}--default.png'
        hover = f'{n}--hover.png'
        if not os.path.exists(os.path.join(base, default)): default = hover
        if not os.path.exists(os.path.join(base, hover)): hover = default
        label = n.replace('-', ' ').title()
        out.append((label, f'{IMG}/10-partners/{folder}/{default}', f'{IMG}/10-partners/{folder}/{hover}'))
    return out


def srcset(path, widths, full):
    """Builds a srcset that includes the full-size file with its real width.
    Without that last candidate the browser can only choose among the small
    variants, and a full-bleed image renders from an 800px source."""
    stem, ext = os.path.splitext(path)
    parts = [f'{stem}-{w}w{ext} {w}w' for w in widths if w < full]
    parts.append(f'{path} {full}w')
    return ', '.join(parts)


# ------------------------------------------------------------- sections -----
def roll_link(href, text, txt_class='fs-16 fw-med', extra=''):
    """The site's standard link hover: the label rolls up while a duplicate
    rolls in behind it. Both copies sit in one grid cell under an overflow
    clip, so only one is ever visible."""
    label = f'<div class="txt {txt_class}">{esc(text)}</div>'
    return (f'<a class="footer-link{extra}" href="{href}">'
            f'<div class="link"><div class="link-inner">'
            f'<div class="link-top">{label}</div>'
            f'<div class="link-bottom">{label}</div>'
            f'</div></div></a>')


def header():
    """The site navbar, ported from CONNEXT's site-navbar.tsx: a glass bar with
    a flared concave top, inline links on desktop and a toggle panel below
    1024px. Behaviour lives in src/sections/navbar.js."""
    links = [("About Us", "/about"), ("Safety", "/safety"), ("Careers", "/careers")]
    download_icon = ('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" '
                     'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
                     '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" />'
                     '<line x1="12" x2="12" y1="15" y2="3" /></svg>')
    menu_icon = ('<svg class="icon-menu" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" '
                 'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
                 '<path d="M4 12h16" /><path d="M4 6h16" /><path d="M4 18h16" /></svg>')
    close_icon = ('<svg class="icon-close" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" '
                  'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
                  '<path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>')

    desktop = '\n'.join(f'          <a class="site-nav-link" href="{h}">{esc(t)}</a>' for t, h in links)
    panel = '\n'.join(f'            <a class="site-nav-panel-link" href="{h}">{esc(t)}</a>' for t, h in links)

    return f'''
  <!-- ============================ NAVBAR ============================ -->
  <header class="site-nav on-loader">
    <div class="site-nav-inner">
      <div class="site-nav-bar">
        <span class="site-nav-sheen" aria-hidden="true"></span>
        <!-- thin green gradient border; its path follows the bar's flared
             shape and is drawn by src/sections/navbar.js -->
        <svg class="site-nav-border" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id="site-nav-border-gradient" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stop-color="#00C757" stop-opacity="0.15" />
              <stop offset="0.2" stop-color="#00C757" />
              <stop offset="0.5" stop-color="#8dffc4" />
              <stop offset="0.8" stop-color="#00C757" />
              <stop offset="1" stop-color="#00C757" stop-opacity="0.15" />
            </linearGradient>
          </defs>
          <path stroke="url(#site-nav-border-gradient)" />
        </svg>

        <a class="site-nav-logo" href="/"><img src="/assets/connext-logo.png" alt="Connext" width="867" height="143" /></a>

        <nav class="site-nav-links" aria-label="Main navigation">
{desktop}
        </nav>

        <div class="site-nav-actions">
          <a class="site-nav-contact" href="/contact">Contact Us</a>
          <button class="site-nav-download" type="button">{download_icon}<span>Download</span></button>
        </div>

        <button class="site-nav-toggle" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="site-nav-panel">{menu_icon}{close_icon}</button>
      </div>

      <div class="site-nav-panel" id="site-nav-panel">
        <div class="site-nav-panel-card">
          <div class="site-nav-panel-body">
{panel}
            <div class="site-nav-panel-actions">
              <a class="site-nav-panel-contact" href="/contact">Contact Us</a>
              <button class="site-nav-panel-download" type="button">{download_icon}<span>Download</span></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </header>
'''


def intro():
    stats = [("2,500", "+", "Shipments per month"),
             ("98.2", "%", "On-time delivery rate"),
             ("8", "+", "Years in operation")]
    rows = '\n'.join(f'''
          <div class="home-intro-stats-item">
            <div class="home-intro-stats-item-val"><h3 class="heading h0"><span data-count>{v}</span>{suf}</h3></div>
            <div class="home-intro-stats-item-desc"><div class="txt fs-24 fw-med">{esc(d)}</div></div>
            <div class="home-intro-stats-item-line"></div>
          </div>''' for v, suf, d in stats)

    return f'''
  <!-- ============================ INTRO ============================ -->
  <div class="home-intro-wrap">
    <div class="home-intro-overlap-bg" aria-hidden="true">
      <div class="home-intro-overlap-bg-img">
        <img class="img-df img-abs" src="{IMG}/03-hero/hero-blur-black.avif" alt="" loading="lazy" />
        <img class="img-df img-abs" src="{IMG}/03-hero/hero-blur.png" alt="" loading="lazy" />
      </div>
    </div>

    <section class="home-intro">
      <div class="container grid">
        <div class="home-intro-stick-wrap">
          <div class="home-intro-stick">
            <div class="home-intro-thumb">
              <img class="img-df" src="{IMG}/04-intro/intro-vehicle-back.png"
                   sizes="100vw" loading="lazy"
                   alt="Connext three-wheeler cargo vehicle, rear view, branded Drive With Us." />
            </div>
            <div class="home-intro-title">
              <h2 class="heading h2"><span class="cl-note">We move freight. </span><br />We own <br />the outcome.</h2>
            </div>
          </div>
        </div>

        <div class="home-intro-text-wrap is-copy">
          <div class="home-intro-desc">
            <div class="txt fs-28 fs-20-mb fw-med">With every service under one roof and one accountable team, your supply chain moves the way your business demands: predictably, transparently, and without excuses.<br /><br />That means no finger-pointing between vendors. No delays lost in handoffs. Just one team, accountable from origin to destination.</div>
          </div>
          <a href="/about" class="home-intro-btn">
            <div data-link-random data-is-btn class="btn"><div class="btn-txt"><div class="txt mono fs-12">Learn more about us</div></div></div>
          </a>
        </div>

        <div class="home-intro-text-wrap is-stats">
          <div class="home-intro-label">
            <div class="txt fs-16 fw-med">From countless journeys, clarity emerges</div>
            <div class="home-intro-label-line"></div>
          </div>
          <div class="home-intro-stats">{rows}
          </div>
        </div>
      </div>
    </section>
  </div>
'''


def pickup():
    """THE PICKUP: dark section right after the hero (src/sections/pickup.js,
    src/styles/pickup.css). Copy on the left, an evening street illustration on
    the right: a Connext truck drives in and stops at a shop where the boxes
    are waiting."""
    shops = []
    tones = [('#2b2620', '#3a3128'), ('#1c2a26', '#243833'), ('#2c241e', '#3b3026'), ('#1e2532', '#283143')]
    for i, (body, awn) in enumerate(tones):
        x = i * 182
        shops.append(f'''
          <g class="pk-shop">
            <rect x="{x + 1}" y="106" width="176" height="276" fill="{body}" stroke="#34433d" stroke-width="3" />
            <rect x="{x + 1}" y="106" width="176" height="40" fill="{awn}" />
            <rect x="{x + 1}" y="146" width="176" height="3" fill="#000" opacity=".25" />
            <rect x="{x + 20}" y="236" width="136" height="104" fill="#0b1317" stroke="#d9e7df" stroke-opacity=".55" stroke-width="4" />
            <rect class="pk-lit" x="{x + 72}" y="240" width="30" height="96" fill="#f3c27e" style="--i:{i}" />
            <rect x="{x + 88}" y="240" width="3" height="96" fill="#0b1317" />
          </g>''')
    shops = ''.join(shops)
    return f'''
  <!-- ============================ THE PICKUP ============================ -->
  <div class="home-pickup-wrap">
    <section class="home-pickup" data-section="dark" aria-labelledby="pickup-title">
      <div class="pickup-inner">
        <div class="pickup-copy">
          <p class="pickup-eyebrow pk-anim" style="--d:0">The pickup</p>
          <h2 class="pickup-title" id="pickup-title">
            <span class="pk-line"><span class="pk-line-in" style="--d:1">Stock ready.</span></span>
            <span class="pk-line"><span class="pk-line-in is-accent" style="--d:2">Transport sorted.</span></span>
          </h2>
          <p class="pickup-desc pk-anim" style="--d:3">Your goods are packed. Your next delivery is waiting. Book the right vehicle, review the fare and confirm your trip from your phone.</p>
        </div>

        <div class="pickup-visual pk-anim" style="--d:2">
          <svg class="pickup-scene" viewBox="0 0 660 490" role="img" aria-label="A Connext truck pulls up outside a row of shops where packed boxes are waiting for pickup">
            <defs>
              <linearGradient id="pk-sky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#0c1714" />
                <stop offset="1" stop-color="#132320" />
              </linearGradient>
              <radialGradient id="pk-beam" cx="0" cy=".5" r="1">
                <stop offset="0" stop-color="#fff4c9" stop-opacity=".55" />
                <stop offset="1" stop-color="#fff4c9" stop-opacity="0" />
              </radialGradient>
            </defs>
            <rect width="660" height="490" fill="url(#pk-sky)" />
            <g class="pk-shops">{shops}
            </g>
            <!-- road -->
            <rect y="380" width="660" height="110" fill="#14191b" />
            <rect y="380" width="660" height="6" fill="#26302f" />
            <line class="pk-dash" x1="0" y1="440" x2="660" y2="440" stroke="#cfd8d3" stroke-opacity=".55" stroke-width="3" stroke-dasharray="10 7" />
            <!-- parcels waiting at the kerb -->
            <g class="pk-boxes">
              <rect x="80" y="320" width="48" height="60" fill="#a8783f" />
              <rect x="80" y="320" width="48" height="8" fill="#c08d52" />
              <rect x="126" y="298" width="80" height="82" fill="#b8874c" />
              <rect x="126" y="298" width="80" height="9" fill="#cf9d60" />
              <rect x="163" y="298" width="6" height="82" fill="#000" opacity=".12" />
            </g>
            <!-- the truck: positioned by the outer group, driven in by the inner one -->
            <g transform="translate(212 290)">
              <g class="pk-truck">
                <ellipse cx="160" cy="146" rx="170" ry="9" fill="#000" opacity=".45" />
                <path class="pk-beam" d="M318 92 L470 60 L470 140 Z" fill="url(#pk-beam)" />
                <rect width="226" height="120" rx="9" fill="#13242c" />
                <rect width="226" height="120" rx="9" fill="none" stroke="#ffffff" stroke-opacity=".08" stroke-width="2" />
                <text x="113" y="70" text-anchor="middle" fill="#fff" font-family="Helvetica Neue, Arial, sans-serif" font-weight="700" font-size="27" letter-spacing=".5">CONNEXT</text>
                <rect x="230" y="36" width="88" height="80" rx="11" fill="#22c55e" />
                <rect x="250" y="47" width="46" height="31" rx="3" fill="#bff3d6" />
                <rect class="pk-light" x="312" y="88" width="6" height="11" rx="2" fill="#fff4c9" />
                <g class="pk-wheel"><circle cx="62" cy="122" r="22" fill="#0a0e10" stroke="#9aa6a1" stroke-width="6" /><rect x="60" y="104" width="4" height="36" fill="#3a4541" /></g>
                <g class="pk-wheel"><circle cx="268" cy="122" r="22" fill="#0a0e10" stroke="#9aa6a1" stroke-width="6" /><rect x="266" y="104" width="4" height="36" fill="#3a4541" /></g>
              </g>
            </g>
          </svg>
        </div>
      </div>
    </section>
  </div>
'''


def city():
    """THE CITY KEEPS MOVING: dark section after the Pickup (src/sections/city.js,
    src/styles/city.css). A two-layer skyline rises in when the section comes
    into view, windows flicker on and rooftop pins pulse; the layers drift
    apart slightly as you scroll."""
    import random
    rnd = random.Random(7)   # fixed seed: the skyline is the same on every build

    def layer(count, hmin, hmax, wmin, wmax, lit_every, spire_chance, pins=()):
        out = []
        for i in range(count):
            w = rnd.randint(wmin, wmax)
            h = rnd.randint(hmin, hmax)
            cls = ['cy-b']
            extra = ''
            if lit_every and i % lit_every == 1:
                cls.append('is-lit')
            if rnd.random() < spire_chance:
                cls.append('has-step')
                extra += f';--sw:{rnd.randint(28, 46)}%;--sh:{rnd.randint(14, 34)}px'
            pin = '<i class="cy-pin" aria-hidden="true"></i>' if i in pins else ''
            out.append(f'<span class="{" ".join(cls)}" style="--w:{w};--h:{h}px;--i:{i};--t:{rnd.randint(28, 60) / 10}s{extra}">{pin}</span>')
        return ''.join(out)

    back = layer(22, 120, 210, 50, 110, 0, 0.35)
    front = layer(26, 52, 118, 56, 120, 3, 0.45, pins=(4, 13, 21))
    return f'''
  <!-- ============================ THE CITY KEEPS MOVING ============================ -->
  <div class="home-city-wrap">
    <section class="home-city" data-section="dark" aria-labelledby="city-title">
      <div class="city-copy">
        <p class="city-eyebrow pk-anim" style="--d:0">The city keeps moving</p>
        <h2 class="city-title" id="city-title">
          <span class="pk-line"><span class="pk-line-in" style="--d:1">From market to storefront.</span></span>
          <span class="pk-line"><span class="pk-line-in is-accent" style="--d:2">One connected journey.</span></span>
        </h2>
        <p class="city-desc pk-anim" style="--d:3">Wholesale pickups, retail restocking and business deliveries &mdash; Connext helps you arrange goods movement across supported Chennai locations.</p>
      </div>

      <div class="city-skyline" aria-hidden="true">
        <div class="cy-layer cy-back">{back}</div>
        <div class="cy-layer cy-front">{front}</div>
        <div class="cy-street"></div>
      </div>
    </section>
  </div>
'''


def streets():
    """Three busy T. Nagar streets from above (src/sections/streets.js, src/world/streets.js): Pondy Bazaar, Usman Road, Ranganathan Street.
    It opens on a close top view of Pondy Bazaar; a Connext truck then drives to a shop and stops. The map is OpenStreetMap data, which must be credited."""
    return '''
  <!-- ============================ THREE STREETS FROM ABOVE ============================ -->
  <div class="home-streets-wrap">
    <section class="home-streets" aria-label="Top view of Pondy Bazaar, a busy street in T. Nagar, Chennai: a Connext truck drives along it and stops at a shop">
      <picture>
        <source media="(max-aspect-ratio: 1/1)" srcset="/assets/world/streets-mobile.jpg" />
        <img class="home-world-poster" src="/assets/world/streets.jpg" alt="" decoding="async" />
      </picture>
      <canvas class="home-streets-canvas" role="img" aria-label="Map view from above of Pondy Bazaar in T. Nagar, Chennai, drawn from OpenStreetMap data, with cars, autos, buses and two-wheelers driving and a Connext truck stopping at a shop"></canvas>
      <p class="home-streets-credit">Map data &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a></p>
    </section>
  </div>
'''


def world():
    """Shot 1 of the Connext world: a sticky full-screen three.js stage (src/sections/world.js, src/world/scene.js).
    The camera descends from straight above a Chennai street and follows the Connext truck to a home as the wrapper scrolls past."""
    return '''
  <!-- ============================ WORLD, SHOT 1 ============================ -->
  <div class="home-world-wrap">
    <section class="home-world" aria-label="Aerial view of a Chennai street descending to a Connext truck collecting a parcel at a home">
      <picture>
        <source media="(max-aspect-ratio: 1/1)" srcset="/assets/world/poster-mobile.jpg" />
        <img class="home-world-poster" src="/assets/world/poster.jpg" alt="" decoding="async" />
      </picture>
      <canvas class="home-world-canvas" role="img" aria-label="Three-dimensional Chennai street: the camera descends from above and follows a Connext truck to a home, where the resident hands a parcel to the driver"></canvas>
    </section>
  </div>
'''


STORY = '/assets/parcel-story'   # every image of the parcel story lives here, in story order (see its README)
import json as _json
_ST = _json.load(open('public/assets/parcel-story/1-street/manifest.json'))


def _street_dir(name):
    for prefix, folder in (('partner-', 'people'), ('customer-', 'people'), ('seller-', 'people'),
                           ('shop-', 'places'), ('office-', 'places'), ('parcel-', 'parcels'), ('bld-', 'backdrop'), ('life-', 'life')):
        if name.startswith(prefix):
            return folder
    raise KeyError(name)


def spr(cls, name, h, x=0, y=0, flip=False, anchor='left'):
    """One cut-out in the street scene. x/y/h are metres from the truck's rear edge / the ground;
    anchor='torso' puts x at the figure's torso instead of its left edge, so poses line up."""
    m = _ST[name]
    ar = round(m['w'] / m['h'], 4)
    cx = m.get('cx', 0) if anchor == 'torso' else 0
    fl = ' flip' if flip else ''
    return (f'<div class="st {cls}{fl}" style="--x:{x};--y:{y};--h:{h};--ar:{ar};--cx:{cx}">'
            f'<img class="st-img" src="{STORY}/1-street/{_street_dir(name)}/{name}.avif" alt="" decoding="async" /></div>')


def street_inner():
    """The parcel-pickup street: readouts and the world that slides past (the partner who loads the truck is
    crew(), on the truck's own layer). Shared by the desktop section and the mobile one."""
    GAP = 20   # metres the street slides between the two pickups (street-story.js reads it from data-gap)
    near = '\n'.join([
        # pickup 1: the shop is right behind the truck, so the driver only has a short walk from the truck's rear
        spr('shop', 'shop-boutique', 3.4, -5.4),
        spr('cust cust-offer', 'customer-offer', 1.62, -1.8, anchor='torso'),
        spr('cust cust-stand', 'customer-stand', 1.62, -1.8, anchor='torso'),
        # pickup 2: a corporate office, where everything ends up once the street has slid GAP metres (its entrance ends 1.15 m behind the truck).
        # An executive checks her tablet beside three corporate boxes that are ready for dispatch.
        spr('office', 'office-corporate', 4.8, round(-10.06 + GAP, 2)),
        spr('seller', 'seller-corporate', 1.66, round(-3.6 + GAP, 2), 0, anchor='torso'),
        spr('pk pk-1', 'parcel-corp1', 0.38, round(-2.75 + GAP, 2)), spr('pk pk-2', 'parcel-corp2', 0.46, round(-2.3 + GAP, 2)),
        spr('pk pk-3', 'parcel-corp3', 0.42, round(-1.85 + GAP, 2))])
    # the street behind: a row of medium-rise shops and company buildings (modern, Chennai-style), abutting like a street wall.
    # They stand on the footpath (see .home-service-footpath), slide at 0.6x the speed of the pickups for depth, and are
    # placed from x = -15 m so the first screen shows cafe / IT office / shop block, and the last one the shop block / clinic / finance.
    BUILDINGS = (('elec', 7.8, 0), ('cafe', 7.6, 0), ('it', 7.8, .7), ('retail', 8.2, 0), ('med', 8.6, 0), ('fin', 8.8, 0))
    # the street is built three times, side by side: the buildings are drawn smaller on wide, short screens (street-story.js
    # fits them to the screen), and the copies keep the street continuous to both sides at any size
    row, start = '', -15.0
    span = sum(h * _ST[f'bld-{n}']['w'] / _ST[f'bld-{n}']['h'] - 2 * t for n, h, t in BUILDINGS)
    for copy in (-1, 0, 1):
        bx = start + copy * span
        for name, h, tuck in BUILDINGS:
            m = _ST[f'bld-{name}']
            w = h * m['w'] / m['h']
            row += spr('bld', f'bld-{name}', h, round(bx - tuck, 2)) + '\n'   # tuck: the IT office's roof slab overhangs its facade, so it sits a little into its neighbours
            bx += w - 2 * tuck
    far = row
    tallest = max(h for _, h, _ in BUILDINGS)

    # the footpath life between the buildings and the pickups: a cafe terrace, pedestrians, a fruit cart, parked bikes.
    # It slides at 0.7x (a little faster than the buildings, so it reads as nearer). Positions are left edges in metres;
    # the pickups and the truck stand in front, so people also walk "behind" them as the street slides.
    life = ''
    for name, x, y in (
            ('life-cafe-couple', -9.6, .25), ('life-cafe-menu', -7.9, .25), ('life-cafe-reader', -7.2, .25),     # in front of the cafe
            ('life-p08', 4.9, .28), ('life-p04', 6.3, .28), ('life-p02', 7.4, .28),                            # beside the truck at the first stop
            ('life-p12', 8.9, .28), ('life-cart', 9.6, .2), ('life-p11', 12.3, .28), ('life-scooter', 13.0, .2),
            ('life-p10', 14.8, .28), ('life-p05', 16.0, .28), ('life-p01', 17.0, .28),
            ('life-p09', 18.4, .28), ('life-p07', 19.7, .28), ('life-moto', 20.8, .2),                       # and by the second stop
            ('life-p03', 22.8, .28), ('life-p06', 23.8, .28), ('life-bicycle', 24.6, .2)):
        life += spr('life', name, _ST[name]['m'], x, y) + '\n'

    streaks = ''.join(f'<i style="--x:{x};--y:{y};--w:{w};" data-k="{k}"></i>'
                      for x, y, w, k in ((6, .35, 7, 1.15), (10, .9, 10, 1.0), (2, 1.5, 6, 1.3), (14, 2.1, 9, .9),
                                         (-3, 2.8, 8, 1.2), (12, 3.6, 12, .8), (-6, 4.4, 7, 1.1), (8, 5.3, 9, .85)))

    return f'''<div class="home-service-street" data-tallest="{tallest}">
                  <p class="home-service-sr">A Connext truck collects one parcel from a shop, then three corporate boxes from an office, in a single trip. Two pickups, four parcels, one trip.</p>
                  <div class="home-service-hud" aria-hidden="true">
                    <div class="home-service-chip is-stop"><i class="dot"></i>
                      <span class="txt mono fs-12 stop-1">Pickup 1</span><span class="txt mono fs-12 stop-2">Pickup 2</span>
                    </div>
                    <div class="home-service-chip is-count"><span class="txt mono fs-12">Parcels on board</span>
                      <span class="home-service-count txt mono fs-12"><b>0</b><b>1</b><b>2</b><b>3</b><b>4</b></span>
                    </div>
                    <div class="home-service-chip is-trip"><i class="dot"></i><span class="txt mono fs-12">2 pickups · 4 parcels · 1 trip</span></div>
                  </div>
                  <div class="home-service-route" aria-hidden="true">
                    <span class="txt mono fs-12 rt-lbl">Route</span>
                    <div class="rt-track"><i class="rt-fill"></i><b class="rt-node n1"></b><b class="rt-node n2"></b><b class="rt-node n3"></b></div>
                  </div>
                  <div class="home-service-plus is-one" aria-hidden="true"><b>+1</b> parcel</div>
                  <div class="home-service-plus is-three" aria-hidden="true"><b>+3</b> parcels</div>
                  <div class="home-service-world" aria-hidden="true" data-gap="{GAP}">
                    <div class="home-service-layer is-far">
                      {far}
                    </div>
                    <div class="home-service-footpath"></div>
                    <div class="home-service-layer is-mid">
                      {life}
                    </div>
                    <div class="home-service-streaks">{streaks}</div>
                    <div class="home-service-layer is-near">
                      {near}
                    </div>
                  </div>
                </div>'''


def crew():
    """The partner is also the truck's driver. Returns (seat, crew) markup for the truck's own layers, in metres
    from the truck's rear edge:
      seat  the driver sitting in the cab, hands on the steering wheel. It goes UNDER the truck art, which has
            see-through glass, so only the window shows him (the frame and steering wheel stay in front of him).
            The cut-out is waist-up, so no legs can show anywhere.
      crew  the poses he takes at the truck's rear. This layer is cut off at the rear edge (see
            .home-service-truck-crew), so he comes out from behind the truck and goes back behind it — he never
            walks over the truck's side."""
    seat = ('<div class="home-service-truck-seat" aria-hidden="true">'
            # head in the cab window, fists on the steering wheel (plate px 1823,265 at 200 px/m, rear edge at 1244)
            + spr('seat', 'partner-driving', 0.656, 2.895, 1.09) + '</div>')
    poses = '\n'.join([
        spr('pose walk-l', 'partner-walk', 1.78, 0, flip=True, anchor='torso'),
        spr('pose recv-l', 'partner-receive', 1.78, 0, flip=True, anchor='torso'),
        spr('pose carry-1', 'partner-carry-1', 1.78, 0, anchor='torso'),
        spr('pose place', 'partner-place', 1.78, 0, anchor='torso'),
        spr('pose walk-r', 'partner-walk', 1.78, 0, anchor='torso'),
        spr('pose carry-3', 'partner-carry-3', 1.78, 0, anchor='torso')])
    out = (f'<div class="home-service-truck-crew" aria-hidden="true">'
           f'<div class="home-service-partner">{poses}</div></div>')
    return seat, out


def truck_side():
    """The side-on truck for the mobile street stage: the complete truck with two spinning wheels."""
    P = f'{STORY}/2-truck-side'
    seat, crew_html = crew()
    return f'''<div class="home-service-mb-truck-side">
                <div class="mbts">
                  {seat}
                  <img class="mbts-plate" src="{P}/01-truck-complete.avif" alt="" />
                  <div class="mbts-wheel w1"><img src="{P}/02-wheel-front.avif" alt="" /></div>
                  <div class="mbts-wheel w2"><img src="{P}/03-wheel-rear.avif" alt="" /></div>
                  {crew_html}
                </div>
              </div>'''


def mobile_services():
    """The mobile stage's copy (src/sections/service-mobile.html, {{MB_SERVICES}}):
    our services, how Connext works and why Connext, stacked."""
    def card(t, ic, d, tag, live):
        # the mobile title styles hide <br>, so the two lines are joined with a space
        return f'''<div class="home-service-item {'is-live' if live else 'is-soon'}"><div class="home-service-item-ic"><img src="{IMG}/{ic}" loading="lazy" alt="" class="img-df"></div><div class="home-service-item-tag"><div class="txt mono fs-12">{esc(tag)}</div></div><div class="home-service-item-title"><div class="heading h6"><h3>{esc(t.replace(chr(10), ' '))}</h3></div></div><div class="home-service-item-desc"><div class="txt fs-16 fs-14-mb">{esc(d)}</div></div></div>'''

    def sub(rows, numbered):
        out = []
        for n, (t, ic, d, inv) in enumerate(rows, 1):
            tag = f'<div class="home-service-sub-tag"><div class="txt mono fs-12">Step {n:02d}</div></div>' if numbered else ''
            out.append(f'''<div class="home-service-sub-item"><div class="home-service-sub-ic{' is-invert' if inv else ''}"><img src="{IMG}/{ic}" loading="lazy" alt="" class="img-df"></div>{tag}<div class="home-service-sub-title"><h3 class="heading h6">{br(t)}</h3></div><div class="home-service-sub-desc"><div class="txt fs-16 fs-14-mb">{esc(d)}</div></div></div>''')
        return ''.join(out)

    def block(eyebrow, title, desc, body):
        return (f'<div class="home-service-mb-text-wrap"><div class="home-service-eyebrow"><div class="txt mono fs-12">{eyebrow}</div></div>'
                f'<div class="home-service-mb-title"><h2 class="heading h2">{title}</h2></div>'
                f'<div class="home-service-mb-desc"><div class="txt fs-14">{desc}</div></div>{body}</div>')

    return ''.join([
        block('Our services', 'Different loads. <span class="cl-note">Different ways to move.</span>',
              'Two services are available today. Two more are being developed. Follow the same road to find the transport option that fits your requirement.',
              '<div class="home-service-cms"><div class="home-service-list">' + ''.join(card(*r) for r in SERVICES) + '</div></div>'),
        block('How Connext works', 'Three steps.<br><span class="cl-note">One simpler way to deliver.</span>',
              'You&rsquo;ll review the booking price before accepting the trip.',
              '<div class="home-service-sub-wrap"><div class="home-service-sub-list">' + sub(STEPS, True) + '</div></div>'),
        block('Why Connext', 'Reliability at every <span class="cl-green">milestone.</span>',
              'Clear booking details and useful delivery visibility help you stay focused on your business, not repeated transport calls.',
              '<div class="home-service-sub-wrap"><div class="home-service-sub-list">' + sub(WHY_CONNEXT, False) + '</div></div>'),
    ])


def service():
    label_svg = io.open('public/assets/websiteimages/05-journey/road/journey-label-marquee.svg',
                        encoding='utf-8').read().strip()
    label_svg = label_svg.replace('fill="none"', 'fill="currentColor"', 1)

    def service_card(t, ic, d, tag, live, indent):
        state = 'is-live' if live else 'is-soon'
        return f'''
{indent}<div class="home-service-item {state}">
{indent}  <div class="home-service-item-ic"><img class="img-df" src="{IMG}/{ic}" alt="" loading="lazy" /></div>
{indent}  <div class="home-service-item-tag"><div class="txt mono fs-12">{esc(tag)}</div></div>
{indent}  <div class="home-service-item-title"><div class="heading h6"><h3>{br(t)}</h3></div></div>
{indent}  <div class="home-service-item-desc"><div class="txt fs-16">{esc(d)}</div></div>
{indent}</div>'''

    items = '\n'.join(service_card(*row, ' ' * 14) for row in SERVICES)

    def sub_cards(rows, numbered):
        out = []
        for n, (t, ic, d, inv) in enumerate(rows, 1):
            tag = (f'\n              <div class="home-service-sub-tag"><div class="txt mono fs-12">Step {n:02d}</div></div>'
                   if numbered else '')
            out.append(f'''
            <div class="home-service-sub-item">
              <div class="home-service-sub-ic{' is-invert' if inv else ''}"><img class="img-df" src="{IMG}/{ic}" alt="" loading="lazy" /></div>{tag}
              <div class="home-service-sub-title"><h3 class="heading h6">{br(t)}</h3></div>
              <div class="home-service-sub-desc"><div class="txt fs-16">{esc(d)}</div></div>
            </div>''')
        return '\n'.join(out)

    steps = sub_cards(STEPS, True)
    whys = sub_cards(WHY_CONNEXT, False)

    wheels = '\n'.join(
        f'<div class="home-service-truck-wheel-i wheel-{i}"><img class="img-df" src="{STORY}/2-truck-side/0{2 if i==1 else 3}-wheel-{"front" if i==1 else "rear"}.avif" alt="" /></div>'
        for i in range(1, 3))

    seat, crew_html = crew()
    mobile_html = (Path('src/sections/service-mobile.html').read_text()
                   .replace('{{STREET}}', street_inner()).replace('{{TRUCK_SIDE}}', truck_side())
                   .replace('{{MB_SERVICES}}', mobile_services()))

    return f'''
  <!-- =========================== SERVICES =========================== -->
  <div class="home-service-wrap">
    <section class="home-service is-dark-panels">
      <div class="home-service-speed" aria-hidden="true">
        <div class="home-service-speed-inner">
          <div class="home-service-speed-number"><div data-speed class="txt mono fs-12">00</div></div>
          <div class="txt mono fs-12">km/h</div>
        </div>
      </div>

      <div class="container grid">
        <!-- screen 1 — the pickups: one box, then three, one truck -->
        <div class="home-service-first-screen">
          <div class="home-service-stick-wrap first-screen">
            <div class="home-service-empty-block first-screen"></div>
            <div class="home-service-stick first-screen">
              <div class="home-service-scene">
                {street_inner()}
              </div>
              <div class="home-service-land"></div>
            </div>
          </div>
        </div>

        <!-- screen 2 — the road -->
        <div class="home-service-second-screen">
          <div class="home-service-stick-wrap second-screen">
            <div class="home-service-stick second-screen">
              <div class="home-service-front">
                <div class="home-service-truck">
                  <div class="home-service-truck-inner">
                    <div class="home-service-truck-full">
                      <img class="img-df" src="{STORY}/2-truck-side/01-truck-complete.avif" alt="" />
                    </div>
                    <div class="home-service-truck-car-wrap">
                      {seat}
                      <div class="home-service-truck-car">
                        <img class="img-df" src="{STORY}/2-truck-side/01-truck-complete.avif" alt="" />
                      </div>
                      <div class="home-service-truck-wheel">{wheels}
                      </div>
                      {crew_html}
                    </div>
                    <canvas class="home-service-truck-sq" aria-hidden="true"></canvas>
                  </div>
                </div>
                <div class="home-service-label" aria-hidden="true">{label_svg}</div>
              </div>

              <div class="home-service-main is-dark">
                <div class="home-service-main-inner">
                  <div class="home-service-text-wrap">
                    <div class="home-service-title"><h2 class="heading h2">Different loads. <span class="cl-note">Different ways to move.</span></h2></div>
                    <div class="home-service-sub">
                      <div class="txt fs-18 fw-med">Two services are available today. Two more are being developed.<br /><br />Follow the same road to find the transport option that fits your requirement.</div>
                    </div>
                  </div>
                  <div class="home-service-cms">
                    <div class="home-service-list">{items}
                    </div>
                  </div>
                  <div class="home-service-road-big" aria-hidden="true"><div class="home-service-road-big-img"></div></div>
                </div>
                <div class="home-service-btn-wrap">
                  <a href="/services" class="home-service-btn">
                    <div data-link-random data-is-btn class="btn"><div class="btn-txt"><div class="txt mono fs-12">Our services</div></div></div>
                  </a>
                </div>
                <div class="home-service-main-road top" aria-hidden="true"></div>
                <div class="home-service-main-road bot" aria-hidden="true"></div>
              </div>
            </div>
            <div class="home-service-empty-block second-screen"></div>
          </div>
        </div>

        <!-- screen 3 — overhead -->
        <div class="home-service-third-screen">
          <div class="home-service-new-truck-wrap" aria-hidden="true">
            <div class="home-service-new-truck-stick">
              <div class="home-service-new-truck-rot">
                <div class="home-service-new-truck">
                  <div class="home-service-new-truck-inner">
                    <img class="img-df" src="{STORY}/4-truck-top/01-truck-top.avif" alt="" loading="lazy" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="home-service-road-main" aria-hidden="true">
            <div class="container grid">
              <div class="home-service-road-wrap">
                <div class="home-service-road">
                  <div class="home-service-road-inner">
                    <div class="home-service-road-center"><img src="{IMG}/05-journey/road/road-curve-center.svg" alt="" /></div>
                  </div>
                  <div class="home-service-road-left-wrap">
                    <div class="home-service-road-left"><div class="home-service-road-hor-line"></div></div>
                    <div class="home-service-road-left-white"></div>
                  </div>
                  <div class="home-service-road-right"><div class="home-service-road-hor-line"></div></div>
                  <div class="home-service-road-bot"><div class="home-service-road-ver-line"></div></div>
                </div>
              </div>
              <div class="home-service-road-stick"></div>
            </div>
          </div>

          <!-- the road fades out below the parked truck -->
          <div class="home-service-road-end" aria-hidden="true"></div>

          <div class="home-service-sub-content">
            <div class="container grid">
              <!-- how Connext works: three steps the truck drives past -->
              <div class="home-service-stick-wrap third-screen">
                <div class="home-service-stick third-screen">
                  <div class="home-service-title sub">
                    <div class="home-service-eyebrow"><div class="txt mono fs-12">How Connext works</div></div>
                    <h2 class="heading h2">Three steps.<br /><span class="cl-note">One simpler way to deliver.</span></h2>
                  </div>
                  <div class="home-service-desc sub">
                    <div class="txt fs-18 fw-med">You&rsquo;ll review the booking price before accepting the trip.</div>
                  </div>
                </div>
              </div>
              <div class="home-service-sub-wrap">
                <div class="home-service-sub-list is-steps">{steps}
                </div>
              </div>

              <!-- why Connext: the end of the road, where the truck parks -->
              <div class="home-service-stick-wrap third-screen is-why">
                <div class="home-service-stick third-screen">
                  <div class="home-service-title sub">
                    <div class="home-service-eyebrow"><div class="txt mono fs-12">Why Connext</div></div>
                    <h2 class="heading h2">Reliability at<br />every <span class="cl-green">milestone.</span></h2>
                  </div>
                  <div class="home-service-desc sub">
                    <div class="txt fs-18 fw-med">Clear booking details and useful delivery visibility help you stay focused on your business, not repeated transport calls.</div>
                  </div>
                </div>
              </div>
              <div class="home-service-sub-wrap is-why">
                <div class="home-service-sub-list is-why">{whys}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    {mobile_html}
  </div>
'''


def why():
    items = '\n'.join(f'''
            <div class="home-why-main-item">
              <div class="home-why-main-item-inner">
                <div class="home-why-main-item-ic"><img class="img-df" src="{IMG}/07-why-icons/{ic}" alt="" loading="lazy" /></div>
                <div class="home-why-main-item-title"><h3 class="heading h6">{esc(t)}</h3></div>
                <div class="home-why-main-item-desc"><div class="txt fs-16 fs-14-mb fw-med">{esc(d)}</div></div>
              </div>
            </div>''' for t, ic, d in WHY)

    decor = '\n'.join(
        f'<div class="home-why-cloud-decor-item cloud-{i}"><img class="img-df" src="{IMG}/08-sky/cloud-{n}.avif" alt="" loading="lazy" /></div>'
        for i, n in [(1, 'left'), (2, 'right'), (3, 'bottom')])

    # the bank mixes two plates: the wide "bottom" cloud for the three biggest
    # layers, the template for the rest
    overlap_art = {1: 'cloud-bottom', 2: 'cloud-bottom', 3: 'cloud-template',
                   4: 'cloud-template', 5: 'cloud-template', 6: 'cloud-template',
                   7: 'cloud-bottom'}
    overlap = '\n'.join(
        f'<div class="home-why-cloud-overlap-item cloud-{i}"><img class="img-df" src="{IMG}/08-sky/{overlap_art[i]}.avif" alt="" loading="lazy" /></div>'
        for i in range(1, 8))

    return f'''
  <!-- ============================= WHY US ============================ -->
  <div class="home-why-wrap">
    <div class="home-why-empty-block bottom"></div>

    <section class="home-why">
      <div class="container grid" style="padding: 0;">
        <div class="home-why-stick-wrap">
          <div class="home-why-stick">
            <div class="home-why-ocean" aria-hidden="true">
              <div class="home-why-ocean-img">
                <img class="img-df img-fill" src="{IMG}/05-journey/step-4-ship-ocean/01-ocean-water.jpg" alt="" />
              </div>
            </div>

            <div class="home-why-ship" aria-hidden="true">
              <div class="home-why-ship-img">
                <div class="home-why-ship-img-inner shadow">
                  <img class="img-df" src="{IMG}/05-journey/step-4-ship-ocean/04-ship-deck-bottom-desktop.avif" alt="" />
                </div>
                <div class="home-why-ship-img-inner">
                  <img class="img-df" src="{IMG}/05-journey/step-4-ship-ocean/02-ship-deck-desktop.avif" alt="" />
                </div>
              </div>
            </div>

            <div class="home-why-cloud-decor" aria-hidden="true">{decor}
            </div>
            <div class="home-why-cloud-overlap-bg" aria-hidden="true"></div>
            <div class="home-why-cloud-overlap" aria-hidden="true">{overlap}
            </div>
          </div>
        </div>

        <div class="home-why-empty-block first-screen"></div>

        <div class="home-why-main is-dark">
          <div class="container grid">
            <div class="home-why-text-wrap">
              <div class="home-why-label"><div class="txt mono fs-12">Why us</div></div>
              <div class="home-why-title"><h2 class="heading h2">Logistics that works as hard as you do.</h2></div>
            </div>
            <div class="home-why-main-content">
              <div class="home-why-main-list">{items}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
'''


def testi():
    items = '\n'.join(f'''
            <div class="home-testi-item">
              <div class="home-testi-item-line"></div>
              <div class="home-testi-item-inner">
                <div class="home-testi-item-info">
                  <div class="home-testi-item-thumb"><img class="img-df" src="{IMG}/09-testimonials/{img}" alt="{esc(name)}" loading="lazy" /></div>
                  <div class="home-testi-item-info-inner">
                    <div class="home-testi-item-name"><div class="txt ff-stei fs-16 fw-bold">{esc(name)}</div></div>
                    <div class="home-testi-item-pos"><div class="txt fs-14">{esc(role)}</div></div>
                    <div class="home-testi-item-company-wrap">
                      <div class="home-testi-item-company"><div class="txt fs-14">at</div><div class="txt fs-14 fw-med">{esc(company)}</div></div>
                    </div>
                  </div>
                </div>
                <div class="home-testi-item-main">
                  <div class="home-testi-item-content"><div class="txt fs-28 fw-med fs-18-mb fw-reg-mb">{quote}</div></div>
                </div>
              </div>
            </div>''' for name, role, company, img, quote in TESTIMONIALS)

    return f'''
  <!-- ========================= TESTIMONIALS ========================= -->
  <div class="home-testi-wrap">
    <section class="home-testi">
      <div class="home-testi-plane" aria-hidden="true">
        <div class="home-testi-plane-inner">
          <div class="home-testi-plane-img">
            <div class="home-testi-plane-img-main">
              <img class="img-df" src="{IMG}/08-sky/plane-top-view.avif" alt="" loading="lazy" />
            </div>
            <div class="home-testi-plane-img-shadow">
              <img class="img-df img-abs" src="{IMG}/08-sky/plane-blur.avif" alt="" loading="lazy" />
            </div>
          </div>
          <div class="home-testi-plane-cloud-wrap">
            <div class="home-testi-plane-cloud cloud-1"><img class="img-df" src="{IMG}/08-sky/cloud-template.avif" alt="" loading="lazy" /></div>
            <div class="home-testi-plane-cloud cloud-2"><img class="img-df" src="{IMG}/08-sky/cloud-template.avif" alt="" loading="lazy" /></div>
          </div>
        </div>
      </div>

      <div class="home-testi-content">
        <div class="home-testi-content-inner">
          <div class="container grid">
            <div class="home-testi-text-wrap">
              <div class="home-testi-title"><h2 class="heading h2">Trusted<br />by businesses <span class="cl-note">across APAC</span></h2></div>
              <div class="home-testi-desc"><div class="txt fs-16">From first-time importers to high-volume shippers, our customers keep coming back because we treat their freight like our own.</div></div>
            </div>
            <div class="home-testi-main">
              <div class="home-testi-cms">{items}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="home-testi-stick-block"></div>
    </section>
  </div>
'''


def partners_section():
    def wall(folder, label):
        tiles = '\n'.join(f'''
            <div class="home-partners-item">
              <div class="home-partners-item-inner">
                <div class="home-partners-item-thumb is-default"><img src="{d}" alt="{esc(name)}" loading="lazy" /></div>
                <div class="home-partners-item-thumb is-hover"><img src="{h}" alt="" aria-hidden="true" loading="lazy" /></div>
              </div>
              <div class="home-partners-item-line"></div>
              <div class="home-partners-item-dot"></div>
              <div class="home-partners-item-dot top-right"></div>
              <div class="home-partners-item-dot bottom-left"></div>
              <div class="home-partners-item-dot bottom-right"></div>
            </div>''' for name, d, h in partners(folder))
        cls = ' shipping-lines' if folder == 'shipping-lines' else ''
        return f'''
        <div class="home-partners-label-wrap{cls}">
          <div class="home-partners-label"><div class="txt fs-16 fw-med fs-14-mb fw-reg-mb">Our partners</div></div>
          <div class="home-partners-cate"><div class="txt ff-stei fs-16 fw-med">{esc(label)}</div></div>
        </div>
        <div class="home-partners-list">{tiles}
        </div>'''

    return f'''
  <!-- =========================== PARTNERS =========================== -->
  <div class="home-partners-wrap">
    <section class="home-partners">
      <div class="container grid">{wall('airlines', 'Airlines')}{wall('shipping-lines', 'Shipping lines')}
      </div>
    </section>
    <div class="home-partners-bg" aria-hidden="true">
      <div class="home-partners-bg-abs">
        <img class="img-df img-fill" src="{IMG}/10-partners/partners-bg.avif"
             srcset="{srcset(IMG + '/10-partners/partners-bg.avif', [500, 800, 1080, 1600, 2000], 2592)}"
             sizes="100vw" alt="" loading="lazy" />
      </div>
    </div>
  </div>
'''


def insights():
    rows = '\n'.join(f'''
              <div class="home-ins-cms-item" data-ins-index="{i}">
                <a class="home-ins-cms-item-inner" href="{href}">
                  <div class="home-ins-cms-item-text">
                    <div class="home-ins-cms-item-info"><div class="txt mono fs-10">{esc(date)}</div></div>
                    <div class="home-ins-cms-item-title"><div class="txt fs-16 fw-med">{esc(title)}</div></div>
                  </div>
                  <div class="home-ins-cms-item-cate"><div class="txt mono fs-10">{esc(cat)}</div></div>
                </a>
                <div class="home-ins-cms-item-line"></div>
              </div>''' for i, (cat, date, title, href, thumb) in enumerate(INSIGHTS))

    thumbs = '\n'.join(f'''
                <div class="home-ins-cms-thumb-item{' is-active' if i == 0 else ''}" data-ins-thumb="{i}">
                  <div class="home-ins-cms-thumb-inner"><img class="img-df" src="{IMG}/11-insights/{thumb}" alt="" loading="lazy" /></div>
                </div>''' for i, (cat, date, title, href, thumb) in enumerate(INSIGHTS))

    return f'''
  <!-- =========================== INSIGHTS =========================== -->
  <div class="home-ins-wrap" data-section="dark">
    <section class="home-ins is-dark">
      <div class="container grid">
        <div class="home-ins-text-wrap">
          <div class="home-ins-title"><h2 class="heading h2"><span class="cl-note">What's moving</span><br />in your industry</h2></div>
          <div class="home-ins-desc-wrap">
            <div class="home-ins-desc"><div class="txt fs-16">Stay ahead of the shifts shaping trade across APAC — from regulatory changes to new shipping routes and supply chain trends.</div></div>
            <a href="/insights" class="home-ins-action">
              <div data-link-random data-is-btn class="btn"><div class="btn-txt"><div class="txt mono fs-12">All insights</div></div></div>
            </a>
          </div>
        </div>

        <div class="home-ins-main-wrap">
          <div class="home-ins-main">
            <div class="home-ins-cms">
              <div class="home-ins-cms-list">{rows}
              </div>
            </div>
          </div>
          <div class="home-ins-main-thumb" aria-hidden="true">
            <div class="home-ins-cms-thumb">
              <div class="home-ins-cms-thumb-list">{thumbs}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
'''


def faq():
    items = '\n'.join(f'''
            <div class="home-faq-main-item">
              <div class="home-faq-main-item-number"><div class="txt mono fs-10">{i + 1:02d}</div></div>
              <div class="home-faq-main-item-inner">
                <button class="home-faq-main-item-title-wrap" type="button" aria-expanded="false">
                  <div class="home-faq-main-item-title"><div class="txt fs-16 fw-med">{esc(q)}</div></div>
                  <div class="home-faq-main-item-dot"></div>
                </button>
                <div class="home-faq-main-item-ans"><div class="txt fs-16">{a}</div></div>
              </div>
              <div class="home-faq-main-item-line"></div>
            </div>''' for i, (q, a) in enumerate(FAQ))

    return f'''
  <!-- ============================== FAQ ============================= -->
  <div class="home-faq-wrap">
    <section class="home-faq">
      <div class="container grid">
        <div class="home-faq-text-wrap">
          <div class="home-faq-title"><h2 class="heading h2">F.A.Q</h2></div>
          <div class="home-faq-desc"><div class="txt fs-16">Straightforward answers, so you can move forward with confidence.</div></div>
        </div>
        <div class="home-faq-main">
          <div class="line"></div>
          <div class="home-faq-main-cms">
            <div class="home-faq-main-list">{items}
            </div>
          </div>
        </div>
        <div class="home-faq-sub-text-wrap">
          <div class="home-faq-sub-text"><div class="txt fs-16">Still have questions? Our team is here to help.</div></div>
          <a data-link-random class="home-faq-sub-link" href="mailto:contact@unitedcarriers.com"><div class="txt mono fs-12">Email us</div></a>
        </div>
      </div>
    </section>
  </div>
'''


def cta():
    rings = '\n'.join(f'<div class="cta-circ anim-wave" style="--wave-delay: -{i * 3}s"></div>' for i in range(5))
    return f'''
  <!-- ============================== CTA ============================= -->
  <div class="home-cta-wrap">
    <div class="cta is-dark" data-section="dark">
      <div class="cta-inner">
        <div class="container grid">
          <div class="cta-circs" aria-hidden="true">{rings}
          </div>
          <div class="cta-text-wrap">
            <div class="cta-title"><h2 class="heading h2">Ready to move smarter?</h2></div>
            <div class="cta-desc"><div class="txt fs-16">We are here to help you grow without hassle. No call centres. No runaround. Just experienced people ready to help.</div></div>
            <a href="/contact" class="cta-btn-wrap">
              <div data-link-random data-is-btn class="btn is-solid"><div class="btn-txt"><div class="txt mono fs-12">Work with us</div></div></div>
            </a>
          </div>
        </div>
      </div>
      <a class="cta-link" href="/contact" aria-label="Work with us"></a>
    </div>
  </div>
'''


def footer():
    """Two columns: a narrow left rail (tagline, socials, thumbnail) beside a
    wide right column carrying the menu, the industries/services ticker, and
    the contact block with its map."""
    def menu_links(items):
        return '\n'.join(roll_link(h, t) for t, h in items)

    socials = '\n'.join(
        f'<a class="footer-link is-linkedin" href="{h}" target="_blank" rel="noopener" aria-label="{n.title()}">'
        f'<span class="footer-linkedin"><img src="{IMG}/12-footer/social/{n}.svg" alt="" /></span></a>'
        for n, h in SOCIALS)

    pay = '\n'.join(f'<div class="footer-content-payment-ic"><img src="{IMG}/12-footer/payment/{p}.svg" alt="{p}" /></div>'
                   for p in PAYMENTS)

    legal = '\n'.join(
        f'<div class="footer-legal-item"><a data-link-random class="footer-legal-link" href="{h}"><div class="txt mono fs-10">{esc(t)}</div></a></div>'
        for t, h in FOOTER_LEGAL)

    countries = '\n'.join(
        f'<div class="footer-content"><div class="txt fs-16 fw-med">{esc(c)}</div>'
        + ('<div class="txt fs-14 cl-note">/</div>' if i < len(COUNTRIES) - 1 else '')
        + '</div>' for i, c in enumerate(COUNTRIES))

    def ticker(items, href):
        row = ''.join(
            f'<div class="footer-info-text-item"><a class="footer-info-text-item-link" href="{href}">'
            f'<div class="txt fs-28 fw-med">{esc(t)}</div></a></div>' for t in items)
        # duplicated so the marquee can loop without a visible seam
        return f'<div class="footer-info-text-list anim-marquee">{row}</div>' * 2

    # the four markets, placed roughly where they sit on the world map
    dots = '\n'.join(f'<span class="footer-map-dot" style="left:{x}%;top:{y}%;--delay:{d}s"></span>'
                     for x, y, d in [(86.86, 83.82, 0), (95.92, 83.82, 0.6), (76.28, 57.35, 1.2), (76.28, 51.47, 1.8)])

    return f"""
  <!-- ============================ FOOTER ============================ -->
  <div class="footer-wrap">
    <footer class="footer">
      <div class="footer-inner">
        <div class="container grid">

          <div class="footer-sub"><div class="txt fs-14 fw-med fs-16-mb">One operator.<br />Every leg of the journey.</div></div>

          <div class="footer-socials">
            <div class="footer-menu-line"></div>
            <div class="footer-content-item item-align-right">
              <div class="footer-label"><div class="txt mono fs-10">Socials</div></div>
              <div class="footer-content-link-wrap">{socials}</div>
            </div>
          </div>

          <div class="footer-menu">
            <div class="footer-menu-line line-mb"></div>
            <div class="footer-content-item-wrap">
              <div class="footer-content-item">
                <div class="footer-label"><div class="txt mono fs-10">Company</div></div>
                <div class="footer-menu-list">{menu_links(FOOTER_COMPANY)}</div>
              </div>
              <div class="footer-content-payment">
                <div class="footer-label"><div class="txt mono fs-10">Secure payments</div></div>
                <div class="footer-content-payment-content">
                  <div class="footer-content-payment-desc"><div class="txt fs-14">Payments secured via PCI-DSS compliant gateway.<br />Card details are not stored.</div></div>
                  <div class="footer-content-payment-ic-wrap">{pay}</div>
                </div>
              </div>
            </div>
          </div>

          <div class="footer-info">
            <div class="footer-info-switch">
              <div class="footer-info-active"></div>
              <div class="footer-info-switch-inner">
                <button data-link-random class="footer-info-btn txt mono fs-10 is-active" type="button" data-info-tab="0">Industries</button>
                <button data-link-random class="footer-info-btn txt mono fs-10" type="button" data-info-tab="1">Services</button>
              </div>
            </div>
            <div class="footer-info-text">
              <div class="footer-info-text-inner is-active" data-info-panel="0">{ticker(FOOTER_INDUSTRIES, '/industries')}</div>
              <div class="footer-info-text-inner" data-info-panel="1">{ticker(FOOTER_SERVICES, '/services')}</div>
            </div>
          </div>

          <div class="footer-thumb">
            <div class="footer-thumb-img"><img class="img-df img-fill" src="{IMG}/12-footer/footer-thumb.jpg" alt="" loading="lazy" /></div>
          </div>

          <div class="footer-main">
            <div class="footer-main-line"></div>
            <div class="footer-main-address">
              <div class="footer-content-item item-border-top">
                <div class="footer-label"><div class="txt mono fs-10">Head office</div></div>
                <div class="footer-main-address-item"><div class="txt fs-16 fw-med">2A International Square,<br />Tullamarine VIC 3043, Australia.</div></div>
                <a class="footer-link" href="https://maps.google.com/?q=2A+International+Square+Tullamarine+VIC+3043"><div class="footer-link-ic"><img src="{IMG}/13-ui-icons/arrow-link-16.svg" alt="" /></div><div class="hover-line"><div class="txt fs-14">Direction on Google</div></div></a>
              </div>
              <div class="footer-content-item">
                <div class="footer-label"><div class="txt mono fs-10">Operating across</div></div>
                <div class="footer-content-wrap">{countries}</div>
              </div>
            </div>

            <div class="footer-main-contact">
              <div class="footer-content-item">
                <div class="footer-label"><div class="txt mono fs-10">Email</div></div>
                {roll_link('mailto:contact@unitedcarriers.com', 'contact@unitedcarriers.com', 'fs-16 fw-med fs-14-mb')}
              </div>
              <div class="footer-content-item">
                <div class="footer-label"><div class="txt mono fs-10">Hotline</div></div>
                {roll_link('tel:1300000082', '1300 000 082', 'fs-16 fw-med fs-14-mb')}
              </div>
              <div class="footer-content-item">
                <div class="footer-label"><div class="txt mono fs-10">Office hours</div></div>
                <div class="footer-content"><div class="txt fs-16 fw-med">Monday - Friday / 8:30AM - 5PM</div></div>
              </div>
            </div>

            <div class="footer-main-map" aria-hidden="true">
              <div class="footer-main-map-img"><img class="img-df" src="{IMG}/12-footer/world-map.png" alt="" loading="lazy" /></div>
              <div class="footer-main-map-dots">{dots}</div>
            </div>
          </div>

          <div class="footer-bot">
            <div class="line"></div>
            <div class="footer-bot-inner">
              <div class="footer-copyright"><div class="txt mono fs-10">© 2026 United Carriers APAC Pty Ltd. Crafted by Bearplus</div></div>
              <div class="footer-legal-menu">{legal}
                <div class="footer-legal-item"><button data-link-random class="footer-legal-link" type="button"><div class="txt mono fs-9 fs-10-mb">Cookie settings</div></button></div>
              </div>
              <div class="footer-legal-payment"><div class="txt mono fs-10">All prices in AUD, inclusive of GST. Powered by Stripe.</div></div>
            </div>
          </div>

          <div class="footer-logo" aria-hidden="true">
            <div class="footer-logo-placeholder">
              <img class="img-df" src="{IMG}/01-brand/logo-dotted-desktop.png"
                   srcset="{srcset(IMG + '/01-brand/logo-dotted-desktop.png', [500, 800], 3296)}"
                   sizes="100vw" alt="" loading="lazy" />
            </div>
            <div class="footer-logo-main">
              <img id="source-image-footer" class="img-df" src="{IMG}/01-brand/united-carriers-logo.svg" alt="" />
            </div>
            <div class="footer-logo-canvas">
              <canvas id="footer-particle-canvas" class="footer-logo-canvas-inner"></canvas>
            </div>
          </div>

        </div>
      </div>
    </footer>
  </div>
"""


def build():
    # the old intro() ("We move freight") was replaced by pickup()
    # the two 3D scroll scenes, streets() and world(), are no longer on the page
    # why() (the container ship) was replaced by the Why Connext stop at the end of service()
    return ''.join([pickup(), city(), service(), testi(), partners_section(),
                    insights(), faq(), cta(), footer()])


if __name__ == '__main__':
    sections = build()
    template = io.open('index.template.html', encoding='utf-8').read()
    # the header is sticky and must precede the hero in document order
    page = template.replace('<!-- HEADER -->', header())
    page = page.replace('<!-- SECTIONS -->', sections)
    io.open('index.html', 'w', encoding='utf-8').write(page)
    print('index.html', len(page), 'bytes')
