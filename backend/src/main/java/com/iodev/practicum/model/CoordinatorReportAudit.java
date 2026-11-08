package com.iodev.practicum.model;

import jakarta.persistence.*;
import java.sql.Timestamp;

/** Tala ng bawat pagbabago sa system na kinumpirma mula sa report ("Apply to system") */
@Entity
@Table(name = "coordinator_report_audits")
public class CoordinatorReportAudit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "coordinator_id", nullable = false)
    private Long coordinatorId;

    @Column(name = "actor_name")
    private String actorName;

    @Column(name = "report_id", nullable = false)
    private Long reportId;

    @Column(name = "semester_id", nullable = false)
    private Long semesterId;

    /** student o department */
    @Column(name = "target_type", nullable = false, length = 20)
    private String targetType;

    @Column(name = "target_id", nullable = false)
    private Long targetId;

    @Column(name = "target_label")
    private String targetLabel;

    @Column(nullable = false, length = 40)
    private String field;

    @Column(name = "old_value", columnDefinition = "TEXT")
    private String oldValue;

    @Column(name = "new_value", columnDefinition = "TEXT")
    private String newValue;

    @Column(name = "affected_count", nullable = false)
    private Integer affectedCount;

    @org.hibernate.annotations.CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Timestamp createdAt;

    public CoordinatorReportAudit() {}

    public Long getId() { return id; }
    public Long getCoordinatorId() { return coordinatorId; }
    public void setCoordinatorId(Long coordinatorId) { this.coordinatorId = coordinatorId; }
    public String getActorName() { return actorName; }
    public void setActorName(String actorName) { this.actorName = actorName; }
    public Long getReportId() { return reportId; }
    public void setReportId(Long reportId) { this.reportId = reportId; }
    public Long getSemesterId() { return semesterId; }
    public void setSemesterId(Long semesterId) { this.semesterId = semesterId; }
    public String getTargetType() { return targetType; }
    public void setTargetType(String targetType) { this.targetType = targetType; }
    public Long getTargetId() { return targetId; }
    public void setTargetId(Long targetId) { this.targetId = targetId; }
    public String getTargetLabel() { return targetLabel; }
    public void setTargetLabel(String targetLabel) { this.targetLabel = targetLabel; }
    public String getField() { return field; }
    public void setField(String field) { this.field = field; }
    public String getOldValue() { return oldValue; }
    public void setOldValue(String oldValue) { this.oldValue = oldValue; }
    public String getNewValue() { return newValue; }
    public void setNewValue(String newValue) { this.newValue = newValue; }
    public Integer getAffectedCount() { return affectedCount; }
    public void setAffectedCount(Integer affectedCount) { this.affectedCount = affectedCount; }
    public Timestamp getCreatedAt() { return createdAt; }
}
