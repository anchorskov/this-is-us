export function getAuth() {
  return {
    currentUser: {
      uid: "test-user",
      getIdToken: async () => "mock-token",
    },
  };
}
