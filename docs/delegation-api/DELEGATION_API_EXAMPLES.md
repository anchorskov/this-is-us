// Example API Responses for /api/civic/delegation

// ═════════════════════════════════════════════════════════════════════════
// EXAMPLE 1: Verified Voter with Complete Delegation
// ═════════════════════════════════════════════════════════════════════════

// Request:
// GET /api/civic/delegation?user_id=test-uid-12345

// Response: HTTP 200 OK
{
  "source": "verified_voter",
  "county": "Laramie",
  "state": "Wyoming",
  "house": {
    "district": "23",
    "name": "John Smith",
    "role": "State House",
    "email": "john.smith@wylegislature.gov",
    "phone": "+1 (307) 777-7881",
    "website": "https://wylegislature.gov/members/john-smith/",
    "bio": "Representative, District 23"
  },
  "senate": {
    "district": "10",
    "name": "Jane Doe",
    "role": "State Senate",
    "email": "jane.doe@wylegislature.gov",
    "phone": "+1 (307) 777-7882",
    "website": "https://wylegislature.gov/members/jane-doe/",
    "bio": "Senator, District 10"
  },
  "federal": {
    "house": {
      "name": "Harriet Hageman",
      "role": "U.S. House (At-Large)",
      "district": "At-Large",
      "email": "hageman.house.gov",
      "phone": "+1 (202) 225-2311",
      "website": "https://hageman.house.gov",
      "bio": "U.S. Representative, Wyoming At-Large District"
    },
    "senators": [
      {
        "name": "John Barrasso",
        "role": "U.S. Senator",
        "district": "Senior Senator",
        "email": "senator@barrasso.senate.gov",
        "phone": "+1 (202) 224-6441",
        "website": "https://www.barrasso.senate.gov",
        "bio": "Senior Senator, Wyoming"
      },
      {
        "name": "Cynthia Lummis",
        "role": "U.S. Senator",
        "district": "Junior Senator",
        "email": "senator@lummis.senate.gov",
        "phone": "+1 (202) 224-3424",
        "website": "https://www.lummis.senate.gov",
        "bio": "Junior Senator, Wyoming"
      }
    ]
  }
}


// ═════════════════════════════════════════════════════════════════════════
// EXAMPLE 2: Direct Voter Lookup (Admin/Testing)
// ═════════════════════════════════════════════════════════════════════════

// Request:
// GET /api/civic/delegation?voter_id=WY-2025-00054321

// Response: HTTP 200 OK
{
  "source": "voter_id_lookup",
  "county": "Natrona",
  "state": "Wyoming",
  "house": {
    "district": "31",
    "name": "Mary Johnson",
    "role": "State House",
    "email": "mary.johnson@wylegislature.gov",
    "phone": "+1 (307) 777-7883",
    "website": "https://wylegislature.gov/members/mary-johnson/",
    "bio": "Representative, District 31"
  },
  "senate": {
    "district": "7",
    "name": "Robert Wilson",
    "role": "State Senate",
    "email": "robert.wilson@wylegislature.gov",
    "phone": "+1 (307) 777-7884",
    "website": "https://wylegislature.gov/members/robert-wilson/",
    "bio": "Senator, District 7"
  },
  "federal": {
    "house": {
      "name": "Harriet Hageman",
      "role": "U.S. House (At-Large)",
      "district": "At-Large",
      "email": "hageman.house.gov",
      "phone": "+1 (202) 225-2311",
      "website": "https://hageman.house.gov",
      "bio": "U.S. Representative, Wyoming At-Large District"
    },
    "senators": [
      {
        "name": "John Barrasso",
        "role": "U.S. Senator",
        "district": "Senior Senator",
        "email": "senator@barrasso.senate.gov",
        "phone": "+1 (202) 224-6441",
        "website": "https://www.barrasso.senate.gov",
        "bio": "Senior Senator, Wyoming"
      },
      {
        "name": "Cynthia Lummis",
        "role": "U.S. Senator",
        "district": "Junior Senator",
        "email": "senator@lummis.senate.gov",
        "phone": "+1 (202) 224-3424",
        "website": "https://www.lummis.senate.gov",
        "bio": "Junior Senator, Wyoming"
      }
    ]
  }
}


// ═════════════════════════════════════════════════════════════════════════
// EXAMPLE 3: No Verified Voter (Fallback with Federal Only)
// ═════════════════════════════════════════════════════════════════════════

// Request:
// GET /api/civic/delegation
// (or with unknown user_id/voter_id)

// Response: HTTP 200 OK
{
  "source": "none",
  "message": "No verified voter record found. Please verify your voter account.",
  "county": null,
  "state": "Wyoming",
  "house": null,
  "senate": null,
  "federal": {
    "house": {
      "name": "Harriet Hageman",
      "role": "U.S. House (At-Large)",
      "district": "At-Large",
      "email": "hageman.house.gov",
      "phone": "+1 (202) 225-2311",
      "website": "https://hageman.house.gov",
      "bio": "U.S. Representative, Wyoming At-Large District"
    },
    "senators": [
      {
        "name": "John Barrasso",
        "role": "U.S. Senator",
        "district": "Senior Senator",
        "email": "senator@barrasso.senate.gov",
        "phone": "+1 (202) 224-6441",
        "website": "https://www.barrasso.senate.gov",
        "bio": "Senior Senator, Wyoming"
      },
      {
        "name": "Cynthia Lummis",
        "role": "U.S. Senator",
        "district": "Junior Senator",
        "email": "senator@lummis.senate.gov",
        "phone": "+1 (202) 224-3424",
        "website": "https://www.lummis.senate.gov",
        "bio": "Junior Senator, Wyoming"
      }
    ]
  }
}


