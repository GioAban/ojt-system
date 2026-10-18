package com.iodev.practicum.model;

import jakarta.persistence.*;
import java.sql.Timestamp;

/**
 * Isang file o link na inilagay ng student sa isang requirement, weekly report o DTR.
 * scope = requirement | weekly | dtr, at refId = id ng requirement / linggo / buwan.
 */
@Entity
@Table(name = "submission_files", indexes = @Index(name = "idx_submission_files_lookup", columnList = "student_id,scope,ref_id"))
public class SubmissionFile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "student_id", nullable = false)
    private Long studentId;

    @Column(nullable = false, length = 20)
    private String scope;

    @Column(name = "ref_id", nullable = false)
    private Long refId;

    /** FILE o LINK */
    @Column(nullable = false, length = 10)
    private String kind;

    @Column(nullable = false)
    private String name;

    /** S3 key kapag FILE, buong URL kapag LINK */
    @Column(nullable = false, length = 1000)
    private String path;

    @Column(name = "size_bytes")
    private Long sizeBytes;

    @org.hibernate.annotations.CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Timestamp createdAt;

    public SubmissionFile() {}

    public Long getId() { return id; }
    public Long getStudentId() { return studentId; }
    public void setStudentId(Long studentId) { this.studentId = studentId; }
    public String getScope() { return scope; }
    public void setScope(String scope) { this.scope = scope; }
    public Long getRefId() { return refId; }
    public void setRefId(Long refId) { this.refId = refId; }
    public String getKind() { return kind; }
    public void setKind(String kind) { this.kind = kind; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getPath() { return path; }
    public void setPath(String path) { this.path = path; }
    public Long getSizeBytes() { return sizeBytes; }
    public void setSizeBytes(Long sizeBytes) { this.sizeBytes = sizeBytes; }
    public Timestamp getCreatedAt() { return createdAt; }
}
