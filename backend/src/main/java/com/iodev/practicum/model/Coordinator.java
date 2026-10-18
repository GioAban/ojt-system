package com.iodev.practicum.model;

import jakarta.persistence.*;
import java.sql.Timestamp;

@Entity
@Table(name = "coordinators")
public class Coordinator {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @ManyToOne
    @JoinColumn(name = "program_id", nullable = false)
    private Program program;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CoordinatorType type = CoordinatorType.STAFF;

    @Column(name = "employee_number", nullable = false, length = 50, unique = true)
    private String employeeNumber;

    @Column(name = "professional_titles", length = 255)
    private String professionalTitles;

    /** Kapag false, hindi na makakapag-request ang students ng bagong company/department */
    @Column(name = "accepting_company_requests", nullable = false,
            columnDefinition = "TINYINT(1) NOT NULL DEFAULT 1")
    private Boolean acceptingCompanyRequests = true;

    @org.hibernate.annotations.CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Timestamp createdAt;

    @org.hibernate.annotations.UpdateTimestamp
    @Column(name = "updated_at")
    private Timestamp updatedAt;

    public Coordinator() {}

    public Boolean getAcceptingCompanyRequests() { return acceptingCompanyRequests == null || acceptingCompanyRequests; }
    public void setAcceptingCompanyRequests(Boolean v) { this.acceptingCompanyRequests = v; }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public Program getProgram() { return program; }
    public void setProgram(Program program) { this.program = program; }

    public CoordinatorType getType() { return type; }
    public void setType(CoordinatorType type) { this.type = type; }

    public String getEmployeeNumber() { return employeeNumber; }
    public void setEmployeeNumber(String employeeNumber) { this.employeeNumber = employeeNumber; }

    public String getProfessionalTitles() { return professionalTitles; }
    public void setProfessionalTitles(String professionalTitles) { this.professionalTitles = professionalTitles; }

    public Timestamp getCreatedAt() { return createdAt; }
    public void setCreatedAt(Timestamp createdAt) { this.createdAt = createdAt; }

    public Timestamp getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Timestamp updatedAt) { this.updatedAt = updatedAt; }
}