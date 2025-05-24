console.log("🔥 Firebase UI config loaded");

if (typeof firebase === "undefined") {
  console.error("❌ Firebase not initialized. Aborting uiConfig setup.");
} else {
  const auth = firebase.auth();

  window.uiConfig = {
    signInOptions: [
      { provider: firebase.auth.EmailAuthProvider.PROVIDER_ID, requireDisplayName: true },
      firebase.auth.GoogleAuthProvider.PROVIDER_ID,
      firebase.auth.PhoneAuthProvider.PROVIDER_ID
    ],
    signInFlow: "popup",
    tosUrl: "/manifesto/",
    privacyPolicyUrl: "/about/",
    callbacks: {
      signInSuccessWithAuthResult: function(authResult, redirectUrl) {
        const user = authResult.user;
        window.currentUser = user;
        console.log("✅ FirebaseUI login complete:", {
          uid: user?.uid,
          email: user?.email,
          phone: user?.phoneNumber,
          verified: user?.emailVerified,
        });

        const params = new URLSearchParams(window.location.search);
        const target = params.get("redirect") || "/events/create/";
        console.log("🚀 Redirecting user to:", target);

        // Delay to ensure auth state is synced
        setTimeout(() => {
          window.location.href = target;
        }, 500);

        return false; // Prevent auto-redirect
      },
      uiShown: function () {
        console.log("🧩 FirebaseUI shown");
      }
    }
  };
}
