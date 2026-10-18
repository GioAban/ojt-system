package com.iodev.practicum.model;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * Aplikasyon ng student (status Approved) sa isang department ng company.
 * Status: PENDING, ACCEPTED, DECLINED, CANCELLED. Kapag ACCEPTED, nagiging Deployed ang student.
 */
@Entity
@Table(name = "company_applications",
        indexes = {
                @Index(name = "idx_company_app_student", columnList = "student_id"),
                @Index(name = "idx_company_app_department", columnList = "department_id")
        })
public class CompanyApplication {

    public static final String PENDING = "PENDING";
    public static final String ACCEPTED = "ACCEPTED";
    public static final String DECLINED = "DECLINED";
    public static final String CANCELLED = "CANCELLED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "student_id", nullable = false)
    private Long studentId;

    @Column(name = "department_id", nullable = false)
    private Long departmentId;

    @Column(nullable = false, length = 20)
    private String status = PENDING;

    @Column(name = "decline_reason", columnDefinition = "LONGTEXT")
    private String declineReason;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public CompanyApplication() {}

    public CompanyApplication(Long studentId, Long departmentId) {
        this.studentId = studentId;
        this.departmentId = departmentId;
    }

    public Long getId() { return id; }
    public Long getStudentId() { return studentId; }
    public Long getDepartmentId() { return departmentId; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getDeclineReason() { return declineReason; }
    public void setDeclineReason(String declineReason) { this.declineReason = declineReason; }
    public LocalDateTime getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(LocalDateTime reviewedAt) { this.reviewedAt = reviewedAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
