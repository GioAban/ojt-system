package com.iodev.practicum.model;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * Isang beses lang magagamit na link sa email (verification ng registration o password reset).
 * Ang hash (SHA-256) lang ng token ang naka-save; ang mismong token ay nasa email lang.
 * Ang email ay itinatabi (lowercase) para sa hangganan ng dami ng email kada address; binubura pagkalipas ng 30 araw.
 */
@Entity
@Table(name = "email_tokens", indexes = {
        @Index(name = "idx_email_token_subject", columnList = "subject_type,subject_id,purpose"),
        @Index(name = "idx_email_token_email", columnList = "email,purpose,created_at"),
        @Index(name = "idx_email_token_created", columnList = "created_at")
})
public class EmailToken {

    public static final String VERIFY_REGISTRATION = "VERIFY_REGISTRATION";
    public static final String PASSWORD_RESET = "PASSWORD_RESET";

    public static final String REGISTRATION = "REGISTRATION";
    public static final String STUDENT = "STUDENT";
    public static final String USER = "USER";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 30)
    private String purpose;

    @Column(name = "token_hash", nullable = false, unique = true, length = 64)
    private String tokenHash;

    @Column(name = "subject_type", nullable = false, length = 20)
    private String subjectType;

    @Column(name = "subject_id", nullable = false)
    private Long subjectId;

    @Column(nullable = false, length = 255)
    private String email;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "used_at")
    private LocalDateTime usedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public EmailToken() {}

    public EmailToken(String purpose, String tokenHash, String subjectType, Long subjectId, String email,
                      LocalDateTime expiresAt) {
        this.purpose = purpose;
        this.tokenHash = tokenHash;
        this.subjectType = subjectType;
        this.subjectId = subjectId;
        this.email = email;
        this.expiresAt = expiresAt;
    }

    public Long getId() { return id; }
    public String getPurpose() { return purpose; }
    public String getTokenHash() { return tokenHash; }
    public String getSubjectType() { return subjectType; }
    public Long getSubjectId() { return subjectId; }
    public String getEmail() { return email; }
    public LocalDateTime getExpiresAt() { return expiresAt; }
    public LocalDateTime getUsedAt() { return usedAt; }
    public void setUsedAt(LocalDateTime usedAt) { this.usedAt = usedAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }

    public boolean isUsed() { return usedAt != null; }
    public boolean isExpired() { return LocalDateTime.now().isAfter(expiresAt); }
}
