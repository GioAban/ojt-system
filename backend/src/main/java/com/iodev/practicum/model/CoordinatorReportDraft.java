package com.iodev.practicum.model;

import jakarta.persistence.*;
import java.sql.Timestamp;

/** Draft ng report ng coordinator (hal. listahan ng HTE) para sa isang semester; JSON ang laman */
@Entity
@Table(
        name = "coordinator_report_drafts",
        uniqueConstraints = @UniqueConstraint(columnNames = {"coordinator_id", "semester_id", "report_type"})
)
public class CoordinatorReportDraft {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "coordinator_id", nullable = false)
    private Long coordinatorId;

    @Column(name = "semester_id", nullable = false)
    private Long semesterId;

    @Column(name = "report_type", nullable = false, length = 30)
    private String reportType;

    @Column(columnDefinition = "LONGTEXT")
    private String content;

    /** Oras (ms) sa device ng coordinator nang huling i-edit; ginagamit sa pagpili ng mas bago */
    @Column(name = "client_updated_at")
    private Long clientUpdatedAt;

    @org.hibernate.annotations.UpdateTimestamp
    @Column(name = "updated_at")
    private Timestamp updatedAt;

    public CoordinatorReportDraft() {}

    public Long getId() { return id; }
    public Long getCoordinatorId() { return coordinatorId; }
    public void setCoordinatorId(Long coordinatorId) { this.coordinatorId = coordinatorId; }
    public Long getSemesterId() { return semesterId; }
    public void setSemesterId(Long semesterId) { this.semesterId = semesterId; }
    public String getReportType() { return reportType; }
    public void setReportType(String reportType) { this.reportType = reportType; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public Long getClientUpdatedAt() { return clientUpdatedAt; }
    public void setClientUpdatedAt(Long clientUpdatedAt) { this.clientUpdatedAt = clientUpdatedAt; }
    public Timestamp getUpdatedAt() { return updatedAt; }
}