// ═════════════════════════════════════════════════════════════════════════
// EXAMPLE 4: Database Error
// ═════════════════════════════════════════════════════════════════════════

// Request:
// GET /api/civic/delegation?user_id=test-uid-12345

// Response: HTTP 500 Internal Server Error
// (if database connection fails)
{
  "error": "delegation_lookup_failed",
  "message": "SQLITE_ERROR: database connection timeout"
}


// ═════════════════════════════════════════════════════════════════════════
// Field Descriptions
// ═════════════════════════════════════════════════════════════════════════

/**
 * source: string
 *   - "verified_voter": User matched from verified_users (authenticated, preferred)
 *   - "voter_id_lookup": Direct voter lookup from voters_addr_norm (testing/admin)
 *   - "none": No matching user found (fallback, still returns federal delegation)
 *
 * county: string | null
 *   - Wyoming county name (e.g., "Laramie", "Natrona", "Sheridan")
 *   - Extracted from verified_users or wy_city_county
 *   - null if not found
 *
 * state: string
 *   - Always "Wyoming" for this API
 *
 * house: object | null
 *   - State House representative for user's district
 *   - null if no house district found
 *   - Fields:
 *     - district: House district number (e.g., "23")
 *     - name: Full name of representative
 *     - role: Always "State House"
 *     - email: Office email address
 *     - phone: Office phone number
 *     - website: Link to legislator profile
 *     - bio: Short biography or party affiliation
 *
 * senate: object | null
 *   - State Senate member for user's district
 *   - null if no senate district found
 *   - Same fields as house
 *
 * federal: object
 *   - Always present, even if house/senate are null
 *   - house: Single at-large US House member for Wyoming
 *   - senators: Array of 2 US Senators (senior + junior)
 *   - Same field structure as state house/senate
 *
 * message: string (only in "none" source)
 *   - Prompt text for unverified users
 *   - "No verified voter record found. Please verify your voter account."
 */


// ═════════════════════════════════════════════════════════════════════════
// Usage in Frontend
// ═════════════════════════════════════════════════════════════════════════

// JavaScript Example:
async function loadUserDelegation(firebaseUserId) {
  const response = await fetch(
    `/api/civic/delegation?user_id=${encodeURIComponent(firebaseUserId)}`
  );
  
  const delegation = await response.json();
  
  if (response.status === 200) {
    if (delegation.source === 'none') {
      // Show verification prompt
      document.getElementById('delegation-panel').style.display = 'none';
      document.getElementById('delegation-prompt').style.display = 'block';
      document.getElementById('prompt-text').innerText = delegation.message;
    } else {
      // Render delegation panel
      renderDelegationPanel(delegation);
    }
  } else {
    // Handle error
    console.error('Failed to load delegation:', delegation.error);
    showErrorMessage('Unable to load your representatives. Please try again.');
  }
}

function renderDelegationPanel(delegation) {
  const panel = document.getElementById('delegation-panel');
  
  // State House
  if (delegation.house) {
    const houseHtml = `
      <div class="representative state-house">
        <h4>${delegation.house.role} - District ${delegation.house.district}</h4>
        <p class="name">${delegation.house.name}</p>
        <p class="contact">
          <a href="mailto:${delegation.house.email}">${delegation.house.email}</a><br>
          ${delegation.house.phone}
        </p>
        <p><a href="${delegation.house.website}" target="_blank">View Profile</a></p>
      </div>
    `;
    panel.querySelector('#house-rep').innerHTML = houseHtml;
  }
  
  // State Senate
  if (delegation.senate) {
    const senateHtml = `
      <div class="representative state-senate">
        <h4>${delegation.senate.role} - District ${delegation.senate.district}</h4>
        <p class="name">${delegation.senate.name}</p>
        <p class="contact">
          <a href="mailto:${delegation.senate.email}">${delegation.senate.email}</a><br>
          ${delegation.senate.phone}
        </p>
        <p><a href="${delegation.senate.website}" target="_blank">View Profile</a></p>
      </div>
    `;
    panel.querySelector('#senate-rep').innerHTML = senateHtml;
  }
  
  // Federal
  const federalHtml = `
    <div class="federal-delegation">
      <h4>Federal Delegation</h4>
      
      <div class="federal-house">
        <p class="name">${delegation.federal.house.name}</p>
        <p class="role">${delegation.federal.house.role}</p>
        <p><a href="${delegation.federal.house.website}" target="_blank">Contact</a></p>
      </div>
      
      <div class="federal-senators">
        ${delegation.federal.senators.map(senator => `
          <div class="senator">
            <p class="name">${senator.name}</p>
            <p class="role">${senator.role}</p>
            <p><a href="${senator.website}" target="_blank">Contact</a></p>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  panel.querySelector('#federal').innerHTML = federalHtml;
  
  panel.style.display = 'block';
}
