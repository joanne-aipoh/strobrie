// Paid ticketed events (pottery sessions, workshops) are built and sit ready in
// the database, but they stay off the public Events page until online card
// payment is actually live — right now the server is on a Paystack *test* key,
// so a "Book Spot" button would send customers to a checkout they can't pay on.
// Flip this to true the moment the live Paystack key is set, and every ready
// ticketed event appears at once. (Free RSVP events are unaffected — they never
// touch Paystack and always show.)
export const SHOW_TICKETED_EVENTS = true;
