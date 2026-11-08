package com.iodev.practicum.model;

import jakarta.persistence.*;
import java.sql.Timestamp;

@Entity
@Table(name = "evaluations")
public class Evaluation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "coordinator_id", nullable = false)
    private Coordinator coordinator;

    @ManyToOne
    @JoinColumn(name = "semester_id", nullable = false)
    private Semester semester;

    /**
     * Ang built-in na requirement ng form na ito. Doon nakatala ang instructions, due date, attachments,
     * status at file; dito ang mga criteria lang. Null sa lumang data.
     */
    @OneToOne
    @JoinColumn(name = "document_requirement_id", unique = true)
    private DocumentRequirement requirement;

    @Column(name = "score_type", nullable = false)
    private String scoreType = "percentage";

    @Column(name = "evaluation_type", nullable = false)
    private String evaluationType = "midterm";

    @Column(nullable = false)
    private String template;

    @Column(name = "due_date")
    private Timestamp dueDate;

    @Column(name = "is_archived", nullable = false)
    private Integer isArchived = 0;

    @org.hibernate.annotations.CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Timestamp createdAt;

    @org.hibernate.annotations.UpdateTimestamp
    @Column(name = "updated_at")
    private Timestamp updatedAt;

    public Evaluation() {}

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Coordinator getCoordinator() { return coordinator; }
    public void setCoordinator(Coordinator coordinator) { this.coordinator = coordinator; }

    public Semester getSemester() { return semester; }
    public void setSemester(Semester semester) { this.semester = semester; }

    public DocumentRequirement getRequirement() { return requirement; }
    public void setRequirement(DocumentRequirement requirement) { this.requirement = requirement; }

    public String getScoreType() { return scoreType; }
    public void setScoreType(String scoreType) { this.scoreType = scoreType; }

    public String getEvaluationType() { return evaluationType; }
    public void setEvaluationType(String evaluationType) { this.evaluationType = evaluationType; }

    public String getTemplate() { return template; }
    public void setTemplate(String template) { this.template = template; }

    public Timestamp getDueDate() { return dueDate; }
    public void setDueDate(Timestamp dueDate) { this.dueDate = dueDate; }

    public Integer getIsArchived() { return isArchived; }
    public void setIsArchived(Integer isArchived) { this.isArchived = isArchived; }

    public Timestamp getCreatedAt() { return createdAt; }
    public void setCreatedAt(Timestamp createdAt) { this.createdAt = createdAt; }

    public Timestamp getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Timestamp updatedAt) { this.updatedAt = updatedAt; }
}