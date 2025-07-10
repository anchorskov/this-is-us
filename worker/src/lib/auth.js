export async function verifySession(request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { user: null };
  }

  const idToken = authHeader.split("Bearer ")[1];

  // MOCK: Replace with actual Firebase verification logic if needed
  if (idToken === "test-token") {
    return {
      user: {
        uid: "test-user-id",
        email: "user@example.com",
        email_verified: true,
        isAdmin: true, // Simulate admin for dev
      }
    };
  }

  return { user: null };
}
