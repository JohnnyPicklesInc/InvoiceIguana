// Seed data for the programmatic "[trade] invoice template" landing pages.
// Each entry must be genuinely distinct (real example line items + real FAQs) —
// that unique, useful content is what makes these rank instead of reading as
// thin doorway pages. Add more trades here; scripts/make-landing.mjs does the rest.
//
// Fields per trade:
//   slug     URL slug -> /<slug>-invoice-template
//   name     display noun, e.g. "Electrician"
//   plural   e.g. "electricians"
//   cat      category, used to pick "related trades" cross-links
//   intro    1-2 sentences of trade-specific copy (unique per trade)
//   items    example line items for the on-page sample invoice {name, qty, price, unit?}
//   taxrate  example sales-tax % for the sample
//   aiPrompt the prompt pre-filled into the generator's AI box via ?prompt=
//   faqs     [{q, a}] real questions a searcher for this trade would ask

export const SITE = 'https://invoiceiguana.com';

export const trades = [
  {
    slug: 'electrician', name: 'Electrician', plural: 'electricians', cat: 'home',
    intro: 'Bill for panel work, wiring, fixtures, and service calls with a clear breakdown of parts and labor. This electrician invoice template separates materials from hourly work so customers see exactly what they are paying for.',
    items: [
      { name: '200A panel upgrade', qty: 1, price: 1200 },
      { name: 'Labor', qty: 6, price: 95, unit: 'hrs' },
      { name: 'Permit & inspection', qty: 1, price: 150 },
    ],
    taxrate: 8,
    aiPrompt: 'Invoice for an electrician: 200A panel upgrade $1200, 6 hours labor at $95/hr, permit and inspection $150, 8% sales tax, net 15 payment terms.',
    faqs: [
      { q: 'What should an electrician invoice include?', a: 'Your business name and license number, the customer and job address, an itemized list of materials and labor (with hours and rate), any permit or inspection fees, sales tax if you charge it, the total, and payment terms. A job or PO number helps for larger projects.' },
      { q: 'Should I list parts and labor separately on an electrical invoice?', a: 'Yes. Listing materials (panels, breakers, wire, fixtures) separately from labor hours makes the invoice easy to trust and easier to approve — especially on insurance or property-management jobs. This template keeps them as separate line items.' },
      { q: 'Do electricians charge sales tax on labor?', a: 'It depends on your state — many tax materials but not labor, some tax both. Set the tax as a percentage or a flat amount in the generator, and it applies to the subtotal automatically. Check your local rules for what is taxable.' },
    ],
  },
  {
    slug: 'plumber', name: 'Plumber', plural: 'plumbers', cat: 'home',
    intro: 'From a quick drain clear to a full repipe, bill parts, fixtures, and labor without the guesswork. This plumbing invoice template handles service-call fees, hourly labor, and materials in one clean document.',
    items: [
      { name: 'Service call / diagnostic', qty: 1, price: 89 },
      { name: 'Water heater (50 gal)', qty: 1, price: 1150 },
      { name: 'Labor', qty: 4, price: 110, unit: 'hrs' },
    ],
    taxrate: 7,
    aiPrompt: 'Invoice for a plumber: service call $89, 50 gallon water heater $1150, 4 hours labor at $110/hr, 7% sales tax, due on receipt.',
    faqs: [
      { q: 'What should a plumbing invoice include?', a: 'Business name and license number, customer and service address, the service-call or diagnostic fee, itemized parts and fixtures, labor hours and rate, tax, total, and payment terms. Note any warranty on the work or parts.' },
      { q: 'How do I invoice a plumbing service-call fee?', a: 'Add it as its own line item at the top (e.g. "Service call / diagnostic"). Many plumbers roll it into the job if the customer proceeds — either way, showing it as a line keeps the invoice transparent.' },
      { q: 'Should a plumbing invoice mention a warranty?', a: 'If you warranty labor or parts, add it in the notes so it is on the record. It reassures the customer and reduces callbacks about coverage.' },
    ],
  },
  {
    slug: 'hvac', name: 'HVAC', plural: 'HVAC contractors', cat: 'home',
    intro: 'Bill installs, tune-ups, and emergency repairs with equipment, refrigerant, and labor itemized. This HVAC invoice template is built for both maintenance visits and full system replacements.',
    items: [
      { name: 'AC condenser unit (3 ton)', qty: 1, price: 2400 },
      { name: 'Installation labor', qty: 8, price: 105, unit: 'hrs' },
      { name: 'Refrigerant & materials', qty: 1, price: 220 },
    ],
    taxrate: 8.25,
    aiPrompt: 'Invoice for HVAC: 3-ton AC condenser $2400, 8 hours installation labor at $105/hr, refrigerant and materials $220, 8.25% sales tax, net 30.',
    faqs: [
      { q: 'What should an HVAC invoice include?', a: 'Your company and license/EPA info, the customer and property address, equipment with model where relevant, labor hours and rate, refrigerant/materials, tax, total, and terms. For maintenance, note the system serviced and any recommendations.' },
      { q: 'How do I invoice an HVAC maintenance visit vs. an install?', a: 'A tune-up is usually a single flat line (e.g. "Seasonal AC maintenance"), while an install itemizes equipment, materials, and labor hours. This template does both — start from the AI prompt and adjust.' },
      { q: 'Should I put the equipment model number on the invoice?', a: 'For installs and warranty claims, yes — add it to the line item or the notes. It helps the customer with rebates and future service.' },
    ],
  },
  {
    slug: 'painter', name: 'Painter', plural: 'painters', cat: 'home',
    intro: 'Quote and bill interior or exterior jobs by room, square foot, or day, with paint and supplies broken out. This painting invoice template keeps prep, labor, and materials clear.',
    items: [
      { name: 'Interior painting — 3 rooms', qty: 1, price: 900 },
      { name: 'Paint & supplies', qty: 1, price: 240 },
      { name: 'Prep & patching', qty: 4, price: 45, unit: 'hrs' },
    ],
    taxrate: 6,
    aiPrompt: 'Invoice for a painter: interior painting 3 rooms $900, paint and supplies $240, 4 hours prep and patching at $45/hr, 6% sales tax, 50% deposit already paid.',
    faqs: [
      { q: 'What should a painting invoice include?', a: 'Business name, customer and job address, a description of the areas painted, labor and prep, paint and supplies, any deposit already paid, tax, and the balance due. Note the paint brand/finish if the customer chose it.' },
      { q: 'How do painters usually charge — by room, hour, or square foot?', a: 'All three are common: flat per-room or per-project for residential, per square foot for large walls, hourly for prep and repairs. You can mix them as separate line items in the generator.' },
      { q: 'How do I show a deposit on a painting invoice?', a: 'Bill the full amount, then subtract the deposit so the invoice shows the remaining balance. Add the deposit as a note or use a discount line for the amount already paid.' },
    ],
  },
  {
    slug: 'landscaping', name: 'Landscaping', plural: 'landscapers', cat: 'home',
    intro: 'Bill one-off projects or recurring lawn care with materials, crew hours, and equipment. This landscaping invoice template works for mowing routes, cleanups, and design-build jobs alike.',
    items: [
      { name: 'Spring cleanup', qty: 1, price: 350 },
      { name: 'Mulch (installed)', qty: 6, price: 65, unit: 'yd' },
      { name: 'Crew labor', qty: 5, price: 55, unit: 'hrs' },
    ],
    taxrate: 7,
    aiPrompt: 'Invoice for landscaping: spring cleanup $350, 6 yards of mulch installed at $65/yard, 5 hours crew labor at $55/hr, 7% sales tax.',
    faqs: [
      { q: 'What should a landscaping invoice include?', a: 'Your business name, the customer and property address, itemized services (cleanup, planting, mulch, mowing), materials with quantities, crew hours, tax, and total. For recurring clients, note the service date or billing period.' },
      { q: 'How do I invoice recurring lawn-care clients?', a: 'Bill per visit or monthly. Save the client in the generator and duplicate last month’s invoice to reuse the same services and rates — just update the dates.' },
      { q: 'Should mulch and materials be marked up on the invoice?', a: 'Many landscapers bill materials "installed" at a rate that includes the markup, shown as one line (e.g. "Mulch (installed) — $65/yd"). That keeps pricing simple for the customer.' },
    ],
  },
  {
    slug: 'house-cleaning', name: 'House Cleaning', plural: 'house cleaners', cat: 'home',
    intro: 'Bill standard, deep, or move-out cleans by the job or the hour, with add-ons itemized. This cleaning invoice template suits solo cleaners and small crews billing residential or office clients.',
    items: [
      { name: 'Deep clean (3 bed / 2 bath)', qty: 1, price: 220 },
      { name: 'Inside oven', qty: 1, price: 35 },
      { name: 'Interior windows', qty: 1, price: 40 },
    ],
    taxrate: 0,
    aiPrompt: 'Invoice for house cleaning: deep clean of a 3 bed 2 bath home $220, inside oven $35, interior windows $40, no tax, due on receipt.',
    faqs: [
      { q: 'What should a house cleaning invoice include?', a: 'Your name or business, the client and service address, the clean type (standard, deep, move-out), any add-ons, the date of service, total, and payment terms. A recurring schedule note helps for weekly or biweekly clients.' },
      { q: 'Should cleaners charge by the hour or by the job?', a: 'Flat per-job pricing is most common for residential (clients like knowing the price up front); hourly suits one-off deep cleans. List add-ons like ovens or windows as separate lines either way.' },
      { q: 'Do house cleaners charge sales tax?', a: 'Cleaning services are taxable in some states and not others. This example uses 0% — set your local rate in the generator if services are taxable where you work.' },
    ],
  },
  {
    slug: 'handyman', name: 'Handyman', plural: 'handymen', cat: 'home',
    intro: 'Bill a punch list of small jobs — mounting, repairs, assembly — with materials and time in one place. This handyman invoice template keeps mixed tasks organized and easy to total.',
    items: [
      { name: 'TV mount & cable conceal', qty: 1, price: 120 },
      { name: 'Door repair', qty: 1, price: 85 },
      { name: 'Labor', qty: 2, price: 60, unit: 'hrs' },
    ],
    taxrate: 6.5,
    aiPrompt: 'Invoice for a handyman: TV mounting with cable concealment $120, door repair $85, 2 hours labor at $60/hr, 6.5% sales tax.',
    faqs: [
      { q: 'What should a handyman invoice include?', a: 'Your business name, the customer and job address, each task as its own line, materials used, labor hours if billed hourly, tax, and total. A short description per task avoids "what was this for?" questions.' },
      { q: 'Should I itemize every small task or bundle them?', a: 'For a punch list, itemizing each task builds trust and makes it easy for the customer to approve. Bundle only tightly related work. The generator lets you add as many lines as you need.' },
      { q: 'How do handymen usually charge?', a: 'Hourly with a minimum, or flat per task. Many use a half-day/full-day rate for bigger visits. You can mix flat tasks and hourly labor on the same invoice.' },
    ],
  },
  {
    slug: 'carpenter', name: 'Carpenter', plural: 'carpenters', cat: 'home',
    intro: 'Bill custom builds, trim, framing, and repairs with lumber, hardware, and shop time itemized. This carpentry invoice template handles both finish work and rough carpentry.',
    items: [
      { name: 'Custom built-in shelving', qty: 1, price: 1450 },
      { name: 'Lumber & hardware', qty: 1, price: 380 },
      { name: 'Finishing labor', qty: 6, price: 75, unit: 'hrs' },
    ],
    taxrate: 7,
    aiPrompt: 'Invoice for a carpenter: custom built-in shelving $1450, lumber and hardware $380, 6 hours finishing labor at $75/hr, 7% sales tax, 40% deposit paid.',
    faqs: [
      { q: 'What should a carpentry invoice include?', a: 'Business name, customer and job address, a description of the piece or work, materials (lumber, hardware, finish), labor hours, any deposit, tax, and the balance due. Photos or a drawing reference can go in the notes.' },
      { q: 'How do I invoice a custom carpentry job with a deposit?', a: 'Bill the full project price, then subtract the deposit already paid so the invoice shows the remaining balance. Note the deposit date for your records.' },
      { q: 'Should materials be a separate line from labor?', a: 'Yes — separating lumber and hardware from shop/finishing labor makes custom quotes easy to understand and easier to approve.' },
    ],
  },
  {
    slug: 'general-contractor', name: 'General Contractor', plural: 'general contractors', cat: 'home',
    intro: 'Bill remodels and larger projects by phase or milestone, with subcontractors and materials rolled up cleanly. This contractor invoice template supports progress billing and retainage.',
    items: [
      { name: 'Kitchen remodel — phase 1 (demo & rough-in)', qty: 1, price: 8500 },
      { name: 'Materials', qty: 1, price: 3200 },
      { name: 'Subcontractor — electrical', qty: 1, price: 1800 },
    ],
    taxrate: 8,
    aiPrompt: 'Invoice for a general contractor: kitchen remodel phase 1 demo and rough-in $8500, materials $3200, electrical subcontractor $1800, 8% sales tax, net 15.',
    faqs: [
      { q: 'What should a contractor invoice include?', a: 'Your company and license number, the client and project address, the phase or milestone billed, itemized labor/materials/subs, any prior payments, tax, total, and terms. Reference the contract or change order number for larger jobs.' },
      { q: 'How does progress billing work on a contractor invoice?', a: 'Bill by phase or percent complete rather than all at once. Create one invoice per milestone (e.g. "Phase 1 — demo & rough-in") and note the contract total and amount billed to date.' },
      { q: 'How do I show a subcontractor cost on my invoice?', a: 'Add it as its own line (e.g. "Subcontractor — electrical"). Whether you mark it up is up to your contract; showing it as a line keeps the total transparent.' },
    ],
  },
  {
    slug: 'photographer', name: 'Photographer', plural: 'photographers', cat: 'creative',
    intro: 'Bill sessions, events, and licensing with shoot time, deliverables, and usage rights spelled out. This photography invoice template works for portraits, weddings, and commercial work.',
    items: [
      { name: 'Wedding photography — 8 hr coverage', qty: 1, price: 2200 },
      { name: 'Second shooter', qty: 1, price: 400 },
      { name: 'Edited gallery & online delivery', qty: 1, price: 300 },
    ],
    taxrate: 0,
    aiPrompt: 'Invoice for a photographer: wedding photography 8 hours of coverage $2200, second shooter $400, edited online gallery $300, no tax, 50% retainer already paid.',
    faqs: [
      { q: 'What should a photography invoice include?', a: 'Your business name, the client, the shoot date and type, deliverables (hours, edited images, gallery, prints), any retainer already paid, usage/licensing terms, total, and the balance due. Put licensing details in the notes.' },
      { q: 'How do I invoice a photography retainer or deposit?', a: 'Bill the full package, then subtract the retainer so the invoice shows the remaining balance. Note the retainer amount and date — retainers are often non-refundable, so say so in the terms.' },
      { q: 'Should image licensing be on the invoice?', a: 'For commercial or event work, yes — a short usage line (personal use, print rights, or commercial license) in the notes sets expectations and protects your work.' },
    ],
  },
  {
    slug: 'graphic-designer', name: 'Graphic Designer', plural: 'graphic designers', cat: 'creative',
    intro: 'Bill logos, brand kits, and design projects by package or hour, with revisions and deliverables clear. This graphic design invoice template suits freelancers and small studios.',
    items: [
      { name: 'Logo design package (3 concepts)', qty: 1, price: 900 },
      { name: 'Brand style guide', qty: 1, price: 450 },
      { name: 'Additional revision round', qty: 1, price: 120 },
    ],
    taxrate: 0,
    aiPrompt: 'Invoice for a graphic designer: logo design package with 3 concepts $900, brand style guide $450, one extra revision round $120, no tax, net 14.',
    faqs: [
      { q: 'What should a graphic design invoice include?', a: 'Your name or studio, the client, the project, deliverables and revision rounds, file formats provided, any deposit, total, and payment terms. Note when final files are released (often on final payment).' },
      { q: 'Should designers bill hourly or per project?', a: 'Per-project/package pricing is standard for defined work like a logo or brand kit; hourly suits open-ended or ongoing work. List extra revisions or scope beyond the package as separate lines.' },
      { q: 'Can I withhold final files until the invoice is paid?', a: 'Many designers release source/final files only after final payment and say so in the terms. Add that note to the invoice so it is agreed in writing.' },
    ],
  },
  {
    slug: 'web-developer', name: 'Web Developer', plural: 'web developers', cat: 'creative',
    intro: 'Bill builds, retainers, and maintenance with milestones or hours, and hosting passed through cleanly. This web developer invoice template fits freelancers and agencies.',
    items: [
      { name: 'Website build — 5 pages', qty: 1, price: 3000 },
      { name: 'CMS setup & training', qty: 1, price: 500 },
      { name: 'Development hours (extra scope)', qty: 4, price: 95, unit: 'hrs' },
    ],
    taxrate: 0,
    aiPrompt: 'Invoice for a web developer: 5-page website build $3000, CMS setup and training $500, 4 extra hours of development at $95/hr, no tax, 50% deposit paid, net 15.',
    faqs: [
      { q: 'What should a web development invoice include?', a: 'Your name or agency, the client, the project or milestone, itemized build/scope/hours, any pass-through costs (hosting, domain, plugins), deposit, total, and terms. Reference the proposal or SOW for context.' },
      { q: 'How do I invoice web development milestones?', a: 'Split the project into milestones (deposit, design approved, launch) and bill each as its own invoice. Note the total contract value and amount billed to date so the client can track it.' },
      { q: 'How should I handle hosting or plugin costs on the invoice?', a: 'Pass them through as their own line items (e.g. "Annual hosting"), separate from your labor, so it is clear which costs are third-party.' },
    ],
  },
  {
    slug: 'personal-trainer', name: 'Personal Trainer', plural: 'personal trainers', cat: 'personal',
    intro: 'Bill sessions, packages, and monthly programming with a clear per-session or per-package rate. This personal trainer invoice template works for in-person and online coaching.',
    items: [
      { name: 'Training session package (10)', qty: 1, price: 650 },
      { name: 'Custom program design', qty: 1, price: 120 },
    ],
    taxrate: 0,
    aiPrompt: 'Invoice for a personal trainer: 10-session training package $650, custom program design $120, no tax, due on receipt.',
    faqs: [
      { q: 'What should a personal training invoice include?', a: 'Your name or business, the client, the package or number of sessions, the rate, the billing period, total, and payment terms. For packages, note how many sessions remain if you track that.' },
      { q: 'How do trainers usually bill — per session or per package?', a: 'Packages (e.g. 10 sessions) are most common because they lock in commitment and simplify billing. Per-session or monthly retainers also work; list them as line items.' },
      { q: 'Can I use this for online coaching invoices?', a: 'Yes — swap the session package for a monthly coaching or programming line. Save the client and duplicate the invoice each month to rebill quickly.' },
    ],
  },
  {
    slug: 'tutor', name: 'Tutor', plural: 'tutors', cat: 'personal',
    intro: 'Bill lessons by the hour or in prepaid blocks, with subject and dates clear for parents. This tutoring invoice template suits private tutors and small learning centers.',
    items: [
      { name: 'Math tutoring', qty: 8, price: 55, unit: 'hrs' },
      { name: 'Materials & practice sets', qty: 1, price: 30 },
    ],
    taxrate: 0,
    aiPrompt: 'Invoice for a tutor: 8 hours of math tutoring at $55/hr, materials and practice sets $30, no tax, billed monthly, due on receipt.',
    faqs: [
      { q: 'What should a tutoring invoice include?', a: 'Your name, the student/parent, the subject, the number of hours or sessions and the rate, the billing period, any materials, total, and payment terms. Listing session dates helps parents reconcile.' },
      { q: 'Should tutors bill per hour or in prepaid blocks?', a: 'Both are common. Hourly is simple; prepaid blocks (e.g. 10 hours) improve cash flow and commitment. Use a single line for the block or itemize hours.' },
      { q: 'How do I invoice a parent monthly for tutoring?', a: 'Total the month’s hours on one invoice with the rate and dates. Save the family in the generator and duplicate last month’s invoice to rebill in seconds.' },
    ],
  },
  {
    slug: 'consultant', name: 'Consultant', plural: 'consultants', cat: 'professional',
    intro: 'Bill advisory work by the hour, day, or retainer, with a clear scope reference and terms. This consulting invoice template suits independent consultants and small firms.',
    items: [
      { name: 'Strategy consulting', qty: 12, price: 150, unit: 'hrs' },
      { name: 'Report & recommendations', qty: 1, price: 800 },
    ],
    taxrate: 0,
    aiPrompt: 'Invoice for a consultant: 12 hours of strategy consulting at $150/hr, written report and recommendations $800, no tax, net 30.',
    faqs: [
      { q: 'What should a consulting invoice include?', a: 'Your name or firm, the client, the engagement or project reference, itemized hours/days or a retainer amount, any deliverables, total, and payment terms (net 15/30 is common). A PO number speeds up corporate payment.' },
      { q: 'Should consultants bill hourly, daily, or on retainer?', a: 'All three are standard. Hourly/daily suits project work; monthly retainers suit ongoing advisory. You can put a retainer and extra hours on the same invoice as separate lines.' },
      { q: 'What payment terms should a consultant use?', a: 'Net 15 or net 30 are typical; net 7 or due-on-receipt for smaller clients. Set the terms in the generator and add a late-fee note if you charge one.' },
    ],
  },
  {
    slug: 'roofing', name: 'Roofing', plural: 'roofers', cat: 'home',
    intro: 'Bill repairs and full replacements the way roofers price them — by the square, with tear-off, materials, and labor itemized. This roofing invoice template also handles insurance and deposit jobs.',
    items: [
      { name: 'Roof replacement — architectural shingles (22 sq)', qty: 1, price: 9900 },
      { name: 'Tear-off & disposal', qty: 1, price: 1400 },
      { name: 'Underlayment, flashing & vents', qty: 1, price: 650 },
    ],
    taxrate: 7,
    aiPrompt: 'Invoice for roofing: architectural shingle roof replacement 22 squares $9900, tear-off and disposal $1400, underlayment flashing and vents $650, 7% sales tax, 30% deposit paid, net 15.',
    faqs: [
      { q: 'What should a roofing invoice include?', a: 'Your business and license/insurance info, the customer and property address, the roof size (in squares), materials, tear-off/disposal, labor, any deposit, tax, total, and the workmanship warranty. Reference the estimate or insurance claim number.' },
      { q: 'How is roofing priced — per square or per job?', a: 'Roofers price by the "square" (100 sq ft), then add tear-off, underlayment, flashing, and disposal. This example shows a per-square replacement plus itemized extras; you can adjust for repairs.' },
      { q: 'How do I invoice a roofing insurance job?', a: 'Itemize to match the adjuster’s scope and reference the claim number. Bill the deductible to the homeowner and note any supplements. Keeping line items close to the estimate speeds approval.' },
    ],
  },
  {
    slug: 'flooring', name: 'Flooring', plural: 'flooring installers', cat: 'home',
    intro: 'Bill hardwood, LVP, tile, or carpet installs by the square foot, with prep and trim broken out. This flooring invoice template keeps materials and installation labor clear.',
    items: [
      { name: 'LVP flooring — installed', qty: 850, price: 4.5, unit: 'sq ft' },
      { name: 'Floor prep & underlayment', qty: 1, price: 600 },
      { name: 'Baseboard & transitions', qty: 1, price: 450 },
    ],
    taxrate: 7,
    aiPrompt: 'Invoice for flooring: 850 sq ft LVP installed at $4.50/sq ft, floor prep and underlayment $600, baseboard and transitions $450, 7% sales tax.',
    faqs: [
      { q: 'What should a flooring invoice include?', a: 'Your business name, the customer and job address, the material and square footage, the installed rate, prep and underlayment, trim/transitions, tax, and total. Note the product line if the customer selected it.' },
      { q: 'Do flooring installers bill materials and labor separately?', a: 'Often it’s billed "installed" at a per-square-foot rate that includes labor, with prep and trim as separate lines. You can also split material and labor — the generator supports both.' },
      { q: 'How do I handle furniture moving or old-floor removal?', a: 'Add them as their own line items (e.g. "Tear-out & haul-away", "Furniture moving") so the customer sees exactly what’s included.' },
    ],
  },
  {
    slug: 'pressure-washing', name: 'Pressure Washing', plural: 'pressure washing pros', cat: 'home',
    intro: 'Bill house washes, driveways, decks, and fleets by the job or square foot. This pressure washing invoice template suits one-off cleans and recurring commercial accounts.',
    items: [
      { name: 'House exterior soft wash', qty: 1, price: 275 },
      { name: 'Driveway & walkways', qty: 1, price: 150 },
      { name: 'Deck cleaning', qty: 1, price: 120 },
    ],
    taxrate: 6,
    aiPrompt: 'Invoice for pressure washing: house exterior soft wash $275, driveway and walkways $150, deck cleaning $120, 6% sales tax, due on receipt.',
    faqs: [
      { q: 'What should a pressure washing invoice include?', a: 'Your business name, the customer and service address, each surface cleaned as a line item, the service date, tax if applicable, and total. Note the method (soft wash vs. high pressure) for delicate surfaces.' },
      { q: 'Should pressure washing be billed per job or per square foot?', a: 'Residential is usually flat per surface (house, driveway, deck); large commercial flatwork is often per square foot. List each area separately either way.' },
      { q: 'How do I invoice recurring commercial cleaning?', a: 'Bill per visit or monthly. Save the client and duplicate the last invoice to reuse surfaces and rates — just update the date.' },
    ],
  },
  {
    slug: 'pest-control', name: 'Pest Control', plural: 'pest control techs', cat: 'home',
    intro: 'Bill one-time treatments and recurring service plans with the pest, method, and areas noted. This pest control invoice template fits residential and commercial accounts.',
    items: [
      { name: 'Initial pest treatment (interior & exterior)', qty: 1, price: 150 },
      { name: 'Quarterly service plan', qty: 1, price: 110 },
    ],
    taxrate: 6,
    aiPrompt: 'Invoice for pest control: initial interior and exterior treatment $150, quarterly service plan $110, 6% sales tax, net 15.',
    faqs: [
      { q: 'What should a pest control invoice include?', a: 'Your company and applicator license, the customer and property address, the treatment or plan, target pests, areas treated, the service date, tax, and total. Note any re-service guarantee.' },
      { q: 'How do I invoice a recurring pest control plan?', a: 'Bill the initial treatment, then each recurring visit (monthly or quarterly) as its own invoice. Save the client and duplicate to rebill each cycle.' },
      { q: 'Should the target pest be on the invoice?', a: 'Yes — a short note (ants, roaches, rodents, termites) documents the scope and helps with warranty or callback questions.' },
    ],
  },
  {
    slug: 'locksmith', name: 'Locksmith', plural: 'locksmiths', cat: 'home',
    intro: 'Bill lockouts, rekeys, and hardware installs with a service call plus parts and labor. This locksmith invoice template works for residential, automotive, and commercial jobs.',
    items: [
      { name: 'Service call', qty: 1, price: 75 },
      { name: 'Rekey locks', qty: 5, price: 20, unit: 'ea' },
      { name: 'Deadbolt install', qty: 1, price: 95 },
    ],
    taxrate: 7,
    aiPrompt: 'Invoice for a locksmith: service call $75, rekey 5 locks at $20 each, deadbolt install $95, 7% sales tax, due on receipt.',
    faqs: [
      { q: 'What should a locksmith invoice include?', a: 'Your business and license, the customer and location, the service call, hardware/parts, labor, tax, and total. For automotive or commercial work, note the vehicle or door count.' },
      { q: 'Should a locksmith charge a service-call fee?', a: 'Most do — a flat trip/service fee that may or may not roll into the job. Show it as its own line so the invoice is transparent.' },
      { q: 'How do I invoice a lockout vs. a rekey?', a: 'A lockout is usually a single flat line plus the service call; a rekey itemizes cylinders and any new hardware. This template does both.' },
    ],
  },
  {
    slug: 'appliance-repair', name: 'Appliance Repair', plural: 'appliance repair techs', cat: 'home',
    intro: 'Bill diagnostics, parts, and labor for refrigerators, washers, ovens, and more. This appliance repair invoice template separates the service call from parts and labor.',
    items: [
      { name: 'Service call / diagnostic', qty: 1, price: 89 },
      { name: 'Refrigerator compressor', qty: 1, price: 320 },
      { name: 'Labor', qty: 2, price: 95, unit: 'hrs' },
    ],
    taxrate: 7,
    aiPrompt: 'Invoice for appliance repair: service call and diagnostic $89, refrigerator compressor part $320, 2 hours labor at $95/hr, 7% sales tax.',
    faqs: [
      { q: 'What should an appliance repair invoice include?', a: 'Your business name, the customer, the appliance (make/model helps), the diagnostic fee, parts, labor, tax, total, and any parts/labor warranty. A short problem description avoids confusion.' },
      { q: 'Do you charge a diagnostic fee separately?', a: 'Usually yes — a flat diagnostic that may be waived if the customer proceeds. Show it as a line item; the generator lets you discount it if you roll it in.' },
      { q: 'Should the part number be on the invoice?', a: 'For warranty claims, yes — add the part and its number to the line or the notes so the customer has it on record.' },
    ],
  },
  {
    slug: 'tree-service', name: 'Tree Service', plural: 'tree services', cat: 'home',
    intro: 'Bill removals, trimming, and stump grinding with equipment and cleanup itemized. This tree service invoice template handles both emergency work and scheduled jobs.',
    items: [
      { name: 'Tree removal (large oak)', qty: 1, price: 1200 },
      { name: 'Stump grinding', qty: 1, price: 250 },
      { name: 'Haul-away & cleanup', qty: 1, price: 200 },
    ],
    taxrate: 6,
    aiPrompt: 'Invoice for tree service: large oak removal $1200, stump grinding $250, haul-away and cleanup $200, 6% sales tax, net 15.',
    faqs: [
      { q: 'What should a tree service invoice include?', a: 'Your business, license/insurance, the customer and property address, each service (removal, trimming, stump grinding), cleanup/haul-away, tax, and total. Note if permits or utility coordination were involved.' },
      { q: 'How is tree work priced?', a: 'By the job, based on size, access, and hazards. Big removals, stump grinding, and cleanup are typically separate lines — that’s how this example is set up.' },
      { q: 'Should cleanup and hauling be a separate line?', a: 'Yes — separating debris haul-away and cleanup from the removal itself keeps the invoice clear and lets customers opt out if they want to keep the wood.' },
    ],
  },
  {
    slug: 'pool-service', name: 'Pool Service', plural: 'pool techs', cat: 'home',
    intro: 'Bill recurring maintenance, one-off cleans, and equipment repairs with chemicals and parts itemized. This pool service invoice template suits weekly routes and repair calls.',
    items: [
      { name: 'Monthly pool maintenance', qty: 1, price: 160 },
      { name: 'Filter cleaning', qty: 1, price: 75 },
      { name: 'Chemicals', qty: 1, price: 45 },
    ],
    taxrate: 6,
    aiPrompt: 'Invoice for pool service: monthly pool maintenance $160, filter cleaning $75, chemicals $45, 6% sales tax, billed monthly.',
    faqs: [
      { q: 'What should a pool service invoice include?', a: 'Your business name, the customer and property address, the service plan or visit, chemicals and parts, the billing period, tax, and total. Note the number of visits covered for monthly plans.' },
      { q: 'How do I invoice a monthly pool maintenance plan?', a: 'Bill a flat monthly rate plus any extras (filter cleans, repairs) as separate lines. Save the client and duplicate the invoice each month to rebill.' },
      { q: 'Should chemicals be billed separately?', a: 'Some plans include chemicals; others bill them as used. Listing them as a line keeps pricing transparent when usage varies.' },
    ],
  },
  {
    slug: 'moving-company', name: 'Moving Company', plural: 'movers', cat: 'home',
    intro: 'Bill local moves by crew hours plus truck and materials, or long-distance by weight and distance. This moving invoice template keeps labor, transport, and supplies clear.',
    items: [
      { name: 'Moving crew (3 movers)', qty: 5, price: 150, unit: 'hrs' },
      { name: 'Truck & mileage', qty: 1, price: 120 },
      { name: 'Packing materials', qty: 1, price: 80 },
    ],
    taxrate: 0,
    aiPrompt: 'Invoice for a moving company: 3-mover crew for 5 hours at $150/hr, truck and mileage $120, packing materials $80, no tax, due on receipt.',
    faqs: [
      { q: 'What should a moving invoice include?', a: 'Your company and any DOT/license number, the customer, origin and destination, the crew size and hours (or weight and distance), truck/mileage, materials, tax if applicable, and total. Note valuation/insurance coverage.' },
      { q: 'How do movers usually charge?', a: 'Local moves are typically hourly by crew size plus a truck fee; long-distance is by weight and distance. This example is an hourly local move — adjust the lines for long-distance.' },
      { q: 'Should packing materials be itemized?', a: 'Yes — boxes, tape, and wrap as a materials line (or per-item) keeps the total transparent and lets customers supply their own.' },
    ],
  },
  {
    slug: 'junk-removal', name: 'Junk Removal', plural: 'junk removal pros', cat: 'home',
    intro: 'Bill by load size or volume with disposal fees passed through. This junk removal invoice template works for single pickups and recurring commercial hauls.',
    items: [
      { name: 'Junk removal — half truck load', qty: 1, price: 275 },
      { name: 'Disposal & dump fees', qty: 1, price: 60 },
    ],
    taxrate: 6,
    aiPrompt: 'Invoice for junk removal: half truck load $275, disposal and dump fees $60, 6% sales tax, due on receipt.',
    faqs: [
      { q: 'What should a junk removal invoice include?', a: 'Your business name, the customer and pickup address, the load size or volume, disposal/dump fees, the date, tax, and total. Note any heavy or hazardous items that carried a surcharge.' },
      { q: 'How is junk removal priced?', a: 'By volume — fractions of a truck load (¼, ½, full) — plus disposal fees. Surcharges apply to appliances, mattresses, and e-waste. Add those as line items.' },
      { q: 'Should dump fees be a separate line?', a: 'Passing disposal fees through as their own line explains the total and is fair when landfill costs vary by material.' },
    ],
  },
  {
    slug: 'auto-detailing', name: 'Auto Detailing', plural: 'auto detailers', cat: 'auto',
    intro: 'Bill interior, exterior, and full-detail packages with add-ons like ceramic coating. This auto detailing invoice template suits mobile detailers and shops.',
    items: [
      { name: 'Full detail (SUV)', qty: 1, price: 220 },
      { name: 'Ceramic wax add-on', qty: 1, price: 80 },
      { name: 'Pet hair removal', qty: 1, price: 40 },
    ],
    taxrate: 7,
    aiPrompt: 'Invoice for auto detailing: full detail on an SUV $220, ceramic wax add-on $80, pet hair removal $40, 7% sales tax, due on receipt.',
    faqs: [
      { q: 'What should an auto detailing invoice include?', a: 'Your business name, the customer, the vehicle (make/model/size), the package, any add-ons, the date, tax, and total. Vehicle size often changes the price, so note it.' },
      { q: 'Should detailing be priced by package or vehicle size?', a: 'Both — packages (interior, exterior, full) with pricing tiered by vehicle size (car, SUV, truck). List the package and any add-ons as separate lines.' },
      { q: 'How do I invoice mobile detailing?', a: 'Same as a shop, plus an optional travel/trip fee as its own line. Save the client and reuse the invoice for repeat customers.' },
    ],
  },
  {
    slug: 'auto-repair', name: 'Auto Repair', plural: 'mechanics', cat: 'auto',
    intro: 'Bill parts, labor hours, and shop supplies with a clear breakdown customers trust. This auto repair invoice template works for shops and mobile mechanics.',
    items: [
      { name: 'Brake pads & rotors (front)', qty: 1, price: 280 },
      { name: 'Labor', qty: 2, price: 110, unit: 'hrs' },
      { name: 'Shop supplies', qty: 1, price: 25 },
    ],
    taxrate: 8,
    aiPrompt: 'Invoice for auto repair: front brake pads and rotors $280, 2 hours labor at $110/hr, shop supplies $25, 8% sales tax.',
    faqs: [
      { q: 'What should an auto repair invoice include?', a: 'Your shop name, the customer and vehicle (year/make/model/VIN or plate), parts, labor hours and rate, shop supplies, tax, total, and any warranty. Reference the RO or estimate number.' },
      { q: 'Should parts and labor be listed separately?', a: 'Yes — customers (and warranties) expect parts itemized separately from labor hours. This template splits them, plus a shop-supplies line.' },
      { q: 'Do mechanics charge tax on labor?', a: 'It varies by state — some tax parts only, some both. Set the correct rate in the generator; it applies to the subtotal automatically.' },
    ],
  },
  {
    slug: 'videographer', name: 'Videographer', plural: 'videographers', cat: 'creative',
    intro: 'Bill shoots, editing, and deliverables with usage rights noted. This videography invoice template works for events, weddings, and commercial video.',
    items: [
      { name: 'Event videography — 4 hr coverage', qty: 1, price: 1200 },
      { name: 'Editing & highlight film', qty: 1, price: 500 },
      { name: 'Extra edited clips', qty: 3, price: 90, unit: 'ea' },
    ],
    taxrate: 0,
    aiPrompt: 'Invoice for a videographer: event videography 4 hours coverage $1200, editing and highlight film $500, 3 extra edited clips at $90 each, no tax, 50% deposit paid.',
    faqs: [
      { q: 'What should a videography invoice include?', a: 'Your business name, the client, the shoot date and type, deliverables (coverage hours, edited films, clips, formats), any deposit, usage/licensing terms, total, and the balance due.' },
      { q: 'How do I invoice a video deposit?', a: 'Bill the full package, then subtract the deposit so the invoice shows the remaining balance. Note the deposit amount and date, and whether it’s refundable.' },
      { q: 'Should licensing be on a video invoice?', a: 'For commercial work, yes — a usage line (personal, social, broadcast) in the notes sets expectations and protects your work.' },
    ],
  },
  {
    slug: 'freelance-writer', name: 'Freelance Writer', plural: 'freelance writers', cat: 'creative',
    intro: 'Bill articles, copy, and content by the piece, word, or project, with revisions noted. This freelance writing invoice template suits bloggers, copywriters, and ghostwriters.',
    items: [
      { name: 'Blog articles (1,000 words)', qty: 3, price: 220, unit: 'ea' },
      { name: 'SEO optimization', qty: 1, price: 150 },
    ],
    taxrate: 0,
    aiPrompt: 'Invoice for a freelance writer: 3 blog articles at $220 each, SEO optimization $150, no tax, net 14.',
    faqs: [
      { q: 'What should a freelance writing invoice include?', a: 'Your name, the client, the pieces delivered (with word count or topic), the rate (per piece, per word, or project), revisions, total, and payment terms. A PO or project reference speeds corporate payment.' },
      { q: 'Should writers bill per word or per project?', a: 'Both are common — per word for volume content, per project/piece for defined work. List each deliverable so the client sees exactly what they’re paying for.' },
      { q: 'How do I handle revisions on a writing invoice?', a: 'Note included revision rounds in the terms; bill extra rounds or out-of-scope rewrites as separate lines.' },
    ],
  },
  {
    slug: 'social-media-manager', name: 'Social Media Manager', plural: 'social media managers', cat: 'creative',
    intro: 'Bill monthly management, content, and ad spend with a clear retainer and deliverables. This social media invoice template suits freelancers and small agencies.',
    items: [
      { name: 'Social media management — monthly', qty: 1, price: 900 },
      { name: 'Content creation (12 posts)', qty: 1, price: 450 },
    ],
    taxrate: 0,
    aiPrompt: 'Invoice for a social media manager: monthly management retainer $900, content creation of 12 posts $450, no tax, net 15, billed monthly.',
    faqs: [
      { q: 'What should a social media invoice include?', a: 'Your name or agency, the client, the billing month, the retainer and deliverables (posts, platforms, reporting), any ad spend passed through, total, and terms.' },
      { q: 'How do I handle ad spend on the invoice?', a: 'Pass it through as its own line item, separate from your management fee, so it’s clear which cost is the platform’s and which is yours.' },
      { q: 'How do I bill a monthly retainer?', a: 'One recurring line for the retainer plus any extras. Save the client and duplicate last month’s invoice to rebill in seconds.' },
    ],
  },
  {
    slug: 'bookkeeper', name: 'Bookkeeper', plural: 'bookkeepers', cat: 'professional',
    intro: 'Bill monthly bookkeeping, catch-up work, and payroll with a clear scope. This bookkeeping invoice template suits independent bookkeepers and small firms.',
    items: [
      { name: 'Monthly bookkeeping', qty: 1, price: 400 },
      { name: 'Payroll processing', qty: 1, price: 120 },
    ],
    taxrate: 0,
    aiPrompt: 'Invoice for a bookkeeper: monthly bookkeeping $400, payroll processing $120, no tax, net 15, billed monthly.',
    faqs: [
      { q: 'What should a bookkeeping invoice include?', a: 'Your name or firm, the client, the service period, the services (monthly books, reconciliations, payroll, reports), total, and payment terms. Note the accounting platform if relevant.' },
      { q: 'Should bookkeepers bill monthly or hourly?', a: 'Fixed monthly pricing is most common for ongoing work; hourly suits catch-up or cleanup projects. You can list both a retainer and hourly extras.' },
      { q: 'How do I invoice catch-up bookkeeping?', a: 'Bill it as a separate project line (e.g. "Catch-up — 6 months") apart from the ongoing monthly fee, so the one-time cost is clear.' },
    ],
  },
  {
    slug: 'dog-groomer', name: 'Dog Groomer', plural: 'dog groomers', cat: 'personal',
    intro: 'Bill grooms and add-ons by breed or size, with recurring clients easy to rebill. This dog grooming invoice template suits mobile groomers and salons.',
    items: [
      { name: 'Full groom (large dog)', qty: 1, price: 85 },
      { name: 'Nail trim & ear cleaning', qty: 1, price: 20 },
      { name: 'De-shedding treatment', qty: 1, price: 25 },
    ],
    taxrate: 0,
    aiPrompt: 'Invoice for a dog groomer: full groom for a large dog $85, nail trim and ear cleaning $20, de-shedding treatment $25, no tax, due on receipt.',
    faqs: [
      { q: 'What should a dog grooming invoice include?', a: 'Your business name, the client and pet (name/breed/size), the groom package, add-ons, the date, total, and payment terms. Size and coat often change the price, so note them.' },
      { q: 'Should grooming be priced by breed or size?', a: 'Usually by size and coat type, with add-ons (nails, teeth, de-shedding) as separate lines. This template itemizes the groom plus add-ons.' },
      { q: 'How do I invoice recurring grooming clients?', a: 'Save the client and duplicate the last invoice each visit — same pet, same package — and just update the date.' },
    ],
  },
  {
    slug: 'massage-therapist', name: 'Massage Therapist', plural: 'massage therapists', cat: 'personal',
    intro: 'Bill sessions, packages, and add-ons with a clear per-session rate. This massage therapy invoice template suits mobile and studio-based therapists.',
    items: [
      { name: '60-minute deep tissue massage', qty: 2, price: 95, unit: 'ea' },
      { name: 'Hot stone add-on', qty: 1, price: 25 },
    ],
    taxrate: 0,
    aiPrompt: 'Invoice for a massage therapist: two 60-minute deep tissue massages at $95 each, hot stone add-on $25, no tax, due on receipt.',
    faqs: [
      { q: 'What should a massage therapy invoice include?', a: 'Your name and license, the client, the session type and length, add-ons, the date, total, and payment terms. If a client needs it for insurance/HSA, add your credentials and a service code.' },
      { q: 'Can clients use a massage invoice for HSA/FSA?', a: 'Often, with a clear itemized invoice showing your license, the service, and the date. Include those details and any required code in the notes.' },
      { q: 'How do I invoice a package of sessions?', a: 'Bill the package as one line (e.g. "5-session package") or itemize sessions. Save the client to rebill or track remaining sessions in the notes.' },
    ],
  },
];
