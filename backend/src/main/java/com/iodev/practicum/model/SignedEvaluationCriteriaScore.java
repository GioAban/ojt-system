package com.iodev.practicum.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.sql.Timestamp;

@Entity
@Table(name = "signed_evaluation_criteria_scores",
       uniqueConstraints = @UniqueConstraint(
           name = "signed_eval_criteria_unique",
           columnNames = {"signed_evaluation_id", "evaluation_criteria_id"}
       ))
public class SignedEvaluationCriteriaScore {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "signed_evaluation_id", nullable = false)
    private SignedEvaluation signedEvaluation;

    @ManyToOne
    @JoinColumn(name = "evaluation_criteria_id", nullable = false)
    private EvaluationCriteria evaluationCriteria;

    @Column(precision = 5, scale = 2)
    private BigDecimal score;

    @org.hibernate.annotations.CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Timestamp createdAt;

    @org.hibernate.annotations.UpdateTimestamp
    @Column(name = "updated_at")
    private Timestamp updatedAt;

    public SignedEvaluationCriteriaScore() {}

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public SignedEvaluation getSignedEvaluation() { return signedEvaluation; }
    public void setSignedEvaluation(SignedEvaluation signedEvaluation) { this.signedEvaluation = signedEvaluation; }

    public EvaluationCriteria getEvaluationCriteria() { return evaluationCriteria; }
    public void setEvaluationCriteria(EvaluationCriteria evaluationCriteria) { this.evaluationCriteria = evaluationCriteria; }

    public BigDecimal getScore() { return score; }
    public void setScore(BigDecimal score) { this.score = score; }

    public Timestamp getCreatedAt() { return createdAt; }
    public void setCreatedAt(Timestamp createdAt) { this.createdAt = createdAt; }

    public Timestamp getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Timestamp updatedAt) { this.updatedAt = updatedAt; }
}