/**
 * worker/test/billSummaryAnalyzer.pdf-fallback.test.mjs
 * 
 * Test suite for PDF text extraction and fallback ladder behavior.
 * Validates Workers AI integration, fallback to title-only, and metadata persistence.
 */

import { jest } from "@jest/globals";
import { saveBillSummary } from "../src/lib/billSummaryAnalyzer.mjs";

describe("billSummaryAnalyzer - PDF Fallback Ladder", () => {
  describe("saveBillSummary - Metadata Persistence for PDF and Title-Only Sources", () => {
    test("Persists PDF summary with source='pdf' and is_authoritative=1", async () => {
      const mockWYDB = {
        prepare: jest.fn().mockReturnThis(),
        bind: jest.fn().mockReturnThis(),
        run: jest.fn().mockResolvedValue({ success: true }),
      };

      const mockEnv = {
        WY_DB: mockWYDB,
      };

      const analysis = {
        plain_summary: "This PDF contains important legislative text.",
        key_points: ["Key provision 1", "Key provision 2"],
        note: "ok",
        source: "pdf",
        is_authoritative: true,
      };

      await saveBillSummary(mockEnv, "2026_HB0001", analysis);

      expect(mockWYDB.prepare).toHaveBeenCalled();
      const prepareCall = mockWYDB.prepare.mock.calls[0][0];
      
      // Verify all metadata columns are in the update statement
      expect(prepareCall).toContain("summary_source");
      expect(prepareCall).toContain("summary_error");
      expect(prepareCall).toContain("summary_is_authoritative");

      // Verify values bound to the statement include pdf and authoritative flag
      const bindCall = mockWYDB.bind.mock.calls[0];
      expect(bindCall).toContain("pdf");
      expect(bindCall).toContain(1); // is_authoritative=1 for PDF
      expect(bindCall).toContain("ok"); // summary_error=ok
    });

    test("Persists title_only summary with source='title_only' and is_authoritative=0", async () => {
      const mockWYDB = {
        prepare: jest.fn().mockReturnThis(),
        bind: jest.fn().mockReturnThis(),
        run: jest.fn().mockResolvedValue({ success: true }),
      };

      const mockEnv = {
        WY_DB: mockWYDB,
      };

      const analysis = {
        plain_summary: "This bill likely deals with the title topic.",
        key_points: [],
        note: "ok",
        source: "title_only",
        is_authoritative: false,
      };

      await saveBillSummary(mockEnv, "2026_HB0002", analysis);

      expect(mockWYDB.prepare).toHaveBeenCalled();
      const bindCall = mockWYDB.bind.mock.calls[0];
      
      // Verify title_only source and is_authoritative=0
      expect(bindCall).toContain("title_only");
      expect(bindCall).toContain(0); // is_authoritative=0 for title_only (non-authoritative)
      expect(bindCall).toContain("ok");
    });

    test("Marks PDF extraction as authoritative (is_authoritative=1)", async () => {
      const mockWYDB = {
        prepare: jest.fn().mockReturnThis(),
        bind: jest.fn().mockReturnThis(),
        run: jest.fn().mockResolvedValue({ success: true }),
      };

      const mockEnv = {
        WY_DB: mockWYDB,
      };

      // Simulate PDF extraction result
      const pdfAnalysis = {
        plain_summary: "Extracted text from official PDF document.",
        key_points: ["Official content"],
        note: "ok",
        source: "pdf",
        is_authoritative: true,
      };

      await saveBillSummary(mockEnv, "2026_HB0003", pdfAnalysis);

      const bindCall = mockWYDB.bind.mock.calls[0];
      expect(bindCall[4]).toBe(1); // Fifth bind parameter is is_authoritative (should be 1)
    });

    test("Marks title_only as non-authoritative (is_authoritative=0)", async () => {
      const mockWYDB = {
        prepare: jest.fn().mockReturnThis(),
        bind: jest.fn().mockReturnThis(),
        run: jest.fn().mockResolvedValue({ success: true }),
      };

      const mockEnv = {
        WY_DB: mockWYDB,
      };

      // Simulate title-only inference
      const titleAnalysis = {
        plain_summary: "Inferred from bill title only.",
        key_points: [],
        note: "ok",
        source: "title_only",
        is_authoritative: false,
      };

      await saveBillSummary(mockEnv, "2026_HB0004", titleAnalysis);

      const bindCall = mockWYDB.bind.mock.calls[0];
      expect(bindCall[4]).toBe(0); // Fifth bind parameter is is_authoritative (should be 0)
    });

    test("Skips saving empty summaries (no DB write)", async () => {
      const mockWYDB = {
        prepare: jest.fn(),
        bind: jest.fn(),
        run: jest.fn(),
      };

      const mockEnv = {
        WY_DB: mockWYDB,
      };

      const emptyAnalysis = {
        plain_summary: "",
        key_points: [],
        note: "no_text_available",
        source: "none",
        is_authoritative: false,
      };

      await saveBillSummary(mockEnv, "2026_HB0005", emptyAnalysis);

      // Should not call prepare (and thus not call bind or run)
      expect(mockWYDB.prepare).not.toHaveBeenCalled();
      expect(mockWYDB.bind).not.toHaveBeenCalled();
      expect(mockWYDB.run).not.toHaveBeenCalled();
    });

    test("Converts is_authoritative boolean to integer (1 for true, 0 for false)", async () => {
      const mockWYDB = {
        prepare: jest.fn().mockReturnThis(),
        bind: jest.fn().mockReturnThis(),
        run: jest.fn().mockResolvedValue({ success: true }),
      };

      const mockEnv = {
        WY_DB: mockWYDB,
      };

      // Test true -> 1
      const authAnalysis = {
        plain_summary: "Authoritative source",
        key_points: [],
        note: "ok",
        source: "lso_html",
        is_authoritative: true,
      };

      await saveBillSummary(mockEnv, "2026_HB0006", authAnalysis);
      let bindCall = mockWYDB.bind.mock.calls[mockWYDB.bind.mock.calls.length - 1];
      expect(bindCall[4]).toBe(1);

      // Test false -> 0
      const nonAuthAnalysis = {
        plain_summary: "Non-authoritative source",
        key_points: [],
        note: "ok",
        source: "openstates",
        is_authoritative: false,
      };

      await saveBillSummary(mockEnv, "2026_HB0007", nonAuthAnalysis);
      bindCall = mockWYDB.bind.mock.calls[mockWYDB.bind.mock.calls.length - 1];
      expect(bindCall[4]).toBe(0);
    });
  });
});

