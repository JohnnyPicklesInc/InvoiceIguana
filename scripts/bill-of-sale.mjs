// Data for "[type/state] bill of sale template" landing pages -> /bill-of-sale.
// Two long-tail axes the research flagged: item TYPE (car, boat…) and STATE.
// IMPORTANT: bill-of-sale requirements vary by state and item — the copy stays
// GENERAL and points people to their DMV rather than asserting specific law we
// might get wrong. Every page + the tool carry a "not legal advice" note.

export const billsOfSale = [
  // ---- by item type ----
  {
    slug: 'car', name: 'Car', cat: 'type',
    intro: 'Record a private car sale with the seller, buyer, vehicle details, price, and an as-is clause. Describe the sale and AI fills it in — then print or download a PDF for both parties to sign.',
    item: '2018 Honda Civic LX, VIN 2HGFC2F5XJH000000, blue, 62,140 miles', price: 15500,
    aiPrompt: 'Car bill of sale: seller sells a 2018 Honda Civic LX, VIN 2HGFC2F5XJH000000, blue, 62,140 miles, to the buyer for $15,500 cash, sold as-is.',
    faqs: [
      { q: 'What should a car bill of sale include?', a: 'The seller and buyer names and addresses, the vehicle (year, make, model, VIN, colour, and odometer reading), the sale price, the date, how it was paid, an "as-is" statement, and signature lines for both parties. The odometer disclosure matters for used cars.' },
      { q: 'Does a car bill of sale need to be notarized?', a: 'It depends on your state — some require notarization or a specific DMV form to transfer title, others don\'t. Check your state DMV before you sign. This template covers the core details every bill of sale needs.' },
      { q: 'Is a bill of sale the same as the title?', a: 'No. The title proves ownership and is what the buyer uses to register the car; the bill of sale is the record of the transaction. You usually need both — sign the title over and give a bill of sale as the receipt.' },
    ],
  },
  {
    slug: 'truck', name: 'Truck', cat: 'type',
    intro: 'Document a pickup or work-truck sale with VIN, mileage, price, and as-is terms. AI drafts it from a sentence; download a clean PDF for signatures.',
    item: '2015 Ford F-150 XLT, VIN 1FTEW1EF0FFA00000, silver, 88,000 miles', price: 18500,
    aiPrompt: 'Truck bill of sale: seller sells a 2015 Ford F-150 XLT, VIN 1FTEW1EF0FFA00000, silver, 88,000 miles, to the buyer for $18,500 cash, sold as-is.',
    faqs: [
      { q: 'What should a truck bill of sale include?', a: 'Seller and buyer details, the truck (year, make, model, VIN, colour, odometer), sale price, date, payment method, an as-is clause, and both signatures. Note any lien or that it\'s paid off.' },
      { q: 'Do I need a bill of sale to sell a truck privately?', a: 'It\'s strongly recommended even where not strictly required — it protects both sides by recording the price, date, and "sold as-is". Your state DMV may also require it for registration.' },
      { q: 'What is an odometer disclosure?', a: 'A statement of the truck\'s mileage at sale, required by federal law for most vehicles under a certain age. Put the reading in the description so it\'s on the record.' },
    ],
  },
  {
    slug: 'motorcycle', name: 'Motorcycle', cat: 'type',
    intro: 'Record a motorcycle sale with VIN, engine size, mileage, and price. Describe it and AI fills the form; print or save a PDF to sign.',
    item: '2019 Harley-Davidson Iron 883, VIN 1HD4LE2199B000000, black, 9,400 miles', price: 7800,
    aiPrompt: 'Motorcycle bill of sale: seller sells a 2019 Harley-Davidson Iron 883, VIN 1HD4LE2199B000000, black, 9,400 miles, to the buyer for $7,800 cash, as-is.',
    faqs: [
      { q: 'What should a motorcycle bill of sale include?', a: 'Seller and buyer, the bike (year, make, model, VIN, engine size, colour, mileage), price, date, payment, an as-is clause, and signatures. VIN and mileage are the key identifiers.' },
      { q: 'Does a motorcycle bill of sale need a witness or notary?', a: 'Some states require a notary or witness for vehicle transfers, others don\'t. Check your state DMV; the template leaves signature lines for both parties (and a witness if you want one).' },
      { q: 'Can I use this if the title is missing?', a: 'You can still record the sale, but the buyer will usually need the title (or a replacement) to register the bike. Note the title status in the terms.' },
    ],
  },
  {
    slug: 'boat', name: 'Boat', cat: 'type',
    intro: 'Document a boat sale with the hull ID number (HIN), make, length, motor, and price. AI drafts it; download a PDF for both parties.',
    item: '2016 Bayliner VR5, HIN BIYV12A5D616, 20 ft, 150hp Mercury outboard, with trailer', price: 22000,
    aiPrompt: 'Boat bill of sale: seller sells a 2016 Bayliner VR5, HIN BIYV12A5D616, 20ft, 150hp Mercury outboard, with trailer, to the buyer for $22,000, as-is.',
    faqs: [
      { q: 'What should a boat bill of sale include?', a: 'Seller and buyer, the boat (year, make, model, length, hull ID number/HIN, motor), the trailer if included, price, date, payment, an as-is clause, and signatures. The HIN is the boat\'s equivalent of a VIN.' },
      { q: 'Is the trailer included in a boat bill of sale?', a: 'Only if you say so — a trailer is often a separate titled item. List it (with its VIN) in the description if it\'s part of the sale, or do a separate bill of sale for it.' },
      { q: 'Do I need to register the boat after buying it?', a: 'Usually yes, with your state\'s boating/DMV agency, and the bill of sale is often required. Requirements vary by state and boat size — check locally.' },
    ],
  },
  {
    slug: 'rv', name: 'RV', cat: 'type',
    intro: 'Record a motorhome or travel-trailer sale with VIN, length, mileage, and price. Describe it and AI fills it in; save a PDF to sign.',
    item: '2017 Winnebago Minnie 2401RG travel trailer, VIN 5B4MP67G5H3000000, 24 ft', price: 21500,
    aiPrompt: 'RV bill of sale: seller sells a 2017 Winnebago Minnie 2401RG travel trailer, VIN 5B4MP67G5H3000000, 24ft, to the buyer for $21,500, as-is.',
    faqs: [
      { q: 'What should an RV bill of sale include?', a: 'Seller and buyer, the RV (year, make, model, VIN, length, and mileage for a motorhome), price, date, payment, an as-is clause, and signatures. For a motorhome include the odometer; for a towable, the length and VIN.' },
      { q: 'Is a motorhome different from a travel trailer on a bill of sale?', a: 'The document is the same; a motorhome adds an odometer/mileage line (it\'s self-powered), while a towable trailer doesn\'t. The description field handles both.' },
      { q: 'Do I need a bill of sale to register an RV?', a: 'Often yes, along with the title. Requirements vary by state and RV type — check your DMV.' },
    ],
  },
  {
    slug: 'trailer', name: 'Trailer', cat: 'type',
    intro: 'Document a utility, cargo, or boat-trailer sale with VIN, size, and price. AI drafts it from a short description; print or download.',
    item: '2020 utility trailer, 6x12, VIN 4YMUL1212L1000000, single axle', price: 1800,
    aiPrompt: 'Trailer bill of sale: seller sells a 2020 6x12 single-axle utility trailer, VIN 4YMUL1212L1000000, to the buyer for $1,800 cash, as-is.',
    faqs: [
      { q: 'What should a trailer bill of sale include?', a: 'Seller and buyer, the trailer (year, type, size, VIN, axle count), price, date, payment, an as-is clause, and signatures. Homemade trailers may need an extra state form to get a VIN assigned.' },
      { q: 'Does a small utility trailer need a title?', a: 'It varies — some states title all trailers, others exempt small ones under a weight limit. Check your DMV; a bill of sale is still worth keeping either way.' },
      { q: 'Can I sell a homemade trailer with a bill of sale?', a: 'Yes, but the buyer may need to get a state-assigned VIN and inspection to register it. Note it\'s homemade in the description.' },
    ],
  },
  {
    slug: 'atv', name: 'ATV', cat: 'type',
    intro: 'Record an ATV, UTV, or side-by-side sale with VIN, make, hours/mileage, and price. Describe it and AI fills the form to print.',
    item: '2018 Polaris Sportsman 570, VIN 4XASXA575JB000000, green, 320 hours', price: 5200,
    aiPrompt: 'ATV bill of sale: seller sells a 2018 Polaris Sportsman 570, VIN 4XASXA575JB000000, green, 320 hours, to the buyer for $5,200 cash, as-is.',
    faqs: [
      { q: 'What should an ATV bill of sale include?', a: 'Seller and buyer, the ATV/UTV (year, make, model, VIN, hours or mileage), price, date, payment, an as-is clause, and signatures. Hours matter more than mileage for many off-road machines.' },
      { q: 'Do ATVs need a title or bill of sale?', a: 'Titling rules vary by state; many require a bill of sale for registration or trail permits even when a title isn\'t issued. Check your state.' },
      { q: 'Should I note "off-road use only"?', a: 'If relevant, add it to the terms so the buyer understands the machine isn\'t street-legal.' },
    ],
  },
  {
    slug: 'firearm', name: 'Firearm', cat: 'type',
    intro: 'Record a private firearm sale with make, model, calibre, and serial number for your records. AI drafts the document; print for both parties. Always follow your federal, state, and local laws.',
    item: 'Smith & Wesson M&P Shield 9mm pistol, serial HXA0000', price: 350,
    aiPrompt: 'Firearm bill of sale: seller sells a Smith & Wesson M&P Shield 9mm pistol, serial HXA0000, to the buyer for $350 cash, as-is, both parties legally eligible.',
    faqs: [
      { q: 'What should a firearm bill of sale include?', a: 'Seller and buyer names, the firearm (make, model, type, calibre, and serial number), price, date, and signatures. Many people add a line that both parties are legally eligible and not prohibited.' },
      { q: 'Is a bill of sale enough for a private gun sale?', a: 'A bill of sale is a personal record, not a substitute for the law. Private-sale rules — background checks, permits, in-state requirements, and prohibited buyers — vary widely by state and are also governed by federal law. Follow every applicable law; when in doubt, use a licensed dealer (FFL).' },
      { q: 'Do I have to keep a record of a private firearm sale?', a: 'Requirements vary by state; keeping a signed bill of sale with the serial number protects you by documenting who you sold to and when. It is not legal advice — check your state\'s rules.' },
    ],
  },
  // ---- by state (general framing — always defer specific rules to the DMV) ----
  {
    slug: 'texas', name: 'Texas', cat: 'state',
    intro: 'Make a Texas bill of sale for a car, boat, or general item — the core record of a private sale. Describe it and AI fills it in; print or download a PDF to sign. General template, not legal advice — check the Texas DMV/TxDMV for title and registration steps.',
    item: '2018 Honda Civic LX, VIN 2HGFC2F5XJH000000, 62,140 miles', price: 15500,
    aiPrompt: 'Texas car bill of sale: seller in Austin, TX sells a 2018 Honda Civic LX, VIN 2HGFC2F5XJH000000, 62,140 miles, to the buyer for $15,500 cash, as-is.',
    faqs: [
      { q: 'What does a Texas bill of sale need?', a: 'The seller and buyer, the item (for a vehicle: year, make, model, VIN, odometer), price, date, payment, an as-is clause, and signatures. For vehicle title transfer and registration, the TxDMV also has its own forms — check their site.' },
      { q: 'Does a Texas bill of sale need to be notarized?', a: 'Requirements can vary by transaction and county; confirm with the Texas DMV/TxDMV before you sign. This template covers the core details a bill of sale needs.' },
      { q: 'How do I transfer a car title in Texas?', a: 'You generally sign over the title and submit the TxDMV\'s transfer paperwork at the county tax office. The bill of sale documents the sale price and date. Check TxDMV for the current steps and fees.' },
    ],
  },
  {
    slug: 'california', name: 'California', cat: 'state',
    intro: 'Make a California bill of sale for a private car, boat, or general sale. Describe the deal and AI drafts it; download a PDF to sign. General template, not legal advice — the California DMV handles title transfer and has its own forms.',
    item: '2018 Honda Civic LX, VIN 2HGFC2F5XJH000000, 62,140 miles', price: 15500,
    aiPrompt: 'California car bill of sale: seller sells a 2018 Honda Civic LX, VIN 2HGFC2F5XJH000000, 62,140 miles, to the buyer for $15,500 cash, as-is.',
    faqs: [
      { q: 'What does a California bill of sale need?', a: 'Seller and buyer, the item (vehicle: year, make, model, VIN, odometer), price, date, payment, an as-is clause, and signatures. The California DMV also has a Vehicle/Vessel Transfer form (REG 262) and title requirements — check dmv.ca.gov.' },
      { q: 'Is a bill of sale required to sell a car in California?', a: 'The DMV manages the actual title transfer with its own forms; a bill of sale is a useful record of the price and terms. Check the California DMV for exactly what they require.' },
      { q: 'Does California require smog certification on a private sale?', a: 'Often yes for many used vehicles, with exceptions. That\'s a DMV/state rule separate from the bill of sale — verify at dmv.ca.gov.' },
    ],
  },
  {
    slug: 'florida', name: 'Florida', cat: 'state',
    intro: 'Make a Florida bill of sale for a car, boat, or general item. AI fills it in from a description; print or save a PDF. General template, not legal advice — the Florida DHSMV handles title and registration.',
    item: '2018 Honda Civic LX, VIN 2HGFC2F5XJH000000, 62,140 miles', price: 15500,
    aiPrompt: 'Florida car bill of sale: seller sells a 2018 Honda Civic LX, VIN 2HGFC2F5XJH000000, 62,140 miles, to the buyer for $15,500 cash, as-is.',
    faqs: [
      { q: 'What does a Florida bill of sale need?', a: 'Seller and buyer, the item (vehicle: year, make, model, VIN, odometer), price, date, payment, an as-is clause, and signatures. Florida\'s DHSMV also has a Notice of Sale/bill of sale form (HSMV 82050) and title steps — check flhsmv.gov.' },
      { q: 'Does a Florida bill of sale need to be notarized?', a: 'It can depend on the transaction; confirm with the Florida DHSMV. Notarizing signatures never hurts as extra proof.' },
      { q: 'What is a Notice of Sale in Florida?', a: 'A form telling the state you sold a vehicle so liability transfers. It\'s separate from — and complements — a bill of sale. See flhsmv.gov.' },
    ],
  },
  {
    slug: 'new-york', name: 'New York', cat: 'state',
    intro: 'Make a New York bill of sale for a private car, boat, or general sale. Describe it and AI drafts it; download a PDF to sign. General template, not legal advice — the NY DMV has its own bill-of-sale form and title steps.',
    item: '2018 Honda Civic LX, VIN 2HGFC2F5XJH000000, 62,140 miles', price: 15500,
    aiPrompt: 'New York car bill of sale: seller sells a 2018 Honda Civic LX, VIN 2HGFC2F5XJH000000, 62,140 miles, to the buyer for $15,500 cash, as-is.',
    faqs: [
      { q: 'What does a New York bill of sale need?', a: 'Seller and buyer, the item (vehicle: year, make, model, VIN, odometer), price, date, payment, an as-is clause, and signatures. New York\'s DMV provides its own bill of sale (MV-912) — check dmv.ny.gov for title and sales-tax forms.' },
      { q: 'Do I need the DMV\'s bill of sale form in New York?', a: 'The DMV\'s MV-912 is commonly used for vehicle transfers and sales-tax purposes; this template captures the same core details. Check dmv.ny.gov for what they require at registration.' },
      { q: 'Is sales tax handled on the bill of sale?', a: 'The sale price on the bill of sale is used to calculate sales tax at registration, but tax itself is paid to the DMV. Verify current rules at dmv.ny.gov.' },
    ],
  },
  {
    slug: 'pennsylvania', name: 'Pennsylvania', cat: 'state',
    intro: 'Make a Pennsylvania bill of sale for a car, boat, or general item. AI fills it in; print or save a PDF to sign. General template, not legal advice — PennDOT handles title transfer.',
    item: '2018 Honda Civic LX, VIN 2HGFC2F5XJH000000, 62,140 miles', price: 15500,
    aiPrompt: 'Pennsylvania car bill of sale: seller sells a 2018 Honda Civic LX, VIN 2HGFC2F5XJH000000, 62,140 miles, to the buyer for $15,500 cash, as-is.',
    faqs: [
      { q: 'What does a Pennsylvania bill of sale need?', a: 'Seller and buyer, the item (vehicle: year, make, model, VIN, odometer), price, date, payment, an as-is clause, and signatures. PennDOT handles the actual title transfer and may require notarization on some forms — check dmv.pa.gov.' },
      { q: 'Does Pennsylvania require a notary for vehicle sales?', a: 'Pennsylvania is known for notarizing certain vehicle paperwork; confirm the current requirement with PennDOT before you sign the transfer forms.' },
      { q: 'Is a bill of sale enough to register a car in PA?', a: 'You\'ll generally need the signed title and PennDOT\'s transfer forms too; the bill of sale records the price and terms. Check dmv.pa.gov.' },
    ],
  },
  {
    slug: 'ohio', name: 'Ohio', cat: 'state',
    intro: 'Make an Ohio bill of sale for a private car, boat, or general sale. Describe it and AI drafts it; download a PDF. General template, not legal advice — the Ohio BMV handles title transfer.',
    item: '2018 Honda Civic LX, VIN 2HGFC2F5XJH000000, 62,140 miles', price: 15500,
    aiPrompt: 'Ohio car bill of sale: seller sells a 2018 Honda Civic LX, VIN 2HGFC2F5XJH000000, 62,140 miles, to the buyer for $15,500 cash, as-is.',
    faqs: [
      { q: 'What does an Ohio bill of sale need?', a: 'Seller and buyer, the item (vehicle: year, make, model, VIN, odometer), price, date, payment, an as-is clause, and signatures. In Ohio, vehicle titles are transferred at a County Clerk of Courts Title Office — check the Ohio BMV.' },
      { q: 'Does an Ohio car title need to be notarized?', a: 'Ohio has historically required the seller\'s signature on the title to be notarized; confirm the current rule with the Ohio BMV / title office before signing.' },
      { q: 'Where do I transfer a title in Ohio?', a: 'At a County Clerk of Courts Title Office, with the signed title and the bill of sale as your record of the sale. See the Ohio BMV site for steps and fees.' },
    ],
  },
];
