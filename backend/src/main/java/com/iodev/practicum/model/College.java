package com.iodev.practicum.model;

import jakarta.persistence.*;
import java.sql.Timestamp;

@Entity
@Table(name = "colleges")
public class College {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "director_id", nullable = false)
    private Director director;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, length = 20)
    private String abbreviation;

    @Column(nullable = false, length = 45)
    private String dean;

    private String logo;

    @Column(name = "is_archived", nullable = false)
    private Boolean isArchived = false;

    @org.hibernate.annotations.CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Timestamp createdAt;

    @org.hibernate.annotations.UpdateTimestamp
    @Column(name = "updated_at")
    private Timestamp updatedAt;

    public College() {}

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Director getDirector() { return director; }
    public void setDirector(Director director) { this.director = director; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getAbbreviation() { return abbreviation; }
    public void setAbbreviation(String abbreviation) { this.abbreviation = abbreviation; }

    public String getDean() { return dean; }
    public void setDean(String dean) { this.dean = dean; }

    public String getLogo() { return logo; }
    public void setLogo(String logo) { this.logo = logo; }

    public Boolean getIsArchived() { return isArchived; }
    public void setIsArchived(Boolean isArchived) { this.isArchived = isArchived; }

    public Timestamp getCreatedAt() { return createdAt; }
    public void setCreatedAt(Timestamp createdAt) { this.createdAt = createdAt; }

    public Timestamp getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Timestamp updatedAt) { this.updatedAt = updatedAt; }
}