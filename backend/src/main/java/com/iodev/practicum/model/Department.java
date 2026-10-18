package com.iodev.practicum.model;

import jakarta.persistence.*;
import java.sql.Timestamp;
import java.time.LocalDateTime;

@Entity
@Table(name = "departments")
public class Department {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "company_id", nullable = false)
    private Company company;

    private String name;

    @Column(nullable = false)
    private Integer slots = 0;

    @Column(name = "supervisor_fullname")
    private String supervisorFullname;

    @Column(name = "supervisor_position")
    private String supervisorPosition;

    @Column(name = "supervisor_contact_number")
    private String supervisorContactNumber;

    @Column(name = "supervisor_photo")
    private String supervisorPhoto;

    @Column(name = "supervisor_email")
    private String supervisorEmail;

    @Column(name = "supervisor_password")
    private String supervisorPassword;

    @Column(nullable = false)
    /** approved (default: idinagdag ng coordinator), pending o declined (hiling ng student) */
    private String status = "approved";

    /** Student na humiling nito. Null kapag ang coordinator ang nagdagdag. */
    @Column(name = "requested_by_student_id")
    private Long requestedByStudentId;

    @Column(name = "decline_reason", columnDefinition = "LONGTEXT")
    private String declineReason;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @Column(name = "signed_moa")
    private String signedMoa;

    @Column(name = "moa_start")
    private String moaStart;

    @Column(name = "moa_expiration")
    private String moaExpiration;

    @Column(name = "is_archived", nullable = false)
    private Boolean isArchived = false;

    @org.hibernate.annotations.CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Timestamp createdAt;

    @org.hibernate.annotations.UpdateTimestamp
    @Column(name = "updated_at")
    private Timestamp updatedAt;

    public Department() {}

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Company getCompany() { return company; }
    public void setCompany(Company company) { this.company = company; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public Integer getSlots() { return slots; }
    public void setSlots(Integer slots) { this.slots = slots; }

    public String getSupervisorFullname() { return supervisorFullname; }
    public void setSupervisorFullname(String supervisorFullname) { this.supervisorFullname = supervisorFullname; }

    public String getSupervisorPosition() { return supervisorPosition; }
    public void setSupervisorPosition(String supervisorPosition) { this.supervisorPosition = supervisorPosition; }

    public String getSupervisorContactNumber() { return supervisorContactNumber; }
    public void setSupervisorContactNumber(String supervisorContactNumber) { this.supervisorContactNumber = supervisorContactNumber; }

    public String getSupervisorPhoto() { return supervisorPhoto; }
    public void setSupervisorPhoto(String supervisorPhoto) { this.supervisorPhoto = supervisorPhoto; }

    public String getSupervisorEmail() { return supervisorEmail; }
    public void setSupervisorEmail(String supervisorEmail) { this.supervisorEmail = supervisorEmail; }

    public String getSupervisorPassword() { return supervisorPassword; }
    public void setSupervisorPassword(String supervisorPassword) { this.supervisorPassword = supervisorPassword; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Long getRequestedByStudentId() { return requestedByStudentId; }
    public void setRequestedByStudentId(Long v) { this.requestedByStudentId = v; }

    public String getDeclineReason() { return declineReason; }
    public void setDeclineReason(String v) { this.declineReason = v; }

    public LocalDateTime getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(LocalDateTime v) { this.reviewedAt = v; }

    public String getSignedMoa() { return signedMoa; }
    public void setSignedMoa(String signedMoa) { this.signedMoa = signedMoa; }

    public String getMoaStart() { return moaStart; }
    public void setMoaStart(String moaStart) { this.moaStart = moaStart; }

    public String getMoaExpiration() { return moaExpiration; }
    public void setMoaExpiration(String moaExpiration) { this.moaExpiration = moaExpiration; }

    public Boolean getIsArchived() { return isArchived; }
    public void setIsArchived(Boolean isArchived) { this.isArchived = isArchived; }

    public Timestamp getCreatedAt() { return createdAt; }
    public void setCreatedAt(Timestamp createdAt) { this.createdAt = createdAt; }

    public Timestamp getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Timestamp updatedAt) { this.updatedAt = updatedAt; }
}