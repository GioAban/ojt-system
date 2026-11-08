package com.iodev.practicum.model;

import jakarta.persistence.*;
import java.sql.Timestamp;

/** Naka-save na report o listahan ng coordinator para sa isang semester; JSON ang laman */
@Entity
@Table(
        name = "coordinator_saved_reports",
        indexes = @Index(name = "idx_saved_report_owner", columnList = "coordinator_id, semester_id")
)
public class CoordinatorSavedReport {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "coordinator_id", nullable = false)
    private Long coordinatorId;

    @Column(name = "semester_id", nullable = false)
    private Long semesterId;

    @Column(name = "report_type", nullable = false, length = 30)
    private String reportType;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(columnDefinition = "LONGTEXT")
    private String content;

    /** Oras (ms) sa device ng coordinator nang huling i-edit; ginagamit sa pagpili ng mas bago */
    @Column(name = "client_updated_at", nullable = false)
    private Long clientUpdatedAt;

    @Column(name = "last_edited_by")
    private String lastEditedBy;

    @org.hibernate.annotations.CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Timestamp createdAt;

    @org.hibernate.annotations.UpdateTimestamp
    @Column(name = "updated_at")
    private Timestamp updatedAt;

    public CoordinatorSavedReport() {}

    public Long getId() { return id; }
    public Long getCoordinatorId() { return coordinatorId; }
    public void setCoordinatorId(Long coordinatorId) { this.coordinatorId = coordinatorId; }
    public Long getSemesterId() { return semesterId; }
    public void setSemesterId(Long semesterId) { this.semesterId = semesterId; }
    public String getReportType() { return reportType; }
    public void setReportType(String reportType) { this.reportType = reportType; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public Long getClientUpdatedAt() { return clientUpdatedAt; }
    public void setClientUpdatedAt(Long clientUpdatedAt) { this.clientUpdatedAt = clientUpdatedAt; }
    public String getLastEditedBy() { return lastEditedBy; }
    public void setLastEditedBy(String lastEditedBy) { this.lastEditedBy = lastEditedBy; }
    public Timestamp getCreatedAt() { return createdAt; }
    public Timestamp getUpdatedAt() { return updatedAt; }
}
