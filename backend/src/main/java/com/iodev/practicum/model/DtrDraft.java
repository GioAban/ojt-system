package com.iodev.practicum.model;

import jakarta.persistence.*;
import java.sql.Timestamp;

/** Draft ng DTR na isinusulat ng student sa system (JSON ang laman) */
@Entity
@Table(
        name = "dtr_drafts",
        uniqueConstraints = @UniqueConstraint(columnNames = {"student_id", "monthly_dtr_id"})
)
public class DtrDraft {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "student_id", nullable = false)
    private Long studentId;

    @Column(name = "monthly_dtr_id", nullable = false)
    private Long monthlyDtrId;

    @Column(columnDefinition = "LONGTEXT")
    private String content;

    /** Oras (ms) sa device ng student nang huling i-edit; ginagamit sa pagpili ng mas bago */
    @Column(name = "client_updated_at")
    private Long clientUpdatedAt;

    @org.hibernate.annotations.UpdateTimestamp
    @Column(name = "updated_at")
    private Timestamp updatedAt;

    public DtrDraft() {}

    public Long getId() { return id; }
    public Long getStudentId() { return studentId; }
    public void setStudentId(Long studentId) { this.studentId = studentId; }
    public Long getMonthlyDtrId() { return monthlyDtrId; }
    public void setMonthlyDtrId(Long monthlyDtrId) { this.monthlyDtrId = monthlyDtrId; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public Long getClientUpdatedAt() { return clientUpdatedAt; }
    public void setClientUpdatedAt(Long clientUpdatedAt) { this.clientUpdatedAt = clientUpdatedAt; }
    public Timestamp getUpdatedAt() { return updatedAt; }
}
