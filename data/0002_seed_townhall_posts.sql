INSERT INTO townhall_posts (
  id, user_id, title, prompt, created_at, r2_key, file_size, expires_at
) VALUES
  ('test-001', 'user_123', 'Test Submission 1', 'This is a sample prompt.', '2025-05-29T12:00:00Z', NULL, NULL, NULL),
  ('test-002', 'user_456', 'Another Opinion', 'We need more transparency in local government.', '2025-05-29T13:30:00Z', 'sample.pdf', 128004, NULL),
  ('test-003', 'user_789', 'Let’s Talk Taxes', 'Why are our property taxes going up?', '2025-05-29T14:15:00Z', NULL, NULL, '2025-12-31T23:59:59Z');
