package com.iodev.practicum.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/** Kailan huling tiningnan ng student ang notifications niya (ang mas bago rito ay unread). */
@Entity
@Table(name = "student_notification_state")
public class StudentNotificationState {

    @Id
    @Column(name = "student_id")
    private Long studentId;

    @Column(name = "last_seen_at", nullable = false)
    private LocalDateTime lastSeenAt;

    public StudentNotificationState() {}

    public StudentNotificationState(Long studentId, LocalDateTime lastSeenAt) {
        this.studentId = studentId;
        this.lastSeenAt = lastSeenAt;
    }

    public Long getStudentId() { return studentId; }
    public LocalDateTime getLastSeenAt() { return lastSeenAt; }
    public void setLastSeenAt(LocalDateTime lastSeenAt) { this.lastSeenAt = lastSeenAt; }
}
