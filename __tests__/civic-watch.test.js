/**
 * __tests__/civic-watch.test.js
 * Tests for static/js/civic/watch.js rendering helpers.
 */

import { renderHotTopics, renderPending, renderTownhall } from "../static/js/civic/watch.js";

function makeContainer() {
  const div = document.createElement("div");
  return div;
}

describe("Civic Watch preview rendering", () => {
  test("renders hot topics with counts", () => {
    const container = makeContainer();
    const topics = [
      { slug: "a", title: "Topic A", summary: "Alpha", civic_items: [{}, {}] },
      { slug: "b", title: "Topic B", summary: "Beta", civic_items: [{}] },
    ];
    renderHotTopics(container, topics);
    expect(container.innerHTML).toContain("Topic A");
    expect(container.innerHTML).toContain("2 bills");
    expect(container.innerHTML).toContain("Topic B");
  });

  test("renders pending bills preview", () => {
    const container = makeContainer();
    const bills = [
      { bill_number: "HB 1", title: "Water Bill", status: "in_committee", legislative_session: "2025" },
      { bill_number: "SF 2", title: "Energy Bill", status: "introduced", legislative_session: "2025" },
    ];
    renderPending(container, bills);
    expect(container.innerHTML).toContain("HB 1");
    expect(container.innerHTML).toContain("Water Bill");
    expect(container.innerHTML).toContain("in_committee");
  });

  test("renders town hall preview with fallback", () => {
    const container = makeContainer();
    renderTownhall(container, []);
    expect(container.innerHTML).toContain("No town threads");

    const posts = [{ title: "Natrona discussion", city: "Natrona", state: "WY", created_at: "2025-12-01" }];
    renderTownhall(container, posts);
    expect(container.innerHTML).toContain("Natrona discussion");
    expect(container.innerHTML).toContain("Natrona");
  });

  test("renderTownhall handles null container safely", () => {
    renderTownhall(null, [{ title: "x" }]);
  });
});
