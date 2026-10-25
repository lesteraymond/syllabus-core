INSERT INTO users (email, password_hash, role, first_name, last_name) VALUES
('admin@university.edu.ph', '$2a$10$zP3plSjyRB7SChe.auycZuHvkIPYoA/54q1KnPbhz5ebuYRLGzQLO', 'admin', 'Diana', 'Evale'),
('faculty@university.edu.ph', '$2a$10$spAalwqHSsGAiDooCXIJHeUVhkdTqLcz0xiGw.Jschtn4pKa/Eigu', 'faculty', 'Juan', 'Santos')
ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = VALUES(role), first_name = VALUES(first_name), last_name = VALUES(last_name);
