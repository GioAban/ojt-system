package com.iodev.practicum.model;

import jakarta.persistence.*;
import java.sql.Timestamp;

/**
 * Isang skill sa iisang catalog (para sa student at company). Ang name ay kung paano ito unang na-type;
 * ang normalizedKey ang ginagamit sa pagtutugma at sa pagiging natatangi (hal. "React JS", "ReactJS", "react.js").
 */
@Entity
@Table(name = "skills", uniqueConstraints = @UniqueConstraint(name = "uk_skills_key", columnNames = "normalized_key"))
public class Skill {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 60)
    private String name;

    @Column(name = "normalized_key", nullable = false, length = 60)
    private String normalizedKey;

    @org.hibernate.annotations.CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Timestamp createdAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getNormalizedKey() { return normalizedKey; }
    public void setNormalizedKey(String normalizedKey) { this.normalizedKey = normalizedKey; }

    public Timestamp getCreatedAt() { return createdAt; }
}
