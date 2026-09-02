# Amy & Annette — Paid Search & Shopping Playbook

A 10-stage AI-assisted workflow for Google Ads, adapted for the Amy & Annette
(DremGem) jewelry catalog and the tooling that already exists in the Walmart
Command Center.

Adapted from a public Google Ads workflow thread. The generic version assumes a
DTC store with a Merchant Center feed; this version says which stages that
applies to today, which ones run against Walmart/Amazon instead, and which
portal data feeds each prompt so you are not re-deriving research the system
already stores.

---

## Read this before Stage 0 — what actually applies today

Amy & Annette sells through **Walmart Marketplace (+ WFS), Woot, Fab Fit Fun,
and Amazon**. Every stage below that mentions Google Shopping, Merchant Center,
PMax, or landing pages assumes a **direct-to-consumer storefront you control**.

That distinction decides half this playbook:

| Stage | No DTC store | With a DTC store + Merchant Center |
|---|---|---|
| 0 Brand brain | ✅ Run it — feeds every other stage | ✅ Same |
| 1 Customer language | ✅ Run it — feeds listing copy | ✅ Same |
| 2 Competitor angles | ✅ Run it — Walmart competitors already scraped | ✅ Add Meta Ad Library + Ads Transparency |
| 3 Keyword universe | ✅ Run it — retarget output at Walmart/Amazon SEO | ✅ Full Google keyword universe |
| 4 Campaign architecture | ⚠️ Walmart Connect + Amazon Ads only | ✅ Full structure |
| 5 RSA copy | ⚠️ Repurpose as listing titles/bullets | ✅ RSAs as written |
| 6 Feed optimization | ✅ Applies as-is to Walmart listings | ✅ Both feeds |
| 7 Landing pages | ❌ No page to build | ✅ Full stage |
| 8 Creative | ✅ Applies (listing images, Amazon/Walmart video) | ✅ Same |
| 9 Daily audit | ⚠️ Amazon Ads + Walmart Connect data | ✅ Add Google Ads |
| 10 Weekly scaling | ⚠️ Same caveat as Stage 9 | ✅ Full |

**Why Stage 7 is blocked without a store:** you cannot run Google Shopping ads
that land on your Walmart item pages. Walmart submits its own product feed to
Google for marketplace items; sellers do not control it and cannot bid on it.
Paid traffic you buy has to land somewhere you own.

**First decision to make:** confirm whether a Shopify/DTC site exists or is
planned. If yes, the full playbook is live. If no, run stages 0–3, 6, and 8 as
marketplace SEO/content work and treat 4/9/10 as Amazon Ads + Walmart Connect.

---

## Catalog facts to paste into every prompt

Pulled from `sku-data.json` (2026-09):

- **3,368 SKUs total, 1,845 currently in stock**
- Product mix by type: **rings 38.8%** (1,308), **earrings 27.3%** (920),
  **bracelets 15.9%** (536), **necklaces 14.8%** (499), anklets/sets ~3%
- SKU pattern: `D` + product-type letter (`R`/`E`/`N`/`B`) + material/finish
  codes + variant suffix
- **1,384 SKUs carry a numeric suffix** (`-6`, `-7`, `-8`, `-9`) and 1,156 of
  those are rings → these are **ring sizes, not distinct products**
- **388 SKUs carry a letter suffix** (`-G`, `-R`, `-M`, `-S`), mostly earrings
  and necklaces → **finish/color variants of one design**

### The consequence nobody catches until spend is wasted

Roughly 1,156 ring SKUs collapse into a few hundred actual ring *designs*. If
those go into a Shopping feed as independent products, you bid against yourself
on every size and split conversion data across variants that will never
individually accumulate signal.

**Rule:** group size and color variants under a shared `item_group_id` in any
Shopping feed, and run campaign structure at the design level, not the SKU
level. Report at design level too — a ring that sold 12 units across 4 sizes
looks like four dead SKUs otherwise.

---

## Stage 0 — Build the brand brain

**Produces:** a working brand profile every later stage references.

**Feed it, from what already exists:**

- `listing_content` table — the source of truth for what's live on Walmart
  (productName, shortDescription, keyFeatures, attributes)
- Best sellers and stocked SKUs from the item report / `items` table
- Walmart + Amazon review text and star ratings (`items.rating`,
  `items.reviewCount`, plus scraped review bodies)
