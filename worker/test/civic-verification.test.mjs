// worker/test/civic-verification.test.mjs
// Jest tests for civic_item_verification integration with pendingBills API

import { handlePendingBillsWithTopics } from "../src/routes/pendingBills.mjs";

// Mock environment
const mockEnv = {
  WY_DB: {
    prepare: jest.fn(),
  },
  EVENTS_DB: {
    prepare: jest.fn(),
  },
};

// Mock request
function createMockRequest(url = "http://127.0.0.1:8787/api/civic/pending-bills-with-topics") {
  return new Request(url);
}

describe("Civic Item Verification - PendingBills Integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("handlePendingBillsWithTopics with verification data", () => {
    it("should include verification_status and verification_confidence from latest verification row", async () => {
      // Sample bill data with joined verification row
      const mockResults = [
        {
          // Bill fields
          id: "ocd-bill/test-hb001",
          bill_number: "HB 1",
          title: "Education funding bill",
          chamber: "house",
          status: "introduced",
          legislative_session: "2025",
          subject_tags: JSON.stringify(["education", "budget"]),
          ai_plain_summary: "This bill increases education funding",
          ai_key_points_json: JSON.stringify(["5% increase", "focus on K-12"]),
          
          // Vote fields (aggregated)
          up_votes: 2,
          down_votes: 1,
          info_votes: 0,
          
          // Verification fields (LATEST row, matched by max(created_at))
          verification_status: "ok",
          verification_confidence: 0.92,
          
          // Topic fields
          topic_slug: "education",
          confidence: 0.85,
          trigger_snippet: "education funding",
          reason_summary: "Bill explicitly mentions education",
          
          // Sponsor fields
          sponsor_name: "Rep. Smith",
          sponsor_role: "Representative",
          sponsor_district: "001",
          contact_email: "smith@example.com",
          contact_phone: "307-555-0001",
          contact_website: "rep-smith.local",
        },
      ];

      // Mock the main query that joins verification data
      mockEnv.WY_DB.prepare = jest.fn().mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({
          all: jest.fn().resolveValue({ results: mockResults }),
        }),
      });

      // Mock the topic metadata query
      mockEnv.EVENTS_DB.prepare = jest.fn().mockReturnValue({
        all: jest.fn().resolveValue({
          results: [
            {
              slug: "education",
              title: "Education",
              badge: "🎓",
              priority: 1,
            },
          ],
        }),
      });

      const request = createMockRequest();
      const response = await handlePendingBillsWithTopics(request, mockEnv);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(responseBody.results).toBeDefined();
      expect(responseBody.results.length).toBe(1);

      const bill = responseBody.results[0];
      expect(bill.id).toBe("ocd-bill/test-hb001");
      expect(bill.verification_status).toBe("ok");
      expect(bill.verification_confidence).toBe(0.92);
      expect(bill.up_votes).toBe(2);
      expect(bill.down_votes).toBe(1);
    });

    it("should handle missing verification data gracefully", async () => {
      // Bill without verification row (NULL verification fields)
      const mockResults = [
        {
          id: "ocd-bill/test-hb002",
          bill_number: "HB 2",
          title: "Infrastructure bill",
          chamber: "senate",
          status: "in_committee",
          legislative_session: "2025",
          subject_tags: JSON.stringify(["infrastructure"]),
          ai_plain_summary: "",
          ai_key_points_json: null,
          up_votes: 0,
          down_votes: 0,
          info_votes: 0,
          verification_status: null, // No verification row
          verification_confidence: null,
          topic_slug: null,
          confidence: null,
          trigger_snippet: null,
          reason_summary: null,
          sponsor_name: null,
          sponsor_role: null,
          sponsor_district: null,
          contact_email: null,
          contact_phone: null,
          contact_website: null,
        },
      ];

      mockEnv.WY_DB.prepare = jest.fn().mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({
          all: jest.fn().resolveValue({ results: mockResults }),
        }),
      });

      mockEnv.EVENTS_DB.prepare = jest.fn().mockReturnValue({
        all: jest.fn().resolveValue({ results: [] }),
      });

      const request = createMockRequest();
      const response = await handlePendingBillsWithTopics(request, mockEnv);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      const bill = responseBody.results[0];
      expect(bill.verification_status).toBe("missing"); // Default when null
      expect(bill.verification_confidence).toBeNull();
    });

    it("should handle flagged verification status", async () => {
      // Bill with flagged verification (topic_match=false or summary_safe=false)
      const mockResults = [
        {
          id: "ocd-bill/test-hb003",
          bill_number: "HB 3",
          title: "Tax reform bill",
          chamber: "house",
          status: "pending_vote",
          legislative_session: "2025",
          subject_tags: JSON.stringify(["taxation"]),
          ai_plain_summary: "This bill reduces taxes for all residents",
          ai_key_points_json: JSON.stringify(["Universal tax cut"]),
          up_votes: 5,
          down_votes: 3,
          info_votes: 1,
          verification_status: "flagged", // AI found issues
          verification_confidence: 0.45, // Lower confidence
          topic_slug: "taxation",
          confidence: 0.70,
          trigger_snippet: "tax reform",
          reason_summary: "Mentions taxation and budget",
          sponsor_name: "Rep. Jones",
          sponsor_role: "Representative",
          sponsor_district: "002",
          contact_email: "jones@example.com",
          contact_phone: "307-555-0002",
          contact_website: "rep-jones.local",
        },
      ];

      mockEnv.WY_DB.prepare = jest.fn().mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({
          all: jest.fn().resolveValue({ results: mockResults }),
        }),
      });

      mockEnv.EVENTS_DB.prepare = jest.fn().mockReturnValue({
        all: jest.fn().resolveValue({
          results: [
            {
              slug: "taxation",
              title: "Taxation",
              badge: "💰",
              priority: 2,
            },
          ],
        }),
      });

      const request = createMockRequest();
      const response = await handlePendingBillsWithTopics(request, mockEnv);
      const responseBody = await response.json();

      const bill = responseBody.results[0];
      expect(bill.verification_status).toBe("flagged");
      expect(bill.verification_confidence).toBe(0.45);
    });

    it("should filter by verification status if needed", async () => {
      // This test demonstrates how the UI or an admin endpoint could filter
      // for flagged bills that need review
      const mockResults = [
        {
          id: "ocd-bill/test-hb004",
          bill_number: "HB 4",
          title: "Health care bill",
          chamber: "senate",
          status: "introduced",
          legislative_session: "2025",
          subject_tags: JSON.stringify(["healthcare"]),
          ai_plain_summary: "Expands health insurance coverage",
          ai_key_points_json: JSON.stringify(["Coverage expansion"]),
          up_votes: 10,
          down_votes: 2,
          info_votes: 3,
          verification_status: "ok", // Verified as ok
          verification_confidence: 0.95, // High confidence
          topic_slug: "healthcare",
          confidence: 0.88,
          trigger_snippet: "health insurance",
          reason_summary: "Explicitly about health coverage",
          sponsor_name: "Sen. Brown",
          sponsor_role: "Senator",
          sponsor_district: null,
          contact_email: "brown@example.com",
          contact_phone: "307-555-0003",
          contact_website: "sen-brown.local",
        },
      ];

      mockEnv.WY_DB.prepare = jest.fn().mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({
          all: jest.fn().resolveValue({ results: mockResults }),
        }),
      });

      mockEnv.EVENTS_DB.prepare = jest.fn().mockReturnValue({
        all: jest.fn().resolveValue({
          results: [
            {
              slug: "healthcare",
              title: "Health Care",
              badge: "⚕️",
              priority: 1,
            },
          ],
        }),
      });

      const request = createMockRequest();
      const response = await handlePendingBillsWithTopics(request, mockEnv);
      const responseBody = await response.json();

      const bill = responseBody.results[0];
      // In a real scenario, the UI could check: if (bill.verification_status === 'flagged')
      // to show a "Needs Review" badge instead of "Verified (AI)"
      expect(bill.verification_status).toBe("ok");
      expect(bill.verification_confidence).toBe(0.95);
    });
  });
});
