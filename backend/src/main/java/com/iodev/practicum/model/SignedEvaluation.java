package com.iodev.practicum.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.sql.Timestamp;

@Entity
@Table(name = "signed_evaluations", uniqueConstraints = @UniqueConstraint(
        name = "uk_signed_evaluations_student",
        columnNames = {"evaluation_id", "student_id"}))
public class SignedEvaluation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "evaluation_id", nullable = false)
    private Evaluation evaluation;

    @ManyToOne
    @JoinColumn(name = "student_id", nullable = false)
    private Student student;

    @Column(name = "signed_file", nullable = false)
    private String signedFile;

    @Column(nullable = false)
    private String status = "Assigned";

    @Column(name = "original_score", precision = 5, scale = 2, nullable = false)
    private BigDecimal originalScore;

    @Column(name = "normalized_score", precision = 5, scale = 2, nullable = false)
    private BigDecimal normalizedScore;

    @Column(name = "strong_points", columnDefinition = "LONGTEXT")
    private String strongPoints;

    @Column(name = "needs_improvement", columnDefinition = "LONGTEXT")
    private String needsImprovement;

    @Column(name = "is_discussed", nullable = false)
    private Boolean isDiscussed = false;

    @Column(columnDefinition = "LONGTEXT")
    private String remarks;

    @Column(name = "signed_date")
    private Timestamp signedDate;

    @Column(name = "supervisor_name")
    private String supervisorName;

    @Column(name = "supervisor_position")
    private String supervisorPosition;

    @Column(name = "period_from")
    private java.time.LocalDate periodFrom;

    @Column(name = "period_to")
    private java.time.LocalDate periodTo;

    @Column(name = "contact_no")
    private String contactNo;

    /** Huling coordinator na nagwasto ng laman, at kailan */
    @Column(name = "edited_by_name")
    private String editedByName;

    @Column(name = "edited_at")
    private Timestamp editedAt;

    @org.hibernate.annotations.CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Timestamp createdAt;

    @org.hibernate.annotations.UpdateTimestamp
    @Column(name = "updated_at")
    private Timestamp updatedAt;

    public SignedEvaluation() {}

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Evaluation getEvaluation() { return evaluation; }
    public void setEvaluation(Evaluation evaluation) { this.evaluation = evaluation; }

    public Student getStudent() { return student; }
    public void setStudent(Student student) { this.student = student; }

    public String getSignedFile() { return signedFile; }
    public void setSignedFile(String signedFile) { this.signedFile = signedFile; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public BigDecimal getOriginalScore() { return originalScore; }
    public void setOriginalScore(BigDecimal originalScore) { this.originalScore = originalScore; }

    public BigDecimal getNormalizedScore() { return normalizedScore; }
    public void setNormalizedScore(BigDecimal normalizedScore) { this.normalizedScore = normalizedScore; }

    public String getStrongPoints() { return strongPoints; }
    public void setStrongPoints(String strongPoints) { this.strongPoints = strongPoints; }

    public String getNeedsImprovement() { return needsImprovement; }
    public void setNeedsImprovement(String needsImprovement) { this.needsImprovement = needsImprovement; }

    public Boolean getIsDiscussed() { return isDiscussed; }
    public void setIsDiscussed(Boolean isDiscussed) { this.isDiscussed = isDiscussed; }

    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }

    public Timestamp getSignedDate() { return signedDate; }
    public void setSignedDate(Timestamp signedDate) { this.signedDate = signedDate; }

    public String getSupervisorName() { return supervisorName; }
    public void setSupervisorName(String supervisorName) { this.supervisorName = supervisorName; }

    public String getSupervisorPosition() { return supervisorPosition; }
    public void setSupervisorPosition(String supervisorPosition) { this.supervisorPosition = supervisorPosition; }

    public java.time.LocalDate getPeriodFrom() { return periodFrom; }
    public void setPeriodFrom(java.time.LocalDate periodFrom) { this.periodFrom = periodFrom; }

    public java.time.LocalDate getPeriodTo() { return periodTo; }
    public void setPeriodTo(java.time.LocalDate periodTo) { this.periodTo = periodTo; }

    public String getContactNo() { return contactNo; }
    public void setContactNo(String contactNo) { this.contactNo = contactNo; }

    public String getEditedByName() { return editedByName; }
    public void setEditedByName(String editedByName) { this.editedByName = editedByName; }

    public Timestamp getEditedAt() { return editedAt; }
    public void setEditedAt(Timestamp editedAt) { this.editedAt = editedAt; }

    public Timestamp getCreatedAt() { return createdAt; }
    public void setCreatedAt(Timestamp createdAt) { this.createdAt = createdAt; }

    public Timestamp getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Timestamp updatedAt) { this.updatedAt = updatedAt; }
}