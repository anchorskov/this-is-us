---
title: "Support This Is US"
url: "/donate/"
slug: "donate"
draft: false
---

{{< rawhtml >}}
<style>
  /* full‑screen layout */
  html, body, main, .post { margin:0; padding:0; width:100vw; height:100vh; }
  .donate-iframe    { width:100vw; height:100vh; border:none; display:block; }
  /* disclaimer section */
  #disclaimer { padding:2rem; font-size:1rem; line-height:1.5; }
  #agree-btn { 
    display:block; margin:1.5rem 0; padding:0.75rem 1.5rem; 
    font-size:1rem; background:#1f2937; color:#fff; border:none; border-radius:0.375rem;
    cursor:pointer;
  }
</style>

<div id="disclaimer">
  <ol>
    <li>I am seeking election to the US Senate as a Republican.</li>
    <li>I am seeking election to the US House as a Democrat.</li>
    <li>I am currently registered as a Republican and may change parties or become an independent at any time.</li>    
    <li>All contributions follow FEC limits.</li>
    <li>No foreign national may contribute.</li>
    <li>Your contributions are not tax deductible.</li>
    <li>I will file and report every penny to the FEC.</li>
    <li>I will account for all funds here and at fec.gov.</li>
    <li>
            Online donations incur a 4% + $0.50 processing fee. To avoid this fee, I accept campaign contribution by check payable to: 
        <em>Skovgard for Senate, 5685 Hanly, Mills, WY 82604</em>.
    </li>

  </ol>
  <button id="agree-btn">
    I agree to the terms outlined above — select here to proceed to donation page
  </button>
</div>

<div id="donate-content" style="display:none;">
  <iframe
    class="donate-iframe"
    src="https://secure.anedot.com/skovgard-for-senate/...embed=true"
    allowtransparency="true">
  </iframe>
</div>

<script>
  document.getElementById("agree-btn").addEventListener("click", function() {
    document.getElementById("disclaimer").style.display     = "none";
    document.getElementById("donate-content").style.display = "block";
  });
</script>
{{< /rawhtml >}}
