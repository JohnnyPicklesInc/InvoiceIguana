// Data for "[type] receipt template" landing pages -> /receipt.
// Receipts use the receipt shape (merchant, items, tax, optional tip, payment,
// footer) — no seller/buyer. Types are chosen for real search intent (rent,
// cash, donation, etc.); each has distinct copy + FAQs.

export const receipts = [
  {
    slug: 'rent', name: 'Rent', noun: 'rent receipt', cat: 'housing',
    intro: 'Give tenants proof of payment with a clean rent receipt showing the amount, period, and method. This rent receipt template is what landlords and property managers use each month.',
    merchant: 'Maple Street Apartments', items: [{ name: 'Rent — July 2026', qty: 1, price: 1500 }],
    taxrate: 0, payment: 'Bank transfer', footer: 'Received with thanks. Balance: $0.00',
    aiPrompt: 'Receipt from Maple Street Apartments to a tenant for July 2026 rent $1500, paid by bank transfer, no tax, footer "Received with thanks."',
    faqs: [
      { q: 'What should a rent receipt include?', a: 'The landlord or property name, the tenant, the amount paid, the rental period (month), the date received, the payment method, and the remaining balance if any. A receipt number helps you track it.' },
      { q: 'Are landlords required to give rent receipts?', a: 'In many states, yes — especially for cash payments or on request. Even where it’s optional, issuing receipts protects both sides. Check your local landlord-tenant rules.' },
      { q: 'How do I write a rent receipt?', a: 'Enter your property as the "merchant", add a line like "Rent — [month]", set the amount and payment method, and note zero balance. Save the tenant to reissue quickly next month.' },
    ],
  },
  {
    slug: 'cash', name: 'Cash', noun: 'cash receipt', cat: 'general',
    intro: 'Give a simple, professional proof of a cash payment. This cash receipt template works for any business or individual accepting cash for goods or services.',
    merchant: 'Your Business', items: [{ name: 'Payment received', qty: 1, price: 500 }],
    taxrate: 0, payment: 'Cash', footer: 'Paid in full — thank you.',
    aiPrompt: 'Cash receipt from your business for a $500 payment received in cash, no tax, footer "Paid in full — thank you."',
    faqs: [
      { q: 'What should a cash receipt include?', a: 'Who received the payment, who paid, the amount, what it was for, the date, and "paid in cash". A receipt number and signature line add a paper trail for cash, which has no bank record.' },
      { q: 'Why give a receipt for a cash payment?', a: 'Cash leaves no automatic record, so a receipt is the proof both sides rely on. It protects you against "I already paid" disputes and helps with bookkeeping and taxes.' },
      { q: 'Is a handwritten cash receipt valid?', a: 'Yes, but a clear itemized receipt with your business name and a number looks more professional and is easier to reconcile. This template gives you that in seconds.' },
    ],
  },
  {
    slug: 'sales', name: 'Sales', noun: 'sales receipt', cat: 'retail',
    intro: 'Give customers an itemized proof of purchase with tax and payment method. This sales receipt template suits shops, market stalls, and small retailers.',
    merchant: 'Corner Market', items: [
      { name: 'Coffee beans (12 oz)', qty: 2, price: 14 },
      { name: 'Ceramic mug', qty: 1, price: 18 },
    ],
    taxrate: 8, payment: 'Visa •1234', footer: 'Thanks for shopping with us! Returns within 30 days with receipt.',
    aiPrompt: 'Sales receipt from Corner Market: 2 bags of coffee beans at $14, one ceramic mug $18, 8% sales tax, paid Visa ending 1234, footer with a 30-day return policy.',
    faqs: [
      { q: 'What should a sales receipt include?', a: 'The store name, the date, itemized products with prices, subtotal, tax, total, the payment method, and your return policy. A receipt number helps with returns and bookkeeping.' },
      { q: 'What’s the difference between a sales receipt and an invoice?', a: 'A receipt proves a completed, paid transaction; an invoice is a request for payment before it’s paid. If money has changed hands, you want a receipt.' },
      { q: 'Do I need to show tax on a sales receipt?', a: 'If you collect sales tax, yes — showing the tax line separately is expected and often required. Set your rate in the generator and it calculates automatically.' },
    ],
  },
  {
    slug: 'donation', name: 'Donation', noun: 'donation receipt', cat: 'nonprofit',
    intro: 'Give donors the receipt they need for tax purposes, with your nonprofit’s details and the required disclosure. This donation receipt template suits charities and 501(c)(3) organizations.',
    merchant: 'Helping Hands Foundation', items: [{ name: 'Charitable donation', qty: 1, price: 250 }],
    taxrate: 0, payment: 'Credit card',
    footer: 'No goods or services were provided in exchange for this contribution. Helping Hands Foundation is a 501(c)(3) nonprofit. Tax ID: 00-0000000.',
    aiPrompt: 'Donation receipt from Helping Hands Foundation, a 501(c)(3) nonprofit, for a $250 charitable donation paid by credit card, no tax, with a footer stating no goods or services were provided and the tax ID.',
    faqs: [
      { q: 'What does a donation receipt need for taxes?', a: 'Your organization’s name, the donor, the amount (or a description of non-cash gifts), the date, and a statement of whether any goods or services were provided in return. For 501(c)(3)s, include your tax ID.' },
      { q: 'When is a donation receipt required?', a: 'The IRS requires a written acknowledgment for any single donation of $250 or more, and donors need one to claim a deduction. Issuing receipts for all gifts is good practice.' },
      { q: 'What is the "no goods or services" statement?', a: 'If the donor got nothing in return, the receipt must say so — that confirms the full amount is deductible. If they received something (a gala dinner, merch), you note its value instead.' },
    ],
  },
  {
    slug: 'deposit', name: 'Deposit', noun: 'deposit receipt', cat: 'housing',
    intro: 'Document a security deposit, down payment, or booking deposit with the amount and terms. This deposit receipt template protects both sides when money is held.',
    merchant: 'Maple Street Apartments', items: [{ name: 'Security deposit', qty: 1, price: 1500 }],
    taxrate: 0, payment: 'Check #1042', footer: 'Held per the lease agreement and refundable subject to its terms.',
    aiPrompt: 'Deposit receipt from Maple Street Apartments for a $1500 security deposit paid by check #1042, no tax, footer noting it is held per the lease and refundable subject to its terms.',
    faqs: [
      { q: 'What should a deposit receipt include?', a: 'Who received it, who paid, the amount, what the deposit is for, the date, the payment method, and the terms for holding or refunding it. A reference to the lease or contract ties it to the agreement.' },
      { q: 'Why give a receipt for a security deposit?', a: 'It proves the amount and date the deposit was paid — essential when it’s time to return it or resolve a dispute. Many jurisdictions also require written acknowledgment.' },
      { q: 'Is a deposit receipt the same as a rent receipt?', a: 'No — a deposit is held and often refundable, while rent is a payment for occupancy. Keep them as separate receipts so the records are clear.' },
    ],
  },
  {
    slug: 'payment', name: 'Payment', noun: 'payment receipt', cat: 'general',
    intro: 'Confirm a payment against an invoice or balance with a clean proof-of-payment. This payment receipt template is what to send once a client has paid.',
    merchant: 'Your Business', items: [{ name: 'Payment for invoice #1042', qty: 1, price: 800 }],
    taxrate: 0, payment: 'Bank transfer', footer: 'Paid in full. Thank you!',
    aiPrompt: 'Payment receipt from your business confirming an $800 payment for invoice #1042 by bank transfer, no tax, footer "Paid in full. Thank you!"',
    faqs: [
      { q: 'What should a payment receipt include?', a: 'Your business, the payer, the amount, what it paid for (e.g. the invoice number), the date, the method, and the remaining balance (zero if paid in full). A receipt number ties it to your records.' },
      { q: 'What’s the difference between a payment receipt and an invoice?', a: 'An invoice asks for payment; a payment receipt confirms it was received. Send the invoice first, then a receipt once the client pays.' },
      { q: 'Should a receipt reference the invoice number?', a: 'Yes — linking the receipt to the original invoice number makes reconciliation easy for both sides and closes the loop cleanly.' },
    ],
  },
  {
    slug: 'service', name: 'Service', noun: 'service receipt', cat: 'general',
    intro: 'Give customers proof of a completed service with the work and payment shown. This service receipt template suits contractors, repair techs, and any service business.',
    merchant: 'Ace Home Services', items: [
      { name: 'Service call', qty: 1, price: 89 },
      { name: 'Repair labor', qty: 2, price: 95, unit: 'hrs' },
    ],
    taxrate: 7, payment: 'Card on file', footer: 'Work completed and paid — thank you. 30-day workmanship guarantee.',
    aiPrompt: 'Service receipt from Ace Home Services: service call $89, 2 hours of repair labor at $95/hr, 7% tax, paid by card on file, footer with a 30-day workmanship guarantee.',
    faqs: [
      { q: 'What should a service receipt include?', a: 'Your business, the customer, the services performed, labor and parts, tax, total, the date, the payment method, and any guarantee. A short description of the work avoids "what was this for?" later.' },
      { q: 'Is a service receipt different from an invoice?', a: 'A service invoice requests payment for work; a service receipt confirms the work is done and paid. Use the receipt as the customer’s proof after they pay.' },
      { q: 'Should a service receipt mention a warranty?', a: 'If you guarantee the work, put it in the footer — it reassures the customer and documents the coverage in case of a callback.' },
    ],
  },
  {
    slug: 'restaurant', name: 'Restaurant', noun: 'restaurant receipt', cat: 'food',
    intro: 'Produce an itemized restaurant receipt with tax, tip, and payment for diners or expense reports. This restaurant receipt template works for cafés, food trucks, and small eateries.',
    merchant: 'The Corner Bistro', items: [
      { name: 'Margherita pizza', qty: 1, price: 16 },
      { name: 'Caesar salad', qty: 1, price: 11 },
      { name: 'Iced tea', qty: 2, price: 3.5 },
    ],
    taxrate: 8, tip: 6, payment: 'Visa •1234', footer: 'Thanks for dining with us!',
    aiPrompt: 'Restaurant receipt from The Corner Bistro: margherita pizza $16, caesar salad $11, two iced teas at $3.50, 8% tax, $6 tip, paid Visa ending 1234, footer "Thanks for dining with us!"',
    faqs: [
      { q: 'What should a restaurant receipt include?', a: 'The restaurant name, the date, itemized food and drinks, subtotal, tax, tip, total, and the payment method. Diners often need the itemized version for expense reports or reimbursement.' },
      { q: 'How do I add a tip to a receipt?', a: 'A tip is a flat amount added after tax. In the generator, enter the tip amount and the total updates automatically — the receipt total already includes it.' },
      { q: 'Do I need an itemized receipt for a business meal?', a: 'For expense reports and taxes, an itemized receipt (not just the card slip) is usually required. This template itemizes each item, tax, and tip.' },
    ],
  },
  {
    slug: 'hotel', name: 'Hotel', noun: 'hotel receipt', cat: 'travel',
    intro: 'Give guests an itemized hotel receipt with room nights, fees, and tax for their expense reports. This hotel receipt (folio) template suits inns, motels, and short-term rentals.',
    merchant: 'Grandview Hotel', items: [
      { name: 'Room — 2 nights', qty: 2, price: 145 },
      { name: 'Parking', qty: 2, price: 20 },
    ],
    taxrate: 12, payment: 'Amex •1005', footer: 'Thank you for your stay. Balance: $0.00',
    aiPrompt: 'Hotel receipt from Grandview Hotel: room for 2 nights at $145/night, parking 2 nights at $20, 12% occupancy tax, paid Amex ending 1005, footer "Thank you for your stay."',
    faqs: [
      { q: 'What should a hotel receipt include?', a: 'The hotel name, the guest, check-in/out dates, itemized room nights and fees, taxes, the total, and the payment method with a zero balance. Guests need this itemized "folio" for reimbursement.' },
      { q: 'Why is a hotel receipt called a folio?', a: 'A folio is the itemized guest account — room charges, taxes, and extras like parking or dining. An itemized folio is what employers and the IRS accept for travel expenses.' },
      { q: 'What tax is on a hotel receipt?', a: 'Lodging or occupancy tax, which is often higher than regular sales tax and varies by city. Set the correct rate in the generator; this example uses 12%.' },
    ],
  },
  {
    slug: 'itemized', name: 'Itemized', noun: 'itemized receipt', cat: 'general',
    intro: 'Produce a clear itemized receipt listing each item, tax, and total for reimbursement, HSA/FSA, or records. This itemized receipt template works for any purchase that needs a line-by-line breakdown.',
    merchant: 'Your Business', items: [
      { name: 'Office supplies', qty: 1, price: 42 },
      { name: 'Printer paper (case)', qty: 2, price: 38 },
      { name: 'USB drives (pack)', qty: 1, price: 24 },
    ],
    taxrate: 7, payment: 'Mastercard •7788', footer: 'Thank you for your purchase.',
    aiPrompt: 'Itemized receipt: office supplies $42, two cases of printer paper at $38, a pack of USB drives $24, 7% tax, paid Mastercard ending 7788.',
    faqs: [
      { q: 'What makes a receipt "itemized"?', a: 'It lists each item or service separately with its price, then shows subtotal, tax, and total — rather than a single lump sum. Itemization is what reimbursement, HSA/FSA, and tax records require.' },
      { q: 'Why do I need an itemized receipt for reimbursement?', a: 'Employers and benefit accounts need to see exactly what was purchased, not just a total, to confirm it’s eligible. A card slip alone usually isn’t enough.' },
      { q: 'How do I make an itemized receipt?', a: 'Add each item as its own line with quantity and price, set the tax, and the generator totals it. Download a PDF or share a link — no signup.' },
    ],
  },
];
