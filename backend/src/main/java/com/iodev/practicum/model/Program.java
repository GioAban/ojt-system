package com.iodev.practicum.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.sql.Timestamp;

@Entity
@Table(name = "programs")
public class Program {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "college_id", nullable = false)
    private College college;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, length = 20)
    private String abbreviation;

    @Column(name = "training_duration", precision = 10, scale = 2)
    private BigDecimal trainingDuration;

    @Column(name = "program_head", nullable = false, length = 45)
    private String programHead;

    @Column(name = "is_archived", nullable = false)
    private Boolean isArchived = false;

    @org.hibernate.annotations.CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Timestamp createdAt;

    @org.hibernate.annotations.UpdateTimestamp
    @Column(name = "updated_at")
    private Timestamp updatedAt;

    public Program() {}

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public College getCollege() { return college; }
    public void setCollege(College college) { this.college = college; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getAbbreviation() { return abbreviation; }
    public void setAbbreviation(String abbreviation) { this.abbreviation = abbreviation; }

    public BigDecimal getTrainingDuration() { return trainingDuration; }
    public void setTrainingDuration(BigDecimal trainingDuration) { this.trainingDuration = trainingDuration; }

    public String getProgramHead() { return programHead; }
    public void setProgramHead(String programHead) { this.programHead = programHead; }

    public Boolean getIsArchived() { return isArchived; }
    public void setIsArchived(Boolean isArchived) { this.isArchived = isArchived; }

    public Timestamp getCreatedAt() { return createdAt; }
    public void setCreatedAt(Timestamp createdAt) { this.createdAt = createdAt; }

    public Timestamp getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Timestamp updatedAt) { this.updatedAt = updatedAt; }
}