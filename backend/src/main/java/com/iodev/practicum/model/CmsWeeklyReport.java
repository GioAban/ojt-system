package com.iodev.practicum.model;

import jakarta.persistence.*;
import java.sql.Date;
import java.sql.Timestamp;

@Entity
@Table(name = "cms_weekly_reports")
public class CmsWeeklyReport {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "monthly_weekly_report_id", nullable = false)
    private MonthlyWeeklyReport monthlyWeeklyReport;

    @ManyToOne
    @JoinColumn(name = "student_id", nullable = false)
    private Student student;

    @Column(nullable = false)
    private Date date;

    @Column(columnDefinition = "LONGTEXT", nullable = false)
    private String activities;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder = 0;

    @org.hibernate.annotations.CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Timestamp createdAt;

    @org.hibernate.annotations.UpdateTimestamp
    @Column(name = "updated_at")
    private Timestamp updatedAt;

    public CmsWeeklyReport() {}

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public MonthlyWeeklyReport getMonthlyWeeklyReport() { return monthlyWeeklyReport; }
    public void setMonthlyWeeklyReport(MonthlyWeeklyReport monthlyWeeklyReport) { this.monthlyWeeklyReport = monthlyWeeklyReport; }

    public Student getStudent() { return student; }
    public void setStudent(Student student) { this.student = student; }

    public Date getDate() { return date; }
    public void setDate(Date date) { this.date = date; }

    public String getActivities() { return activities; }
    public void setActivities(String activities) { this.activities = activities; }

    public Integer getSortOrder() { return sortOrder; }
    public void setSortOrder(Integer sortOrder) { this.sortOrder = sortOrder; }

    public Timestamp getCreatedAt() { return createdAt; }
    public void setCreatedAt(Timestamp createdAt) { this.createdAt = createdAt; }

    public Timestamp getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Timestamp updatedAt) { this.updatedAt = updatedAt; }
}