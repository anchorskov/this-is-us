---
title: "Login"
url: "/login/"
slug: "login"
draft: true
---

{{< rawhtml >}}
<h1 style="text-align:center;">Login or Register</h1>
<div id="firebaseui-auth-container" style="margin:2rem auto; max-width:400px;"></div>
<div id="recaptcha-container"></div>

<script src="https://www.gstatic.com/firebasejs/ui/4.8.0/firebase-ui-auth__en.js"></script>
<link type="text/css" rel="stylesheet" href="https://www.gstatic.com/firebasejs/ui/4.8.0/firebase-ui-auth.css" />

<script>
  // Confirm Firebase is ready
  console.log("🚀 Firebase login page loaded");

  // FirebaseUI config
  const uiConfig = {
    signInSuccessUrl: '/', // Redirect after login
    signInOptions: [
      firebase.auth.EmailAuthProvider.PROVIDER_ID,
      firebase.auth.GoogleAuthProvider.PROVIDER_ID,
      {
        provider: firebase.auth.PhoneAuthProvider.PROVIDER_ID,
        recaptchaParameters: {
          type: 'image',
          size: 'normal',
          badge: 'bottomleft'
        },
        defaultCountry: 'US'
      }
    ],
    tosUrl: '/manifesto/',
    privacyPolicyUrl: '/contact/'
  };

  const ui = new firebaseui.auth.AuthUI(firebase.auth());

  firebase.auth().onAuthStateChanged(user => {
    if (user) {
      console.log("✅ Already logged in:", user.email || user.phoneNumber);
      window.location.href = "/";
    } else {
      ui.start('#firebaseui-auth-container', uiConfig);
    }
  });
</script>
{{< /rawhtml >}}