- Returns data and reason codes — the objection doc you already own
- `seo_competitors` — cached competitor scrapes
- Brand guidelines: customer-facing brand is **"Amy and Annette"**, never
  "DremGem" in anything a shopper reads
- Price/compare-at data from `price_comparison`

**Prompt:**

> Act as the paid search and marketplace strategy brain for Amy & Annette, a
> jewelry brand selling rings, earrings, necklaces and bracelets on Walmart
> Marketplace (including WFS), Amazon, Woot and Fab Fit Fun. Read all uploaded
> context and build a working brand profile covering: ICP, core pain points,
> buying triggers, objections, the emotional language customers actually use in
> reviews, top products by type, strongest offers, competitor positioning,
> funnel gaps, and paid opportunities per channel. Note explicitly which
> conclusions are supported by the data I gave you and which are assumptions.
> Do not make recommendations yet — summarize the context, then tell me what is
> missing.

Output quality tracks input quality. A profile built on 20 reviews is a guess.

---

## Stage 1 — Customer language mining

**Produces:** the words shoppers use, which keyword tools never surface.

Jewelry-specific sources that actually pay off: Walmart and Amazon review
bodies (yours *and* competitors'), r/jewelry, r/femalefashionadvice, TikTok
comments on jewelry hauls, YouTube comments on "affordable jewelry" videos, and
your own returns reasons.

**Prompt:**

> Search Reddit, YouTube comments, Amazon and Walmart reviews, TikTok comments
> and jewelry forums for people discussing problems with affordable
> everyday jewelry — specifically [rings / earrings / necklaces / bracelets].
> Extract the exact wording they use for the problem, what they tried, why it
> failed, the outcome they want, and what would make them buy. Format as:
> Quote / Pain Point / Desired Outcome / Funnel Stage / Possible Ad Angle.
> Prioritize recurring complaints about: skin reactions and sensitivity,
> tarnishing and color fading, sizing, clasp and durability failures, gift
> presentation, and looking more expensive than it cost.

Those six themes map directly onto claims already made in the listings —
hypoallergenic, sterling silver, comfort fit. Mining confirms which of them
customers care about enough to search on.

**Guardrail:** a claim that shows up in ad copy has to be true of the specific
SKU. "Hypoallergenic" and "sterling silver" on a brass-base item is a listing
suppression and a returns problem, not a clever angle.

---

## Stage 2 — Competitor angle map

**Produces:** validated angles and white space.

`scrapeCompetitors(keyword, limit)` in `seo-engine.js` already pulls competitor
titles, prices, ratings and review counts from Walmart search and caches them in
`seo_competitors`. Start there rather than from scratch, then add Google Ads
Transparency Center and Meta Ad Library for any DTC competitor.

**Prompt:**

> Research these competitors: [COMPETITOR 1], [COMPETITOR 2], [COMPETITOR 3].
> Use their Walmart and Amazon storefronts, Google Ads Transparency Center, Meta
> Ad Library, landing pages, product pages, offers, guarantees, reviews and
> email capture. Build a table: offer, main promise, ad hooks, landing page
> angle, proof used, objections handled, price position, and what they are NOT
> saying. Note their price band against ours per product type.

**Then:**

> From that research, identify the 5 most validated market angles and the 5
> biggest white-space angles we could own. For each: funnel stage, which channel
> should test it first (Walmart Connect, Amazon Ads, or Google), and what proof
> we would need to make the claim.

Three competitors running the same hook means the angle is validated — take it
and add the spin. Originality is not the goal; a claim you can substantiate is.

---

## Stage 3 — Keyword universe

**Produces:** a keyword map split by intent and funnel stage.

The portal already holds most of the raw material: `JEWELRY_KEYWORD_DB` with
tiered volume estimates, triple-source autocomplete (Walmart, Google, Amazon),
and `amazon_search_terms` — converting search terms from real Amazon spend,
which is the highest-signal input on this list.

**Non-negotiable rules already encoded in `seo-engine.js`, keep them here:**

1. **Product-type focused** — extract the type first, never search raw name
   fragments
2. **Cross-type blocking** — earring products never receive ring keywords
3. **Material + type combos** — "sterling silver earrings", not "sterling silver"
4. **Junk filter** — drop competitor brands (pandora, tiffany), "near me",
   "cheap", wrong-gender terms
5. **Seasonal injection** — Mother's Day, Valentine's, Christmas, 4–6 weeks lead

**Prompt:**

> Using the customer language, competitor research, Amazon converting search
> terms and listing content above, build a keyword universe for Amy & Annette.
> Split into: branded, competitor, high-intent product, problem-aware,
> solution-aware, comparison, material (sterling silver / gold plated /
> stainless), use-case (everyday, work, wedding, bridesmaid), gift/occasion, and
> negatives. For each keyword: funnel stage, intent level, match type, campaign
> and ad group recommendation, and destination. Keep strict product-type
> separation — no ring keywords on earring products. Exclude competitor brand
> names from anything that will appear in ad text.

**Then:**

> Prioritize this into a 30-day launch plan. Separate must-launch from phase 2
> tests. Flag high-volume, low-commercial-intent terms. Rank by our actual stock
> position — do not prioritize keywords for SKUs with zero available quantity.

That last clause matters: 45% of the catalog is out of stock. Building a
keyword plan against unstocked SKUs is a way to spend money on 404s.

---

## Stage 4 — Campaign architecture

**Applies fully only with a DTC store.** Without one, read this as Amazon Ads
(Sponsored Products / Brands / Display) and Walmart Connect structure.

**Prompt:**

> Turn the finalized keyword plan into a complete account structure. Include
> campaign names, ad group names, match types, bidding strategy, starting budget
> split, exclusions, negative keyword rules, and launch sequence. Structure:
> branded search, branded shopping, non-branded shopping split by product type
> (rings / earrings / necklaces / bracelets), non-branded search, competitor
> search, PMax remarketing with brand exclusions, display remarketing, Demand
> Gen, and TOF search tests. Group Shopping products at the design level using
> item_group_id — ring sizes and color variants must not compete as separate
> products.

**Then:**

> For each campaign explain why it exists, what signal it is meant to produce,
> and the metric that decides whether it scales, holds, or gets cut. Give me the
> minimum conversion volume needed before that metric is trustworthy.

A campaign with no defined role and no kill metric is a subscription, not a test.

---

## Stage 5 — Ad copy production

With a store, these are RSAs. Without one, the same output feeds Walmart titles,
key features and Amazon Sponsored Brands headlines.

**Prompt:**

> Write responsive search ad copy for [PRODUCT] targeting [KEYWORD]. Funnel
> stage: [BOF/MOF/TOF]. Use the customer language and competitor gaps above. 15
> headlines under 30 characters, 4 descriptions under 90. Include benefit-led,
> problem-led, proof-led, offer-led and urgency-led variants. Headline 1 must
> match search intent. Brand name is "Amy and Annette". Do not use competitor
> brand names. Every material or hypoallergenic claim must match the attributes
> I gave you for this specific SKU.

**Then:**

> Create 3 variations for this keyword: one direct-response, one proof-heavy
> (rating and review count), one problem-agitation. Say which audience each is
> for.

Funnel discipline: BOF makes the product the obvious answer, MOF makes the
benefit believable, TOF makes the problem impossible to ignore.

**Reuse what exists:** the humanizer in `seo-engine.js` (`pickFrom()` with 8–12
variations per section, seeded by a product-name hash) already prevents every
listing from sounding identical. Ad copy should draw from the same voice, not a
second one.

---

## Stage 6 — Feed and listing optimization

Fully applicable today — this is the Walmart SEO work the portal already does,
plus Merchant Center if a store exists.

**Title prompt:**

> Rewrite this product title using: Brand + Product Type + Core Keyword + Key
> Feature + Use Case/Benefit. Under 150 characters. Brand is "Amy and Annette".
> 10 variations ranked by likely search intent. Do not include the size or color
> variant code — that belongs in attributes, not the title.

**Description prompt:**

> Write a description for [PRODUCT], up to 5,000 characters. Cover features,
> benefits, use cases, materials, sizing/specs, objections and reasons to
> choose. Work in buyer keywords naturally. Do not mention products we do not
> sell or attributes this SKU does not have.

**Audit prompt:**

> Audit this feed for missed opportunities: title, description, product type,
> Google product category, images, variant grouping, pricing, promotions,
> shipping, reviews and attributes. Tell me exactly what to change, per SKU.

**Guardrails — these are the portal's existing rules, they apply here too:**

- Every generated change starts as `status='pending'`. Nothing reaches Walmart
  without per-field approval.
- Bulk pushes need a summary and a separate confirm step. No auto-push, ever.
- Everything is auditable in `seo_changes` with before/after and feed ID.
- `listing_content` is the source of truth — Walmart's API is write-only for
  content, so if it is not in that table it is effectively unrecorded.
- Leave WFS products alone by default (Hide WFS defaults ON for a reason).

---

## Stage 7 — Landing pages

**Blocked without a DTC store.** Keep the prompt for when one exists.

> Build a landing page brief for [PRODUCT] targeting people searching [KEYWORD].
> Awareness stage: [PROBLEM/SOLUTION/PRODUCT-AWARE]. Structure: hero headline,
> subheadline, proof bar, problem section in customer language, mechanism,
> product, comparison, reviews, objection handling, FAQ, CTA. The first screen
> must match the search query.

> Create 5 landing page angle variations for different search intents. For each:
> hero, core promise, proof required, objections to handle, CTA.

Intent-specific pages beat one PDP trying to convert everyone. That is exactly
why marketplace-only selling caps paid performance — you inherit Walmart's page.

---

## Stage 8 — Creative production

Applies now: listing images, A+ content, Amazon video, and social.

The portal's Image Generator already produces 2000×2000 listing images with the
branded template and auto-pulled product photos. Creative concepting should feed
that, not replace it.

> Create 5 creative concepts from the strongest customer pain points in the
> research. Each: hook, visual metaphor, script, image prompts, animation
> prompts, CTA. Jewelry-specific requirement — every concept must show scale on
> a real hand, wrist, ear or neck, and show the finish in natural light.

> Create a 9-shot video ad concept for [PRODUCT] on this angle: [ANGLE]. For
> each shot: scene description, voiceover, on-screen text.

Scale and true finish color are the two things jewelry buyers complain about
most in reviews. Creative that hides both generates returns, and returns on
WFS cost more than the click did.

---

## Stage 9 — Performance audit

Data sources that already exist: `amazon_daily_performance`,
`amazon_search_terms`, `daily_sales`, `daily_metrics`, `seo_keyword_tracking`
(daily Walmart rank per SKU per keyword), and `price_comparison` /
`strikethrough_alerts`.

> Pull the last 7 days of performance and compare to the prior 7. Per campaign:
> spend, revenue, ROAS, conversions, CPA, CPC, CTR, impression share, lost IS
> (rank), lost IS (budget), top search terms. Flag: ROAS down 20%+, CPA up 20%+,
> budget-limited winners, rank-limited campaigns, branded leakage into
> non-branded campaigns, wasted-spend queries, and products spending with no
> conversions. Roll ring sizes and color variants up to the design level before
> judging any product's performance.

> Turn this into an action list. Per action: campaign, issue, evidence,
> recommended change, risk level, expected impact.

**Two brand-specific flags worth adding to any audit:**

- **Stock check** — spend on a SKU whose available quantity is 0 is pure waste,
  and 45% of the catalog sits there. Cross-reference before acting on anything.
- **Strikethrough loss** — losing a compare-at price silently kills conversion
  rate. `strikethrough_alerts` already logs it; a ROAS drop with no traffic
  change usually traces back here before it traces back to the ad.

---

## Stage 10 — Weekly scaling plan

> Compare performance across 7, 14 and 30-day windows. Identify campaigns,
> products, keywords, ads and pages with consistent green signals. Recommend
> which budgets to raise 15–20%, which to hold, which to cut, and what to test
> next. Do not recommend scaling anything unless the signal holds across
> multiple windows and the product has stock to support it.

> Build next week's testing roadmap: 3 keyword tests, 3 creative tests, 2
> landing page tests, 2 feed tests, 1 structure test. Rank by expected impact
> and implementation difficulty.

---

## The loop

```
Research  →  keywords
Keywords  →  campaigns
Campaigns →  landing pages / listings
Pages     →  creative
Creative  →  new angles
Audits    →  next week's tests
```

Each stage's output is the next stage's input. Skipping Stage 0 or 1 means every
stage after it is running on assumptions.

## Standing guardrails

1. **Nothing pushes to Walmart without explicit per-field approval.** Bulk
   operations need a summary plus a separate confirm.
2. **Claims must match SKU attributes.** Material, hypoallergenic, gemstone and
   plating claims are checked against the item record before they enter copy.
3. **Competitor brand names never appear in ad text.** Bidding on them is a
   separate decision from naming them.
4. **Report at design level, not SKU level.** Sizes and finishes are variants.
5. **Check stock before spending.** No paid traffic to zero-quantity SKUs.
6. **Every content change is auditable** — `seo_changes`, before/after, feed ID.
