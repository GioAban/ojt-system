package com.iodev.practicum.model;

import jakarta.persistence.*;
import java.sql.Timestamp;

@Entity
@Table(name = "signed_weekly_reports")
public class SignedWeeklyReport {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "monthly_weekly_report_id", nullable = false)
    private MonthlyWeeklyReport monthlyWeeklyReport;

    @ManyToOne
    @JoinColumn(name = "student_id", nullable = false)
    private Student student;

    @Column(name = "file_path", columnDefinition = "TEXT")
    private String filePath;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String status = "Assigned";

    @Column(name = "supervisor_evaluation")
    private Integer supervisorEvaluation;

    @Column(name = "supervisor_comment", columnDefinition = "LONGTEXT")
    private String supervisorComment;

    @Column(name = "created_at", updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at")
    private Timestamp updatedAt;

    public SignedWeeklyReport() {}

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public MonthlyWeeklyReport getMonthlyWeeklyReport() { return monthlyWeeklyReport; }
    public void setMonthlyWeeklyReport(MonthlyWeeklyReport monthlyWeeklyReport) { this.monthlyWeeklyReport = monthlyWeeklyReport; }

    public Student getStudent() { return student; }
    public void setStudent(Student student) { this.student = student; }

    public String getFilePath() { return filePath; }
    public void setFilePath(String filePath) { this.filePath = filePath; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Integer getSupervisorEvaluation() { return supervisorEvaluation; }
    public void setSupervisorEvaluation(Integer supervisorEvaluation) { this.supervisorEvaluation = supervisorEvaluation; }

    public String getSupervisorComment() { return supervisorComment; }
    public void setSupervisorComment(String supervisorComment) { this.supervisorComment = supervisorComment; }

    public Timestamp getCreatedAt() { return createdAt; }
    public void setCreatedAt(Timestamp createdAt) { this.createdAt = createdAt; }

    public Timestamp getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Timestamp updatedAt) { this.updatedAt = updatedAt; }
}