package com.iodev.practicum.model;

import jakarta.persistence.*;
import java.sql.Timestamp;

/** Draft ng weekly report na isinusulat ng student sa system (JSON ang laman) */
@Entity
@Table(
        name = "weekly_report_drafts",
        uniqueConstraints = @UniqueConstraint(columnNames = {"student_id", "monthly_weekly_report_id"})
)
public class WeeklyReportDraft {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "student_id", nullable = false)
    private Long studentId;

    @Column(name = "monthly_weekly_report_id", nullable = false)
    private Long monthlyWeeklyReportId;

    @Column(columnDefinition = "LONGTEXT")
    private String content;

    /** Oras (ms) sa device ng student nang huling i-edit; ginagamit sa pagpili ng mas bago */
    @Column(name = "client_updated_at")
    private Long clientUpdatedAt;

    @org.hibernate.annotations.UpdateTimestamp
    @Column(name = "updated_at")
    private Timestamp updatedAt;

    public WeeklyReportDraft() {}

    public Long getId() { return id; }
    public Long getStudentId() { return studentId; }
    public void setStudentId(Long studentId) { this.studentId = studentId; }
    public Long getMonthlyWeeklyReportId() { return monthlyWeeklyReportId; }
    public void setMonthlyWeeklyReportId(Long id) { this.monthlyWeeklyReportId = id; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public Long getClientUpdatedAt() { return clientUpdatedAt; }
    public void setClientUpdatedAt(Long clientUpdatedAt) { this.clientUpdatedAt = clientUpdatedAt; }
    public Timestamp getUpdatedAt() { return updatedAt; }
}
