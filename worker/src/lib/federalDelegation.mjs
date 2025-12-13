// worker/src/lib/federalDelegation.js
// Static federal delegation for Wyoming
// - US House at-large member (Wyoming has only 1 House seat, shared statewide)
// - 2 US Senators
//
// These are updated manually when representation changes (elections, reassignments).
// For live updates, integrate with OpenStates or Congress API.

export const federalDelegation = {
  house: {
    name: "Harriet Hageman",
    role: "U.S. House (At-Large)",
    district: "At-Large",
    email: "hageman.house.gov",
    phone: "+1 (202) 225-2311",
    website: "https://hageman.house.gov",
    bio: "U.S. Representative, Wyoming At-Large District",
  },
  senators: [
    {
      name: "John Barrasso",
      role: "U.S. Senator",
      district: "Senior Senator",
      email: "senator@barrasso.senate.gov",
      phone: "+1 (202) 224-6441",
      website: "https://www.barrasso.senate.gov",
      bio: "Senior Senator, Wyoming",
    },
    {
      name: "Cynthia Lummis",
      role: "U.S. Senator",
      district: "Junior Senator",
      email: "senator@lummis.senate.gov",
      phone: "+1 (202) 224-3424",
      website: "https://www.lummis.senate.gov",
      bio: "Junior Senator, Wyoming",
    },
  ],
};
