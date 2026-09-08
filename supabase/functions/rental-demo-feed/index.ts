// Test fixture only — NOT a real rental data source. Serves a small static
// CSV so the scheduled-sync path (pg_cron -> rental-sync-cron -> fetch a
// source's feed_url -> run the aggregation pipeline) can be verified
// end-to-end without a real external feed to point at. A rental_sources row
// pointing its feed_url here exists purely for that test — see
// docs/ARCHITECTURE.md's Rental Property Aggregation Engine section.
//
// Deploy with verify_jwt = false — it's fetched by rental-sync-cron (and by
// hand while testing), not by an authenticated app user.

const DEMO_CSV = `property_name,property_type,address,city,state,zip,county,latitude,longitude,management_company,management_contact_phone,source_property_id,source_url,unit_number,floor,bedrooms,bathrooms,square_feet,monthly_rent,available_date,availability_status,source_unit_id
Riverside Commons,apartment community,200 Riverside Dr,Springfield,IL,62702,Sangamon,39.8003,-89.6437,Demo Feed Properties LLC,555-0300,DEMO-RIV-01,https://example.test/riverside,101,1,2 Bed,2,1050,"$1,650/mo",Available Now,available,DEMO-RIV-01-101
`;

Deno.serve(() => {
  return new Response(DEMO_CSV, {
    headers: { "Content-Type": "text/csv" },
  });
});
