# officialUrl Field - UI Updates Complete

## What Was Done

✅ **Database**: official_url field already populated with testpdf.url values in hot_topics_draft
✅ **UI**: Added officialUrl field to Edit Topic modal
✅ **API**: Already returning officialUrl in response (validated in code review)
✅ **Display**: Added officialUrl link display in topic rows and bill details

---

## Changes Made

### 1. Edit Modal - Added officialUrl Field
**File**: `static/js/admin/hot-topics.js`

Added text input field for officialUrl in the Edit Topic modal:
```javascript
<div>
  <label class="block text-sm font-medium mb-1">Official URL (PDF/Document Link)</label>
  <input type="url" id="edit-official-url" data-testid="field-official-url" 
    class="w-full p-2 border border-gray-300 rounded" 
    placeholder="https://example.com/document.pdf" 
    value="${escapeHtml(topic.officialUrl || '')}">
</div>
```

### 2. Edit Form Payload - Include officialUrl
**Function**: `submitEditTopic()`

Updated payload to include officialUrl when saving:
```javascript
const payload = {
  title: $('#edit-title').value,
  slug: $('#edit-slug').value,
  summary: $('#edit-summary').value,
  priority: priorityValue,
  officialUrl: $('#edit-official-url').value || null,  // ← NEW
  invalidated: $('#edit-invalidated')?.checked || false
};
```

### 3. Topic Row Display - Show officialUrl Link
**Function**: `renderTopicsTable()`

Added badge showing officialUrl link in topic list:
```javascript
${topic.officialUrl ? `
  <div class="text-xs text-blue-600 mt-1">
    <a href="${escapeHtml(topic.officialUrl)}" target="_blank" class="hover:underline">
      📄 View Topic Doc
    </a>
  </div>
` : ''}
```

---

## Database State

### hot_topics_draft Test Data
```
ID | Slug                | Title                          | official_url
---|---------------------|--------------------------------|------------------------------------------
1  | education-funding   | Education Funding Reform       | http://testpdf.url/education-funding-summary.pdf
2  | water-rights        | Water Rights Management        | http://testpdf.url/water-rights-summary.pdf
3  | healthcare-access   | Healthcare Access & Medicaid   | http://testpdf.url/healthcare-access-summary.pdf
```

---

## UI Flow

1. **View Draft Topics**: Table shows topics with officialUrl link (📄 View Topic Doc)
2. **Click Edit**: Modal opens with:
   - Title field
   - Slug field
   - Summary field
   - Priority dropdown
   - **Official URL field** ✅ (pre-filled if exists)
   - Invalidate checkbox
3. **Edit officialUrl**: User can update the PDF/document link
4. **Save Changes**: officialUrl sent to API
5. **View Bills**: Linked bills also show their officialUrl links (from civic_items)

---

## API Integration

### GET /api/admin/hot-topics/drafts
Response includes `officialUrl` for each topic:
```json
{
  "drafts": [
    {
      "id": 1,
      "slug": "education-funding",
      "title": "Education Funding Reform",
      "officialUrl": "http://testpdf.url/education-funding-summary.pdf",
      "linkedBills": [
        {
          "billNumber": "HB 001",
          "officialUrl": "http://testpdf.url/wy-2026-hb-001.pdf"
        }
      ]
    }
  ]
}
```

### POST /api/admin/hot-topics/drafts/:topicId
Request body can include:
```json
{
  "title": "...",
  "slug": "...",
  "summary": "...",
  "priority": "...",
  "officialUrl": "https://example.com/document.pdf",
  "invalidated": false
}
```

---

## Ready for Testing

✅ All changes complete
✅ Database seeded with test data
✅ UI fields added
✅ API updated to handle officialUrl

**To test**:
1. Start local dev: `./start_local.sh`
2. Navigate to http://localhost:1313/admin/hot-topics
3. View draft topics - should see 📄 links if officialUrl is set
4. Click Edit on a topic - officialUrl field should appear pre-filled
5. Update officialUrl and save
6. Verify change persists in table view
