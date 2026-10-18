package com.iodev.practicum.model;

import jakarta.persistence.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Ang link/QR na ibinabahagi ng coordinator para makapag-create ng account ang mga student.
 * Isa lang bawat coordinator kada semester.
 */
@Entity
@Table(name = "enrollment_links",
        uniqueConstraints = @UniqueConstraint(columnNames = {"coordinator_id", "semester_id"}))
public class EnrollmentLink {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "coordinator_id", nullable = false)
    private Coordinator coordinator;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "semester_id", nullable = false)
    private Semester semester;

    @Column(nullable = false, unique = true, length = 64)
    private String token;

    /** Huling araw na bukas ang link; null kung walang takdang petsa */
    @Column(name = "due_date")
    private LocalDate dueDate;

    @Column(name = "is_open", nullable = false)
    private boolean open = true;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt = LocalDateTime.now();

    public EnrollmentLink() {}

    public Long getId() { return id; }
    public Coordinator getCoordinator() { return coordinator; }
    public void setCoordinator(Coordinator coordinator) { this.coordinator = coordinator; }
    public Semester getSemester() { return semester; }
    public void setSemester(Semester semester) { this.semester = semester; }
    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }
    public LocalDate getDueDate() { return dueDate; }
    public void setDueDate(LocalDate dueDate) { this.dueDate = dueDate; }
    public boolean isOpen() { return open; }
    public void setOpen(boolean open) { this.open = open; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void touch() { this.updatedAt = LocalDateTime.now(); }
}
