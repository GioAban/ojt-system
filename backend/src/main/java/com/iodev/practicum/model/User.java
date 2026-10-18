package com.iodev.practicum.model;

import jakarta.persistence.*;
import java.sql.Timestamp;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String fullname;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(name = "email_verified_at")
    private Timestamp emailVerifiedAt;

    @Column(nullable = false)
    private String password;

    @Enumerated(EnumType.STRING)
    @Column(name = "role_as", nullable = false, length = 20)
    private Role roleAs;

    @Column(length = 100)
    private String photo;

    @Column(name = "is_archived", nullable = false)
    private Boolean isArchived = false;

    @Column(name = "remember_token", length = 100)
    private String rememberToken;

    @org.hibernate.annotations.CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Timestamp createdAt;

    @org.hibernate.annotations.UpdateTimestamp
    @Column(name = "updated_at")
    private Timestamp updatedAt;

    public User() {}

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getFullname() { return fullname; }
    public void setFullname(String fullname) { this.fullname = fullname; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public Timestamp getEmailVerifiedAt() { return emailVerifiedAt; }
    public void setEmailVerifiedAt(Timestamp emailVerifiedAt) { this.emailVerifiedAt = emailVerifiedAt; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public Role getRoleAs() { return roleAs; }
    public void setRoleAs(Role roleAs) { this.roleAs = roleAs; }

    public String getPhoto() { return photo; }
    public void setPhoto(String photo) { this.photo = photo; }

    public Boolean getIsArchived() { return isArchived; }
    public void setIsArchived(Boolean isArchived) { this.isArchived = isArchived; }

    public String getRememberToken() { return rememberToken; }
    public void setRememberToken(String rememberToken) { this.rememberToken = rememberToken; }

    public Timestamp getCreatedAt() { return createdAt; }
    public void setCreatedAt(Timestamp createdAt) { this.createdAt = createdAt; }

    public Timestamp getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Timestamp updatedAt) { this.updatedAt = updatedAt; }
}