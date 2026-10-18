package com.iodev.practicum.model;

import jakarta.persistence.*;
import java.sql.Timestamp;
import java.math.BigDecimal;

@Entity
@Table(name = "signed_dtrs")
public class SignedDtr {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "monthly_dtr_id", nullable = false)
    private MonthlyDtr monthlyDtr;

    @ManyToOne
    @JoinColumn(name = "student_id", nullable = false)
    private Student student;

    @Column(name = "file_path", columnDefinition = "TEXT")
    private String filePath;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String status = "Assigned";

    @Column(name = "hours", precision = 7, scale = 2)
private BigDecimal hours;

    @Column(name = "created_at", updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at")
    private Timestamp updatedAt;

    public SignedDtr() {}

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public MonthlyDtr getMonthlyDtr() { return monthlyDtr; }
    public void setMonthlyDtr(MonthlyDtr monthlyDtr) { this.monthlyDtr = monthlyDtr; }

    public Student getStudent() { return student; }
    public void setStudent(Student student) { this.student = student; }

    public String getFilePath() { return filePath; }
    public void setFilePath(String filePath) { this.filePath = filePath; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public BigDecimal getHours() { return hours; }
    public void setHours(BigDecimal hours) { this.hours = hours; }

    public Timestamp getCreatedAt() { return createdAt; }
    public void setCreatedAt(Timestamp createdAt) { this.createdAt = createdAt; }

    public Timestamp getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Timestamp updatedAt) { this.updatedAt = updatedAt; }
}