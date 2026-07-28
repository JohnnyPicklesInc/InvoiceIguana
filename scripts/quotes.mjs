// Data for "[trade] quote / estimate template" landing pages -> /quote.
// Same shape as an invoice trade (items/taxrate), but the copy and FAQs are
// estimate-framed (valid-until dates, deposits, "is it binding") so these are
// genuinely distinct from the invoice pages, not near-duplicates.

export const quotes = [
  {
    slug: 'general-contractor', name: 'General Contractor', plural: 'general contractors', cat: 'home',
    intro: 'Give clients a clear, professional estimate for remodels and larger projects, broken into labor, materials, and subs. This contractor quote template makes it easy to win the bid and set expectations.',
    items: [
      { name: 'Kitchen remodel — labor', qty: 1, price: 12000 },
      { name: 'Materials & fixtures', qty: 1, price: 6500 },
      { name: 'Cabinetry (supply & install)', qty: 1, price: 4200 },
    ],
    taxrate: 8,
    aiPrompt: 'Quote for a general contractor: kitchen remodel labor $12000, materials and fixtures $6500, cabinetry supply and install $4200, 8% tax, valid 30 days, 30% deposit to start.',
    faqs: [
      { q: 'What should a contractor estimate include?', a: 'Your company and license, the client and project address, a scope broken into labor, materials, and subcontractors, exclusions, the valid-until date, deposit terms, and the total. The clearer the scope, the fewer disputes later.' },
      { q: 'How long should a construction quote stay valid?', a: 'Most contractors set 14–30 days because material prices move. Put a "valid until" date on the estimate (the generator uses the due-date field for this) so old quotes don’t bind you to old pricing.' },
      { q: 'Is a contractor estimate legally binding?', a: 'An estimate is a proposal, not a contract, until both sides sign. Note that it becomes binding only on acceptance and a signed agreement, and that change orders may adjust the price.' },
    ],
  },
  {
    slug: 'roofing', name: 'Roofing', plural: 'roofers', cat: 'home',
    intro: 'Quote replacements and repairs the way roofers price them — by the square, with tear-off, materials, and labor spelled out. This roofing estimate template helps homeowners compare bids fairly.',
    items: [
      { name: 'Roof replacement — architectural shingles (22 sq)', qty: 1, price: 9900 },
      { name: 'Tear-off & disposal', qty: 1, price: 1400 },
      { name: 'Underlayment, flashing & vents', qty: 1, price: 650 },
    ],
    taxrate: 7,
    aiPrompt: 'Quote for roofing: architectural shingle replacement 22 squares $9900, tear-off and disposal $1400, underlayment flashing and vents $650, 7% tax, valid 30 days, deposit required.',
    faqs: [
      { q: 'What should a roofing estimate include?', a: 'Your business and insurance, the property, roof size in squares, shingle type, tear-off and disposal, flashing/vents, labor, the warranty, the valid-until date, and the total. Note whether it’s an insurance-scope or retail quote.' },
      { q: 'How long is a roofing quote good for?', a: 'Typically 15–30 days — shingle and material costs change. Set a valid-until date so you can re-price if the customer waits.' },
      { q: 'Do roofers ask for a deposit with the estimate?', a: 'Many collect a deposit on acceptance to order materials, with the balance on completion. State the deposit amount and schedule in the estimate terms.' },
    ],
  },
  {
    slug: 'painter', name: 'Painting', plural: 'painters', cat: 'home',
    intro: 'Give a clean estimate for interior or exterior work by room, square foot, or day, with prep and paint separated. This painting quote template makes it easy for customers to say yes.',
    items: [
      { name: 'Interior painting — whole house (5 rooms)', qty: 1, price: 2400 },
      { name: 'Paint & supplies', qty: 1, price: 520 },
      { name: 'Prep, patching & priming', qty: 1, price: 600 },
    ],
    taxrate: 6,
    aiPrompt: 'Quote for a painter: interior painting whole house 5 rooms $2400, paint and supplies $520, prep patching and priming $600, 6% tax, valid 21 days, 40% deposit.',
    faqs: [
      { q: 'What should a painting estimate include?', a: 'Your business, the customer and address, the areas and number of coats, prep work, paint brand/finish, labor, the valid-until date, deposit terms, and the total. Spell out what’s not included (e.g. major repairs).' },
      { q: 'Should a paint quote list prep separately?', a: 'Yes — prep, patching, and priming are where surprises hide. Listing them separately from painting labor sets expectations and justifies the price.' },
      { q: 'How long is a painting quote valid?', a: 'Usually 2–4 weeks. Add a valid-until date so seasonal demand or paint price changes don’t lock you into an old number.' },
    ],
  },
  {
    slug: 'landscaping', name: 'Landscaping', plural: 'landscapers', cat: 'home',
    intro: 'Quote design-build projects, cleanups, or seasonal contracts with materials and crew time itemized. This landscaping estimate template works for one-off installs and recurring service bids.',
    items: [
      { name: 'Landscape design & install', qty: 1, price: 4800 },
      { name: 'Plants & materials', qty: 1, price: 1600 },
      { name: 'Crew labor', qty: 20, price: 55, unit: 'hrs' },
    ],
    taxrate: 7,
    aiPrompt: 'Quote for landscaping: landscape design and install $4800, plants and materials $1600, 20 hours crew labor at $55/hr, 7% tax, valid 30 days, 25% deposit.',
    faqs: [
      { q: 'What should a landscaping estimate include?', a: 'Your business, the property, the scope (design, plants, hardscape, install), materials with quantities, crew hours, the valid-until date, deposit, and total. For maintenance contracts, note the visit schedule and term.' },
      { q: 'How do I quote a recurring lawn-care contract?', a: 'Quote a per-visit or monthly rate and the season length. Save the client and turn the accepted quote into invoices each cycle.' },
      { q: 'How long should a landscaping quote last?', a: 'Around 30 days — plant and material availability shifts. A valid-until date keeps pricing current.' },
    ],
  },
  {
    slug: 'flooring', name: 'Flooring', plural: 'flooring installers', cat: 'home',
    intro: 'Quote hardwood, LVP, tile, or carpet by the square foot with prep and trim broken out. This flooring estimate template helps customers compare installed pricing clearly.',
    items: [
      { name: 'LVP flooring — installed', qty: 850, price: 4.5, unit: 'sq ft' },
      { name: 'Floor prep & underlayment', qty: 1, price: 600 },
      { name: 'Tear-out & haul-away', qty: 1, price: 400 },
    ],
    taxrate: 7,
    aiPrompt: 'Quote for flooring: 850 sq ft LVP installed at $4.50/sq ft, floor prep and underlayment $600, tear-out and haul-away $400, 7% tax, valid 21 days.',
    faqs: [
      { q: 'What should a flooring estimate include?', a: 'Your business, the job address, the product and square footage, the installed rate, prep, tear-out, trim/transitions, the valid-until date, and the total. Note the product line and any waste allowance.' },
      { q: 'Should flooring be quoted per square foot?', a: 'Usually yes — an installed per-square-foot rate plus separate lines for prep, tear-out, and trim. That’s how this template is set up.' },
      { q: 'Is old-floor removal included in a flooring quote?', a: 'Not always — list "Tear-out & haul-away" as its own line so it’s clear whether the customer or you handle the old floor.' },
    ],
  },
  {
    slug: 'fencing', name: 'Fencing', plural: 'fence contractors', cat: 'home',
    intro: 'Quote fence installs by the linear foot with gates, posts, and removal itemized. This fencing estimate template covers wood, vinyl, and chain-link jobs.',
    items: [
      { name: 'Wood privacy fence — installed (150 linear ft)', qty: 150, price: 30, unit: 'ln ft' },
      { name: 'Gate (with hardware)', qty: 1, price: 350 },
      { name: 'Removal of old fence', qty: 1, price: 600 },
    ],
    taxrate: 7,
    aiPrompt: 'Quote for fencing: 150 linear feet of wood privacy fence installed at $30/ft, gate with hardware $350, removal of old fence $600, 7% tax, valid 30 days, deposit required.',
    faqs: [
      { q: 'What should a fencing estimate include?', a: 'Your business, the property, the fence type and linear footage, the per-foot installed rate, gates, old-fence removal, permits if needed, the valid-until date, deposit, and total.' },
      { q: 'How is fencing quoted — per foot or per job?', a: 'Per linear foot for the run, with gates and removal as separate lines. Terrain and post spacing affect the rate, so note the assumptions.' },
      { q: 'Who pulls the permit for a fence?', a: 'It varies — say in the estimate whether the permit and any HOA approval are included or the homeowner’s responsibility.' },
    ],
  },
  {
    slug: 'hvac', name: 'HVAC', plural: 'HVAC contractors', cat: 'home',
    intro: 'Quote system replacements and installs with equipment, materials, and labor spelled out. This HVAC estimate template helps homeowners compare bids and understand what’s included.',
    items: [
      { name: 'AC & furnace system replacement (3 ton)', qty: 1, price: 6800 },
      { name: 'Installation labor', qty: 1, price: 1800 },
      { name: 'Materials, refrigerant & disposal', qty: 1, price: 450 },
    ],
    taxrate: 8,
    aiPrompt: 'Quote for HVAC: 3-ton AC and furnace system replacement $6800, installation labor $1800, materials refrigerant and disposal $450, 8% tax, valid 30 days.',
    faqs: [
      { q: 'What should an HVAC estimate include?', a: 'Your company and license/EPA info, the property, the equipment (size, model, efficiency), installation labor, materials, permits, the warranty, the valid-until date, and total. Note any available rebates.' },
      { q: 'How long is an HVAC quote valid?', a: 'Usually 30 days — equipment pricing and rebates change. Set a valid-until date so you can re-quote if needed.' },
      { q: 'Should the equipment model be on the quote?', a: 'Yes — the size, model, and efficiency (SEER) let the customer compare bids accurately and check rebate eligibility.' },
    ],
  },
  {
    slug: 'concrete', name: 'Concrete', plural: 'concrete contractors', cat: 'home',
    intro: 'Quote driveways, patios, and slabs by the square foot with excavation and finishing itemized. This concrete estimate template makes flatwork bids easy to compare.',
    items: [
      { name: 'Concrete driveway — poured & finished (600 sq ft)', qty: 600, price: 9, unit: 'sq ft' },
      { name: 'Excavation & base prep', qty: 1, price: 1200 },
      { name: 'Reinforcement & sealing', qty: 1, price: 500 },
    ],
    taxrate: 7,
    aiPrompt: 'Quote for concrete: 600 sq ft driveway poured and finished at $9/sq ft, excavation and base prep $1200, reinforcement and sealing $500, 7% tax, valid 30 days.',
    faqs: [
      { q: 'What should a concrete estimate include?', a: 'Your business, the property, the square footage and thickness, excavation and base, reinforcement, finish type, the valid-until date, deposit, and total. Note the cure time and any weather contingencies.' },
      { q: 'Is concrete quoted per square foot?', a: 'Yes — a per-square-foot poured-and-finished rate, plus separate lines for excavation, base, and reinforcement, which vary by site.' },
      { q: 'How long is a concrete quote valid?', a: 'About 30 days — concrete and fuel prices move. A valid-until date keeps the number current.' },
    ],
  },
  {
    slug: 'bathroom-remodel', name: 'Bathroom Remodel', plural: 'remodelers', cat: 'home',
    intro: 'Quote a full bathroom remodel with demo, plumbing, tile, fixtures, and labor itemized. This remodel estimate template sets clear expectations before the work starts.',
    items: [
      { name: 'Demo & haul-away', qty: 1, price: 900 },
      { name: 'Plumbing & fixtures', qty: 1, price: 3200 },
      { name: 'Tile & labor', qty: 1, price: 4800 },
    ],
    taxrate: 8,
    aiPrompt: 'Quote for a bathroom remodel: demo and haul-away $900, plumbing and fixtures $3200, tile and labor $4800, 8% tax, valid 30 days, 30% deposit, allowances noted.',
    faqs: [
      { q: 'What should a bathroom remodel estimate include?', a: 'The scope by phase (demo, rough-in, tile, fixtures, finish), material allowances, labor, exclusions, the valid-until date, deposit and payment schedule, and the total. Allowances prevent surprises when the client picks finishes.' },
      { q: 'What is an allowance on a remodel quote?', a: 'A budgeted amount for items the client will select later (tile, fixtures, vanity). If they choose pricier options, the difference is a change order. Note allowances clearly in the estimate.' },
      { q: 'How much deposit for a remodel?', a: 'Commonly 25–35% to start, with progress payments by milestone. State the deposit and schedule so cash flow is agreed up front.' },
    ],
  },
  {
    slug: 'moving-company', name: 'Moving Company', plural: 'movers', cat: 'home',
    intro: 'Quote local moves by crew hours or long-distance by weight, with truck and materials itemized. This moving estimate template gives customers a clear, comparable number.',
    items: [
      { name: 'Moving crew (3 movers, est. 5 hrs)', qty: 5, price: 150, unit: 'hrs' },
      { name: 'Truck & mileage', qty: 1, price: 120 },
      { name: 'Packing materials', qty: 1, price: 80 },
    ],
    taxrate: 0,
    aiPrompt: 'Quote for a moving company: 3-mover crew estimated 5 hours at $150/hr, truck and mileage $120, packing materials $80, no tax, valid 14 days, binding estimate.',
    faqs: [
      { q: 'What should a moving estimate include?', a: 'Your company and DOT number, origin and destination, the crew size and estimated hours (or weight and distance), truck/mileage, materials, valuation/insurance, the valid-until date, and total. Say whether it’s binding or non-binding.' },
      { q: 'What’s a binding vs. non-binding moving estimate?', a: 'A binding estimate locks the price for the listed services; non-binding can change with actual time or weight. Mark which this is so the customer isn’t surprised on move day.' },
      { q: 'How long is a moving quote valid?', a: 'Often 1–2 weeks, especially in peak season when availability and pricing shift. Add a valid-until date.' },
    ],
  },
];
