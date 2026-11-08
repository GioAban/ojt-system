package com.iodev.practicum.model;

import jakarta.persistence.*;
import java.sql.Timestamp;

/** Mga pangalan at titulo sa pirmahan ng mga report, tanda bawat coordinator (JSON; walang laman = default ng system) */
@Entity
@Table(name = "coordinator_report_signatories")
public class CoordinatorReportSignatories {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "coordinator_id", nullable = false, unique = true)
    private Long coordinatorId;

    @Column(columnDefinition = "TEXT")
    private String content;

    @org.hibernate.annotations.UpdateTimestamp
    @Column(name = "updated_at")
    private Timestamp updatedAt;

    public CoordinatorReportSignatories() {}

    public Long getId() { return id; }
    public Long getCoordinatorId() { return coordinatorId; }
    public void setCoordinatorId(Long coordinatorId) { this.coordinatorId = coordinatorId; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public Timestamp getUpdatedAt() { return updatedAt; }
}
