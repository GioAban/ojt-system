package com.iodev.practicum.model;

import jakarta.persistence.*;
import java.sql.Timestamp;

@Entity
@Table(name = "document_requirement_files")
public class DocumentRequirementFile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "document_requirement_id", nullable = false)
    private DocumentRequirement documentRequirement;

    @Column(name = "file_type", nullable = false)
    private String fileType;

    @Column(name = "file_path", nullable = false)
    private String filePath;

    @org.hibernate.annotations.CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Timestamp createdAt;

    @org.hibernate.annotations.UpdateTimestamp
    @Column(name = "updated_at")
    private Timestamp updatedAt;

    public DocumentRequirementFile() {}

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public DocumentRequirement getDocumentRequirement() { return documentRequirement; }
    public void setDocumentRequirement(DocumentRequirement documentRequirement) { this.documentRequirement = documentRequirement; }

    public String getFileType() { return fileType; }
    public void setFileType(String fileType) { this.fileType = fileType; }

    public String getFilePath() { return filePath; }
    public void setFilePath(String filePath) { this.filePath = filePath; }

    public Timestamp getCreatedAt() { return createdAt; }
    public void setCreatedAt(Timestamp createdAt) { this.createdAt = createdAt; }

    public Timestamp getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Timestamp updatedAt) { this.updatedAt = updatedAt; }
}