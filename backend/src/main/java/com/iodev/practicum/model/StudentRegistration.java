package com.iodev.practicum.model;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * Pagpaparehistro ng student gamit ang link ng coordinator. Walang Student na ginagawa hangga't
 * hindi vine-verify ng coordinator, kaya hindi ito lumalabas sa tracking, reports, atbp.
 * Status: EMAIL_PENDING (hinihintay ang link sa email), PENDING (verified ang email, hinihintay ang coordinator),
 * VERIFIED (may Student na), REJECTED, REVOKED (inalis ng coordinator ang account).
 * Ang EMAIL_PENDING, REJECTED at REVOKED ay hindi humaharang sa muling pagpaparehistro.
 */
@Entity
@Table(name = "student_registrations", indexes = {
        @Index(name = "idx_student_reg_lookup", columnList = "coordinator_id,semester_id,status"),
        @Index(name = "idx_student_reg_email", columnList = "email"),
        @Index(name = "idx_student_reg_number", columnList = "semester_id,student_number")
})
public class StudentRegistration {

    public static final String PENDING = "PENDING";
    public static final String VERIFIED = "VERIFIED";
    public static final String REJECTED = "REJECTED";
    public static final String EMAIL_PENDING = "EMAIL_PENDING";
    public static final String REVOKED = "REVOKED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "coordinator_id", nullable = false)
    private Coordinator coordinator;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "semester_id", nullable = false)
    private Semester semester;

    /** Ang link na ginamit (para sa bilang ng nag-register) */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "link_id")
    private EnrollmentLink link;

    @Column(name = "student_number", nullable = false, length = 50)
    private String studentNumber;

    @Column(nullable = false, length = 100)
    private String lastname;

    @Column(nullable = false, length = 100)
    private String firstname;

    @Column(name = "middle_initial", length = 3)
    private String middleInitial;

    @Column(length = 20)
    private String year;

    /** Sex at birth: Male o Female (kapareho ng Student.gender) */
    @Column(nullable = false, length = 10)
    private String gender;

    /** Course / section; acronym ng program sa simula, maaaring baguhin ng coordinator bago i-verify */
    @Column(nullable = false, length = 50)
    private String course;

    @Column(nullable = false, length = 255)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 100)
    private String passwordHash;

    @Column(name = "privacy_ack_at")
    private LocalDateTime privacyAckAt;

    @Column(name = "privacy_ack_version", length = 20)
    private String privacyAckVersion;

    @Column(nullable = false, length = 20)
    private String status = PENDING;

    @Column(name = "reject_reason", length = 300)
    private String rejectReason;

    /** Ang Student na ginawa nang i-verify */
    @Column(name = "student_id")
    private Long studentId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "decided_at")
    private LocalDateTime decidedAt;

    /** Kailan binuksan ng student ang link sa email; null = hindi pa (o registration bago nagkaroon ng email) */
    @Column(name = "email_verified_at")
    private LocalDateTime emailVerifiedAt;

    public StudentRegistration() {}

    public Long getId() { return id; }
    public Coordinator getCoordinator() { return coordinator; }
    public void setCoordinator(Coordinator coordinator) { this.coordinator = coordinator; }
    public Semester getSemester() { return semester; }
    public void setSemester(Semester semester) { this.semester = semester; }
    public EnrollmentLink getLink() { return link; }
    public void setLink(EnrollmentLink link) { this.link = link; }
    public String getStudentNumber() { return studentNumber; }
    public void setStudentNumber(String studentNumber) { this.studentNumber = studentNumber; }
    public String getLastname() { return lastname; }
    public void setLastname(String lastname) { this.lastname = lastname; }
    public String getFirstname() { return firstname; }
    public void setFirstname(String firstname) { this.firstname = firstname; }
    public String getMiddleInitial() { return middleInitial; }
    public void setMiddleInitial(String middleInitial) { this.middleInitial = middleInitial; }
    public String getYear() { return year; }
    public void setYear(String year) { this.year = year; }
    public String getGender() { return gender; }
    public void setGender(String gender) { this.gender = gender; }
    public String getCourse() { return course; }
    public void setCourse(String course) { this.course = course; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
    public LocalDateTime getPrivacyAckAt() { return privacyAckAt; }
    public void setPrivacyAckAt(LocalDateTime privacyAckAt) { this.privacyAckAt = privacyAckAt; }
    public String getPrivacyAckVersion() { return privacyAckVersion; }
    public void setPrivacyAckVersion(String privacyAckVersion) { this.privacyAckVersion = privacyAckVersion; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getRejectReason() { return rejectReason; }
    public void setRejectReason(String rejectReason) { this.rejectReason = rejectReason; }
    public Long getStudentId() { return studentId; }
    public void setStudentId(Long studentId) { this.studentId = studentId; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getDecidedAt() { return decidedAt; }
    public void setDecidedAt(LocalDateTime decidedAt) { this.decidedAt = decidedAt; }
    public LocalDateTime getEmailVerifiedAt() { return emailVerifiedAt; }
    public void setEmailVerifiedAt(LocalDateTime emailVerifiedAt) { this.emailVerifiedAt = emailVerifiedAt; }
}
