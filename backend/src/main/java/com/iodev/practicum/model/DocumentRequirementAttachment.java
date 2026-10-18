package com.iodev.practicum.model;

import jakarta.persistence.*;
import java.sql.Timestamp;

@Entity
@Table(name = "document_requirement_attachments")
public class DocumentRequirementAttachment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "document_requirement_id", nullable = false)
    private DocumentRequirement documentRequirement;

    @ManyToOne
    @JoinColumn(name = "student_id", nullable = false)
    private Student student;
        
    @Column(name = "file_path")
    private String filePath;

    @Column(nullable = false)
    private String status = "Assigned";

    @Column(name = "created_at", updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at")
    private Timestamp updatedAt;

    public DocumentRequirementAttachment() {}

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public DocumentRequirement getDocumentRequirement() { return documentRequirement; }
    public void setDocumentRequirement(DocumentRequirement documentRequirement) { this.documentRequirement = documentRequirement; }

    public Student getStudent() { return student; }
    public void setStudent(Student student) { this.student = student; }

    public String getFilePath() { return filePath; }
    public void setFilePath(String filePath) { this.filePath = filePath; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Timestamp getCreatedAt() { return createdAt; }
    public void setCreatedAt(Timestamp createdAt) { this.createdAt = createdAt; }

    public Timestamp getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Timestamp updatedAt) { this.updatedAt = updatedAt; }
}