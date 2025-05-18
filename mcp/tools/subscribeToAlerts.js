export default async function subscribeToAlerts({ email, zip }, env) {
  if (!email || !zip) return { error: "Missing email or zip" };
  await env.CANDIDATES_DB.prepare(
    "INSERT INTO subscriptions (email, zip) VALUES (?, ?)"
  ).bind(email, zip).run();
  return { success: true };
}
