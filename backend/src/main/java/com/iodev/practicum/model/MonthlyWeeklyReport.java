package com.iodev.practicum.model;

import jakarta.persistence.*;
import java.sql.Date;
import java.sql.Timestamp;

@Entity
@Table(name = "monthly_weekly_reports")
public class MonthlyWeeklyReport {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "coordinator_id", nullable = false)
    private Coordinator coordinator;

    @ManyToOne
    @JoinColumn(name = "semester_id", nullable = false)
    private Semester semester;

    @Column(name = "month_from", nullable = false)
    private Date monthFrom;

    @Column(name = "month_to", nullable = false)
    private Date monthTo;

    @Column(name = "due_date")
    private Timestamp dueDate;

    private String remarks;

    private String template;

    @Column(name = "is_archived", nullable = false)
    private Boolean isArchived = false;

    @org.hibernate.annotations.CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Timestamp createdAt;

    @org.hibernate.annotations.UpdateTimestamp
    @Column(name = "updated_at")
    private Timestamp updatedAt;

    public MonthlyWeeklyReport() {}

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Coordinator getCoordinator() { return coordinator; }
    public void setCoordinator(Coordinator coordinator) { this.coordinator = coordinator; }

    public Semester getSemester() { return semester; }
    public void setSemester(Semester semester) { this.semester = semester; }

    public Date getMonthFrom() { return monthFrom; }
    public void setMonthFrom(Date monthFrom) { this.monthFrom = monthFrom; }

    public Date getMonthTo() { return monthTo; }
    public void setMonthTo(Date monthTo) { this.monthTo = monthTo; }

    public Timestamp getDueDate() { return dueDate; }
    public void setDueDate(Timestamp dueDate) { this.dueDate = dueDate; }

    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }

    public String getTemplate() { return template; }
    public void setTemplate(String template) { this.template = template; }

    public Boolean getIsArchived() { return isArchived; }
    public void setIsArchived(Boolean isArchived) { this.isArchived = isArchived; }

    public Timestamp getCreatedAt() { return createdAt; }
    public void setCreatedAt(Timestamp createdAt) { this.createdAt = createdAt; }

    public Timestamp getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Timestamp updatedAt) { this.updatedAt = updatedAt; }
}