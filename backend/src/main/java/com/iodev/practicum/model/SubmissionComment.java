package com.iodev.practicum.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/** Private na usapan ng isang student at ng coordinator niya tungkol sa isang isinumite. */
@Entity
@Table(name = "submission_comments", indexes = @Index(name = "idx_submission_comments_lookup", columnList = "student_id,scope,ref_id"))
public class SubmissionComment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "student_id", nullable = false)
    private Long studentId;

    @Column(nullable = false, length = 20)
    private String scope;

    @Column(name = "ref_id", nullable = false)
    private Long refId;

    /** STUDENT o COORDINATOR */
    @Column(nullable = false, length = 12)
    private String author;

    @Column(name = "author_name")
    private String authorName;

    @Column(nullable = false, columnDefinition = "LONGTEXT")
    private String body;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public SubmissionComment() {}

    public SubmissionComment(Long studentId, String scope, Long refId, String author, String authorName, String body) {
        this.studentId = studentId;
        this.scope = scope;
        this.refId = refId;
        this.author = author;
        this.authorName = authorName;
        this.body = body;
    }

    public Long getId() { return id; }
    public Long getStudentId() { return studentId; }
    public String getScope() { return scope; }
    public Long getRefId() { return refId; }
    public String getAuthor() { return author; }
    public String getAuthorName() { return authorName; }
    public String getBody() { return body; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
