package com.iodev.practicum.model;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/** Abiso para sa student (hal. na-approve o na-decline ang hiniling na company). */
@Entity
@Table(name = "student_notifications")
public class StudentNotification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "student_id", nullable = false)
    private Long studentId;

    @Column(nullable = false, length = 50)
    private String type;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "LONGTEXT")
    private String message;

    @Column(name = "read_at")
    private LocalDateTime readAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public StudentNotification() {}

    public StudentNotification(Long studentId, String type, String title, String message) {
        this.studentId = studentId;
        this.type = type;
        this.title = title;
        this.message = message;
    }

    public Long getId() { return id; }
    public Long getStudentId() { return studentId; }
    public String getType() { return type; }
    public String getTitle() { return title; }
    public String getMessage() { return message; }
    public LocalDateTime getReadAt() { return readAt; }
    public void setReadAt(LocalDateTime readAt) { this.readAt = readAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
