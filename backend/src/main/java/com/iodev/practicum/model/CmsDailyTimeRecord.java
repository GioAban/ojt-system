package com.iodev.practicum.model;

import jakarta.persistence.*;
import java.sql.Date;
import java.sql.Time;
import java.sql.Timestamp;

@Entity
@Table(name = "cms_daily_time_records")
public class CmsDailyTimeRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "monthly_dtr_id", nullable = false)
    private MonthlyDtr monthlyDtr;

    @ManyToOne
    @JoinColumn(name = "student_id", nullable = false)
    private Student student;

    @Column(nullable = false)
    private Date date;

    @Column(name = "am_time_in")
    private Time amTimeIn;

    @Column(name = "am_time_out")
    private Time amTimeOut;

    @Column(name = "pm_time_in")
    private Time pmTimeIn;

    @Column(name = "pm_time_out")
    private Time pmTimeOut;

    @org.hibernate.annotations.CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Timestamp createdAt;

    @org.hibernate.annotations.UpdateTimestamp
    @Column(name = "updated_at")
    private Timestamp updatedAt;

    public CmsDailyTimeRecord() {}

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public MonthlyDtr getMonthlyDtr() { return monthlyDtr; }
    public void setMonthlyDtr(MonthlyDtr monthlyDtr) { this.monthlyDtr = monthlyDtr; }

    public Student getStudent() { return student; }
    public void setStudent(Student student) { this.student = student; }

    public Date getDate() { return date; }
    public void setDate(Date date) { this.date = date; }

    public Time getAmTimeIn() { return amTimeIn; }
    public void setAmTimeIn(Time amTimeIn) { this.amTimeIn = amTimeIn; }

    public Time getAmTimeOut() { return amTimeOut; }
    public void setAmTimeOut(Time amTimeOut) { this.amTimeOut = amTimeOut; }

    public Time getPmTimeIn() { return pmTimeIn; }
    public void setPmTimeIn(Time pmTimeIn) { this.pmTimeIn = pmTimeIn; }

    public Time getPmTimeOut() { return pmTimeOut; }
    public void setPmTimeOut(Time pmTimeOut) { this.pmTimeOut = pmTimeOut; }

    public Timestamp getCreatedAt() { return createdAt; }
    public void setCreatedAt(Timestamp createdAt) { this.createdAt = createdAt; }

    public Timestamp getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Timestamp updatedAt) { this.updatedAt = updatedAt; }
}