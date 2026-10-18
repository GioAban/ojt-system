package com.iodev.practicum.model;

import jakarta.persistence.*;
import java.sql.Timestamp;
import java.time.LocalDateTime;

/** Abiso para sa coordinator (hal. nag-turn in o nag-comment ang student). */
@Entity
@Table(name = "coordinator_notifications",
        indexes = @Index(name = "idx_coord_notif_lookup", columnList = "coordinator_id,created_at"))
public class CoordinatorNotification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "coordinator_id", nullable = false)
    private Long coordinatorId;

    @Column(name = "student_id")
    private Long studentId;

    /** turned_in | comment */
    @Column(nullable = false, length = 40)
    private String type;

    @Column(nullable = false)
    private String title;

    @Column(length = 500)
    private String message;

    @Column(length = 300)
    private String link;

    @org.hibernate.annotations.CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Timestamp createdAt;

    /** null = hindi pa nababasa */
    @Column(name = "read_at")
    private LocalDateTime readAt;

    public CoordinatorNotification() {}

    public CoordinatorNotification(Long coordinatorId, Long studentId, String type, String title,
                                   String message, String link) {
        this.coordinatorId = coordinatorId;
        this.studentId = studentId;
        this.type = type;
        this.title = title;
        this.message = message;
        this.link = link;
    }

    public Long getId() { return id; }
    public Long getCoordinatorId() { return coordinatorId; }
    public Long getStudentId() { return studentId; }
    public String getType() { return type; }
    public String getTitle() { return title; }
    public String getMessage() { return message; }
    public String getLink() { return link; }
    public Timestamp getCreatedAt() { return createdAt; }
    public LocalDateTime getReadAt() { return readAt; }
}
